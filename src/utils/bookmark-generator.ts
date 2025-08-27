import blink from '../blink/client';
import { Message, Bookmark } from '../types';

// Helper function to get conversation pair IDs for a list of message IDs
function getConversationPairIds(messageIds: string[], allMessages: Message[]): string[] {
  const conversationIds: string[] = [];

  messageIds.forEach(msgId => {
    const msgIndex = allMessages.findIndex(msg => msg.id === msgId);
    if (msgIndex !== -1) {
      const msg = allMessages[msgIndex];
      conversationIds.push(msgId);

      // If it's a user message, add the next message (AI response) if it exists
      if (msg.role === 'user' && msgIndex + 1 < allMessages.length) {
        const nextMsg = allMessages[msgIndex + 1];
        if (nextMsg.role === 'assistant') {
          conversationIds.push(nextMsg.id);
        }
      }

      // If it's an AI message, add the previous message (user input) if it exists
      if (msg.role === 'assistant' && msgIndex > 0) {
        const prevMsg = allMessages[msgIndex - 1];
        if (prevMsg.role === 'user') {
          conversationIds.push(prevMsg.id);
        }
      }
    }
  });

  return conversationIds;
}

// Function to check if a message is already bookmarked
function isMessageAlreadyBookmarked(messageId: string, existingBookmarks: Bookmark[]): boolean {
  return existingBookmarks.some(bookmark => 
    bookmark.messageIds && bookmark.messageIds.split(',').includes(messageId)
  );
}

// Function to find the best existing bookmark for a new message
function findBestBookmarkForMessage(messageContent: string, existingBookmarks: Bookmark[]): Bookmark | null {
  const messageLower = messageContent.toLowerCase();
  
  // Find bookmarks that might be related to this message
  const potentialMatches = existingBookmarks.filter(bookmark => {
    const titleLower = bookmark.title.toLowerCase();
    const descriptionLower = (bookmark.description || '').toLowerCase();
    
    // Check if the message content contains the bookmark title or vice versa
    return messageLower.includes(titleLower) || titleLower.includes(messageLower) ||
           messageLower.includes(descriptionLower) || descriptionLower.includes(messageLower);
  });

  if (potentialMatches.length === 0) return null;
  
  // Score potential matches based on relevance
  const scoredMatches = potentialMatches.map(bookmark => {
    const titleLower = bookmark.title.toLowerCase();
    const descriptionLower = (bookmark.description || '').toLowerCase();
    
    let score = 0;
    
    // Exact title match gets highest score
    if (messageLower.includes(titleLower)) score += 10;
    if (titleLower.includes(messageLower)) score += 8;
    
    // Description matches get medium score
    if (messageLower.includes(descriptionLower)) score += 5;
    if (descriptionLower.includes(messageLower)) score += 4;
    
    // Partial word matches get lower scores
    const messageWords = messageLower.split(/\s+/);
    const titleWords = titleLower.split(/\s+/);
    
    messageWords.forEach(word => {
      if (word.length > 2 && titleWords.some(titleWord => titleWord.includes(word) || word.includes(titleWord))) {
        score += 2;
      }
    });
    
    return { bookmark, score };
  });
  
  // Sort by score and return the best match
  scoredMatches.sort((a, b) => b.score - a.score);
  
  // Only return if the score is above a threshold
  if (scoredMatches[0].score >= 3) {
    return scoredMatches[0].bookmark;
  }
  
  return null;
}

// Function to analyze chat messages and generate short keyword bookmarks (0-10 keywords)
export async function generateBookmarksForChat(chatSessionId: string, userId: string, messages: Message[]): Promise<Bookmark[]> {
  if (!messages || messages.length === 0) return [];

  try {
    // Fetch existing bookmarks for this chat + user
    const existingBookmarks: Bookmark[] = await blink.db.bookmarks.list({
      where: { chatSessionId, userId },
    });

    // Only analyze user messages that aren't already bookmarked
    const userMessages = messages.filter(msg => msg.role === 'user');
    const newUserMessages = userMessages.filter(msg => !isMessageAlreadyBookmarked(msg.id, existingBookmarks));
    
    if (newUserMessages.length === 0) {
      console.log('📚 All messages already bookmarked, no new bookmarks needed');
      return [];
    }

    console.log(`📚 Processing ${newUserMessages.length} new user messages for bookmark generation`);

    const createdOrUpdated: Bookmark[] = [];

    // Process each new user message individually
    for (const newMessage of newUserMessages) {
      console.log(`📚 Processing message: "${newMessage.content.substring(0, 50)}..."`);
      
      // Check if this message fits into an existing bookmark
      const existingBookmark = findBestBookmarkForMessage(newMessage.content, existingBookmarks);
      
      if (existingBookmark) {
        console.log(`📚 Found existing bookmark: "${existingBookmark.title}" for message`);
        // Add this message to the existing bookmark
        const existingIds = (existingBookmark.messageIds || '').split(',').filter(Boolean);
        const conversationIds = getConversationPairIds([newMessage.id], messages);
        
        // Only add if not already present
        const newIds = conversationIds.filter(id => !existingIds.includes(id));
        if (newIds.length > 0) {
          const mergedIds = [...existingIds, ...newIds];
          
          try {
            await blink.db.bookmarks.update(existingBookmark.id, {
              messageIds: mergedIds.join(','),
            });
            
            const updatedBookmark = { ...existingBookmark, messageIds: mergedIds.join(',') };
            createdOrUpdated.push(updatedBookmark);
            console.log(`📚 Added message to existing bookmark: "${existingBookmark.title}"`);
          } catch (err) {
            console.error('Failed to update existing bookmark', existingBookmark.id, err);
          }
        } else {
          console.log(`📚 Message already present in bookmark: "${existingBookmark.title}"`);
        }
        continue;
      }

      console.log(`📚 No existing bookmark found, creating new one for message`);
      // Generate a new bookmark for this message
      const prompt = `You are an assistant that extracts a concise topic keyword from a single message.
Given the message below, return a single short keyword or phrase (1-3 words) that best represents the topic discussed.
Return JSON only with a top-level key named "keyword" (string).
Do NOT return any extra explanation or text.

Message:
${newMessage.content}

Respond with JSON only.`;

      const response = await blink.ai.generateObject({
        prompt,
        schema: {
          type: 'object',
          properties: {
            keyword: { type: 'string' },
          },
          required: ['keyword'],
        },
      });

      const keyword = response?.object?.keyword?.trim();
      if (!keyword) continue;

      // Check if we already have a bookmark with this exact title
      const duplicate = existingBookmarks.find(b => b.title.toLowerCase() === keyword.toLowerCase());
      if (duplicate) {
        // Merge into duplicate
        const existingIds = (duplicate.messageIds || '').split(',').filter(Boolean);
        const conversationIds = getConversationPairIds([newMessage.id], messages);
        
        // Only add if not already present
        const newIds = conversationIds.filter(id => !existingIds.includes(id));
        if (newIds.length > 0) {
          const mergedIds = [...existingIds, ...newIds];
          
          try {
            await blink.db.bookmarks.update(duplicate.id, {
              messageIds: mergedIds.join(','),
            });
            
            const updatedBookmark = { ...duplicate, messageIds: mergedIds.join(',') };
            createdOrUpdated.push(updatedBookmark);
            console.log(`📚 Merged message into existing bookmark: "${duplicate.title}"`);
          } catch (err) {
            console.error('Failed to update duplicate bookmark', duplicate.id, err);
          }
        }
        continue;
      }

      // Create a new bookmark
      const conversationIds = getConversationPairIds([newMessage.id], messages);
      const bookmark: Bookmark = {
        id: `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        chatSessionId,
        userId,
        title: keyword,
        description: `Auto-generated topic: ${keyword}`,
        category: keyword.toLowerCase().replace(/\s+/g, '_'),
        messageIds: conversationIds.join(','),
        createdAt: new Date().toISOString(),
      };

      try {
        await blink.db.bookmarks.create(bookmark);
        createdOrUpdated.push(bookmark);
        console.log(`📚 Created new bookmark: "${keyword}" for message: "${newMessage.content.substring(0, 50)}..."`);
      } catch (err) {
        console.error('Failed to save bookmark for keyword', keyword, err);
      }
    }

    return createdOrUpdated;
  } catch (error) {
    console.error('Failed to generate bookmarks:', error);
    return [];
  }
}

// Function to clean up duplicate and overlapping bookmarks
export async function cleanupBookmarks(chatSessionId: string, userId: string): Promise<void> {
  try {
    const existingBookmarks: Bookmark[] = await blink.db.bookmarks.list({
      where: { chatSessionId, userId },
    });

    if (existingBookmarks.length <= 1) return;

    console.log(`🧹 Cleaning up ${existingBookmarks.length} bookmarks for session ${chatSessionId}`);

    // Group bookmarks by similar titles (case-insensitive)
    const titleGroups = new Map<string, Bookmark[]>();
    
    existingBookmarks.forEach(bookmark => {
      const titleLower = bookmark.title.toLowerCase();
      if (!titleGroups.has(titleLower)) {
        titleGroups.set(titleLower, []);
      }
      titleGroups.get(titleLower)!.push(bookmark);
    });

    // Merge bookmarks with identical titles
    for (const [titleLower, bookmarks] of titleGroups) {
      if (bookmarks.length > 1) {
        console.log(`🧹 Merging ${bookmarks.length} bookmarks with title: "${titleLower}"`);
        
        // Keep the first bookmark and merge message IDs from others
        const primaryBookmark = bookmarks[0];
        const allMessageIds = new Set<string>();
        
        bookmarks.forEach(bookmark => {
          if (bookmark.messageIds) {
            bookmark.messageIds.split(',').filter(Boolean).forEach(id => allMessageIds.add(id));
          }
        });

        // Update primary bookmark with merged message IDs
        await blink.db.bookmarks.update(primaryBookmark.id, {
          messageIds: Array.from(allMessageIds).join(','),
        });

        // Delete duplicate bookmarks
        for (let i = 1; i < bookmarks.length; i++) {
          await blink.db.bookmarks.delete(bookmarks[i].id);
        }
      }
    }

    console.log(`🧹 Cleanup completed for session ${chatSessionId}`);
  } catch (error) {
    console.error('Failed to cleanup bookmarks:', error);
  }
}

// Function to get messages for a specific bookmark category
export function getMessagesForBookmark(bookmark: Bookmark, allMessages: Message[]): Message[] {
  if (!bookmark.messageIds) return [];

  const messageIds = bookmark.messageIds.split(',');
  return allMessages.filter(msg => messageIds.includes(msg.id));
}

// Function to generate a summary for the first message (for folder names)
export function generateChatSummary(firstMessage: string): string {
  if (firstMessage.length <= 50) return firstMessage;

  const words = firstMessage.split(' ');
  let summary = '';

  for (const word of words) {
    if ((summary + word).length > 47) break;
    summary += (summary ? ' ' : '') + word;
  }

  return `${summary}...`;
}

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

// Function to analyze chat messages and generate short keyword bookmarks (0-10 keywords)
export async function generateBookmarksForChat(chatSessionId: string, userId: string, messages: Message[]): Promise<Bookmark[]> {
  if (!messages || messages.length === 0) return [];

  try {
    // Fetch existing bookmarks for this chat + user
    const existingBookmarks: Bookmark[] = await blink.db.bookmarks.list({
      where: { chatSessionId, userId },
    });

    const existingTitles = existingBookmarks.map(b => b.title);

    // Only analyze user messages for bookmark generation
    const userMessages = messages.filter(msg => msg.role === 'user');
    if (userMessages.length === 0) return [];

    // Combine user messages into a conversation context
    const conversationText = userMessages.map(msg => `User: ${msg.content}`).join('\n\n');

    // If there are no existing bookmarks at all, we still ask the AI for keywords.
    // Build a prompt that includes existing bookmark titles so the AI can decide overlap.
    const prompt = `You are an assistant that extracts concise topic keywords from a conversation.
Given the conversation below, return between 0 and 10 short keywords or short phrases (1-3 words each) that best represent distinct topics discussed.
Also consider the list of existing bookmark folder titles provided. For each keyword you return, indicate if it overlaps an existing bookmark title by returning the exact matching title, or null if it's a new topic.

Return JSON only with a top-level key named "items" which is an array of objects with keys: "keyword" (string) and "match" (string|null).
Do NOT return any extra explanation or text.

Conversation:
${conversationText}

Existing bookmarks:
${existingTitles.length ? existingTitles.join('\n') : '(none)'}

Respond with JSON only.`;

    const response = await blink.ai.generateObject({
      prompt,
      schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                keyword: { type: 'string' },
                match: { type: ['string', 'null'] },
              },
              required: ['keyword'],
            },
          },
        },
        required: ['items'],
      },
    });

    const items: Array<{ keyword: string; match?: string | null }> = (response?.object?.items || []);

    const createdOrUpdated: Bookmark[] = [];

    for (const it of items) {
      const rawKw = (it.keyword || '').trim();
      if (!rawKw) continue;

      const title = rawKw;

      // Find user messages that mention the keyword (simple contains match)
      const relevantMessages = userMessages.filter(msg => msg.content.toLowerCase().includes(rawKw.toLowerCase()));

      // For each relevant user message, find its corresponding AI response to create conversation pairs
      const conversationMessageIds: string[] = [];

      relevantMessages.forEach(userMsg => {
        // Find the index of this user message
        const userMsgIndex = messages.findIndex(msg => msg.id === userMsg.id);
        if (userMsgIndex !== -1) {
          // Add the user message ID
          conversationMessageIds.push(userMsg.id);

          // Look for the AI response that follows this user message
          if (userMsgIndex + 1 < messages.length) {
            const nextMsg = messages[userMsgIndex + 1];
            if (nextMsg.role === 'assistant') {
              conversationMessageIds.push(nextMsg.id);
              console.log(`📚 Added conversation pair: User "${userMsg.content.substring(0, 30)}..." + AI response`);
            }
          } else {
            console.log(`📚 No AI response found for user message: "${userMsg.content.substring(0, 30)}..."`);
          }
        }
      });

      const newMessageIds = conversationMessageIds;
      console.log(`📚 Created bookmark "${title}" with ${conversationMessageIds.length} message IDs:`, conversationMessageIds);

      if (it.match) {
        // AI says this overlaps an existing bookmark title - find it and merge message IDs
        const existing = existingBookmarks.find(b => b.title.toLowerCase() === String(it.match).toLowerCase());
        if (existing) {
          const existingIds = (existing.messageIds || '').split(',').filter(Boolean);

          // Get conversation pairs for new messages
          const newConversationIds = getConversationPairIds(newMessageIds, messages);

          const mergedIds = Array.from(new Set([...existingIds, ...newConversationIds]));
          try {
            await blink.db.bookmarks.update(existing.id, {
              messageIds: mergedIds.join(','),
            });
            const updatedBookmark = { ...existing, messageIds: mergedIds.join(',') };
            createdOrUpdated.push(updatedBookmark);
          } catch (err) {
            console.error('Failed to update existing bookmark', existing.id, err);
          }
          continue;
        }
      }

      // If no match or matching bookmark not found, ensure we don't duplicate by title
      const duplicate = existingBookmarks.find(b => b.title.toLowerCase() === title.toLowerCase());
      if (duplicate) {
        // Merge into duplicate
        const existingIds = (duplicate.messageIds || '').split(',').filter(Boolean);

        // Get conversation pairs for new messages
        const newConversationIds = getConversationPairIds(newMessageIds, messages);

        const mergedIds = Array.from(new Set([...existingIds, ...newConversationIds]));
        try {
          await blink.db.bookmarks.update(duplicate.id, {
            messageIds: mergedIds.join(','),
          });
          const updatedBookmark = { ...duplicate, messageIds: mergedIds.join(',') };
          createdOrUpdated.push(updatedBookmark);
        } catch (err) {
          console.error('Failed to update duplicate bookmark', duplicate.id, err);
        }
        continue;
      }

      // Otherwise create a new bookmark
      const bookmark: Bookmark = {
        id: `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        chatSessionId,
        userId,
        title,
        description: `Auto-generated topic: ${rawKw}`,
        category: rawKw.toLowerCase().replace(/\s+/g, '_'),
        messageIds: newMessageIds.join(','),
        createdAt: new Date().toISOString(),
      };

      try {
        await blink.db.bookmarks.create(bookmark);
        createdOrUpdated.push(bookmark);
      } catch (err) {
        console.error('Failed to save bookmark for keyword', rawKw, err);
      }
    }

    return createdOrUpdated;
  } catch (error) {
    console.error('Failed to generate bookmarks:', error);
    return [];
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

import blink from "../blink/client";
import { Message, Bookmark, EnhancedBookmark, TopicSegment } from "../types";

// Helper function to get conversation pair IDs for a list of message IDs
function getConversationPairIds(
  messageIds: string[],
  allMessages: Message[]
): string[] {
  const conversationIds: string[] = [];

  messageIds.forEach((msgId) => {
    const msgIndex = allMessages.findIndex((msg) => msg.id === msgId);
    if (msgIndex !== -1) {
      const msg = allMessages[msgIndex];
      conversationIds.push(msgId);

      // If it's a user message, add the next message (AI response) if it exists
      if (msg.role === "user" && msgIndex + 1 < allMessages.length) {
        const nextMsg = allMessages[msgIndex + 1];
        if (nextMsg.role === "assistant") {
          conversationIds.push(nextMsg.id);
        }
      }

      // If it's an AI message, add the previous message (user input) if it exists
      if (msg.role === "assistant" && msgIndex > 0) {
        const prevMsg = allMessages[msgIndex - 1];
        if (prevMsg.role === "user") {
          conversationIds.push(prevMsg.id);
        }
      }
    }
  });

  return conversationIds;
}

// Function to check if a message is already bookmarked
function isMessageAlreadyBookmarked(
  messageId: string,
  existingBookmarks: Bookmark[]
): boolean {
  return existingBookmarks.some(
    (bookmark) =>
      bookmark.messageIds && bookmark.messageIds.split(",").includes(messageId)
  );
}

// Function to find the best existing bookmark for a new message
function findBestBookmarkForMessage(
  messageContent: string,
  existingBookmarks: Bookmark[]
): Bookmark | null {
  const messageLower = messageContent.toLowerCase();

  // Find bookmarks that might be related to this message
  const potentialMatches = existingBookmarks.filter((bookmark) => {
    const titleLower = bookmark.title.toLowerCase();
    const descriptionLower = (bookmark.description || "").toLowerCase();

    // Check if the message content contains the bookmark title or vice versa
    return (
      messageLower.includes(titleLower) ||
      titleLower.includes(messageLower) ||
      messageLower.includes(descriptionLower) ||
      descriptionLower.includes(messageLower)
    );
  });

  if (potentialMatches.length === 0) return null;

  // Score potential matches based on relevance
  const scoredMatches = potentialMatches.map((bookmark) => {
    const titleLower = bookmark.title.toLowerCase();
    const descriptionLower = (bookmark.description || "").toLowerCase();

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

    messageWords.forEach((word) => {
      if (
        word.length > 2 &&
        titleWords.some(
          (titleWord) => titleWord.includes(word) || word.includes(titleWord)
        )
      ) {
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
export async function generateBookmarksForChat(
  chatSessionId: string,
  userId: string,
  messages: Message[]
): Promise<Bookmark[]> {
  if (!messages || messages.length === 0) return [];

  try {
    // Fetch existing bookmarks for this chat + user
    const existingBookmarks: Bookmark[] = await blink.db.bookmarks.list({
      where: { chatSessionId, userId },
    });

    // Only analyze user messages that aren't already bookmarked
    const userMessages = messages.filter((msg) => msg.role === "user");
    const newUserMessages = userMessages.filter(
      (msg) => !isMessageAlreadyBookmarked(msg.id, existingBookmarks)
    );

    if (newUserMessages.length === 0) {
      console.log(
        "📚 All messages already bookmarked, no new bookmarks needed"
      );
      return [];
    }

    console.log(
      `📚 Processing ${newUserMessages.length} new user messages for bookmark generation`
    );

    const createdOrUpdated: Bookmark[] = [];

    // Process each new user message individually
    for (const newMessage of newUserMessages) {
      console.log(
        `📚 Processing message: "${newMessage.content.substring(0, 50)}..."`
      );

      // Check if this message fits into an existing bookmark
      const existingBookmark = findBestBookmarkForMessage(
        newMessage.content,
        existingBookmarks
      );

      if (existingBookmark) {
        console.log(
          `📚 Found existing bookmark: "${existingBookmark.title}" for message`
        );
        // Add this message to the existing bookmark
        const existingIds = (existingBookmark.messageIds || "")
          .split(",")
          .filter(Boolean);
        const conversationIds = getConversationPairIds(
          [newMessage.id],
          messages
        );

        // Only add if not already present
        const newIds = conversationIds.filter(
          (id) => !existingIds.includes(id)
        );
        if (newIds.length > 0) {
          const mergedIds = [...existingIds, ...newIds];

          try {
            await blink.db.bookmarks.update(existingBookmark.id, {
              messageIds: mergedIds.join(","),
            });

            const updatedBookmark = {
              ...existingBookmark,
              messageIds: mergedIds.join(","),
            };
            createdOrUpdated.push(updatedBookmark);
            console.log(
              `📚 Added message to existing bookmark: "${existingBookmark.title}"`
            );
          } catch (err) {
            console.error(
              "Failed to update existing bookmark",
              existingBookmark.id,
              err
            );
          }
        } else {
          console.log(
            `📚 Message already present in bookmark: "${existingBookmark.title}"`
          );
        }
        continue;
      }

      console.log(
        `📚 No existing bookmark found, creating new one for message`
      );
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
          type: "object",
          properties: {
            keyword: { type: "string" },
          },
          required: ["keyword"],
        },
      });

      const keyword = response?.object?.keyword?.trim();
      if (!keyword) continue;

      // Check if we already have a bookmark with this exact title
      const duplicate = existingBookmarks.find(
        (b) => b.title.toLowerCase() === keyword.toLowerCase()
      );
      if (duplicate) {
        // Merge into duplicate
        const existingIds = (duplicate.messageIds || "")
          .split(",")
          .filter(Boolean);
        const conversationIds = getConversationPairIds(
          [newMessage.id],
          messages
        );

        // Only add if not already present
        const newIds = conversationIds.filter(
          (id) => !existingIds.includes(id)
        );
        if (newIds.length > 0) {
          const mergedIds = [...existingIds, ...newIds];

          try {
            await blink.db.bookmarks.update(duplicate.id, {
              messageIds: mergedIds.join(","),
            });

            const updatedBookmark = {
              ...duplicate,
              messageIds: mergedIds.join(","),
            };
            createdOrUpdated.push(updatedBookmark);
            console.log(
              `📚 Merged message into existing bookmark: "${duplicate.title}"`
            );
          } catch (err) {
            console.error(
              "Failed to update duplicate bookmark",
              duplicate.id,
              err
            );
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
        category: keyword.toLowerCase().replace(/\s+/g, "_"),
        messageIds: conversationIds.join(","),
        createdAt: new Date().toISOString(),
      };

      try {
        await blink.db.bookmarks.create(bookmark);
        createdOrUpdated.push(bookmark);
        console.log(
          `📚 Created new bookmark: "${keyword}" for message: "${newMessage.content.substring(
            0,
            50
          )}..."`
        );
      } catch (err) {
        console.error("Failed to save bookmark for keyword", keyword, err);
      }
    }

    return createdOrUpdated;
  } catch (error) {
    console.error("Failed to generate bookmarks:", error);
    return [];
  }
}

// Function to clean up duplicate and overlapping bookmarks
export async function cleanupBookmarks(
  chatSessionId: string,
  userId: string
): Promise<void> {
  try {
    const existingBookmarks: Bookmark[] = await blink.db.bookmarks.list({
      where: { chatSessionId, userId },
    });

    if (existingBookmarks.length <= 1) return;

    console.log(
      `🧹 Cleaning up ${existingBookmarks.length} bookmarks for session ${chatSessionId}`
    );

    // Group bookmarks by similar titles (case-insensitive)
    const titleGroups = new Map<string, Bookmark[]>();

    existingBookmarks.forEach((bookmark) => {
      const titleLower = bookmark.title.toLowerCase();
      if (!titleGroups.has(titleLower)) {
        titleGroups.set(titleLower, []);
      }
      titleGroups.get(titleLower)!.push(bookmark);
    });

    // Merge bookmarks with identical titles
    for (const [titleLower, bookmarks] of titleGroups) {
      if (bookmarks.length > 1) {
        console.log(
          `🧹 Merging ${bookmarks.length} bookmarks with title: "${titleLower}"`
        );

        // Keep the first bookmark and merge message IDs from others
        const primaryBookmark = bookmarks[0];
        const allMessageIds = new Set<string>();

        bookmarks.forEach((bookmark) => {
          if (bookmark.messageIds) {
            bookmark.messageIds
              .split(",")
              .filter(Boolean)
              .forEach((id) => allMessageIds.add(id));
          }
        });

        // Update primary bookmark with merged message IDs
        await blink.db.bookmarks.update(primaryBookmark.id, {
          messageIds: Array.from(allMessageIds).join(","),
        });

        // Delete duplicate bookmarks
        for (let i = 1; i < bookmarks.length; i++) {
          await blink.db.bookmarks.delete(bookmarks[i].id);
        }
      }
    }

    console.log(`🧹 Cleanup completed for session ${chatSessionId}`);
  } catch (error) {
    console.error("Failed to cleanup bookmarks:", error);
  }
}

// Function to get messages for a specific bookmark category
export function getMessagesForBookmark(
  bookmark: Bookmark,
  allMessages: Message[]
): Message[] {
  if (!bookmark.messageIds) return [];

  const messageIds = bookmark.messageIds.split(",");
  return allMessages.filter((msg) => messageIds.includes(msg.id));
}

// Function to generate a summary for the first message (for folder names)
export function generateChatSummary(firstMessage: string): string {
  if (firstMessage.length <= 50) return firstMessage;

  const words = firstMessage.split(" ");
  let summary = "";

  for (const word of words) {
    if ((summary + word).length > 47) break;
    summary += (summary ? " " : "") + word;
  }

  return `${summary}...`;
}

// Simulated ConvNTM (Conversational Neural Topic Model) functionality
// In production, this would call an actual ML model API
export function detectTopicSegments(messages: Message[]): TopicSegment[] {
  const segments: TopicSegment[] = [];
  let currentSegmentStart = 0;

  // Simulated topic detection based on content patterns and conversation flow
  const topicKeywords = {
    technical: [
      "code",
      "function",
      "api",
      "database",
      "server",
      "implementation",
      "bug",
      "error",
    ],
    design: [
      "ui",
      "ux",
      "design",
      "layout",
      "component",
      "interface",
      "visual",
      "color",
    ],
    planning: [
      "plan",
      "strategy",
      "roadmap",
      "timeline",
      "milestone",
      "goal",
      "objective",
    ],
    research: [
      "research",
      "analysis",
      "study",
      "investigation",
      "explore",
      "examine",
    ],
    general: [
      "help",
      "question",
      "problem",
      "solution",
      "advice",
      "suggestion",
    ],
  };

  for (let i = 1; i < messages.length; i++) {
    const currentMsg = messages[i];
    const prevMsg = messages[i - 1];

    // Simple topic shift detection based on keyword analysis
    const currentTopics = detectMessageTopics(
      currentMsg.content,
      topicKeywords
    );
    const prevTopics = detectMessageTopics(prevMsg.content, topicKeywords);

    // Detect topic shift (simplified heuristic)
    const topicShift = calculateTopicShift(currentTopics, prevTopics);

    if (topicShift > 0.6 || i - currentSegmentStart > 10) {
      // Topic shift threshold or max segment length
      // Create segment for previous topic
      const segmentMessages = messages.slice(currentSegmentStart, i);
      const dominantTopic = getDominantTopic(segmentMessages, topicKeywords);

      segments.push({
        id: `segment-${segments.length + 1}`,
        chatSessionId: messages[0]?.chatSessionId || "",
        startMessageId: messages[currentSegmentStart].id,
        endMessageId: messages[i - 1].id,
        title: generateSegmentTitle(segmentMessages, dominantTopic),
        summary: generateSegmentSummary(segmentMessages),
        topicScore: 1 - topicShift, // Inverse of shift for confidence
        messageCount: segmentMessages.length,
        createdAt: new Date().toISOString(),
      });

      currentSegmentStart = i;
    }
  }

  // Add final segment
  if (currentSegmentStart < messages.length) {
    const segmentMessages = messages.slice(currentSegmentStart);
    const dominantTopic = getDominantTopic(segmentMessages, topicKeywords);

    segments.push({
      id: `segment-${segments.length + 1}`,
      chatSessionId: messages[0]?.chatSessionId || "",
      startMessageId: messages[currentSegmentStart].id,
      endMessageId: messages[messages.length - 1].id,
      title: generateSegmentTitle(segmentMessages, dominantTopic),
      summary: generateSegmentSummary(segmentMessages),
      topicScore: 0.8, // Default confidence for final segment
      messageCount: segmentMessages.length,
      createdAt: new Date().toISOString(),
    });
  }

  return segments;
}

function detectMessageTopics(
  content: string,
  topicKeywords: Record<string, string[]>
): Record<string, number> {
  const topics: Record<string, number> = {};
  const contentLower = content.toLowerCase();

  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    const matches = keywords.filter((keyword) =>
      contentLower.includes(keyword)
    ).length;
    topics[topic] = matches / keywords.length; // Normalized score
  });

  return topics;
}

function calculateTopicShift(
  current: Record<string, number>,
  previous: Record<string, number>
): number {
  const topics = new Set([...Object.keys(current), ...Object.keys(previous)]);
  let totalDifference = 0;

  topics.forEach((topic) => {
    const curr = current[topic] || 0;
    const prev = previous[topic] || 0;
    totalDifference += Math.abs(curr - prev);
  });

  return totalDifference / topics.size;
}

function getDominantTopic(
  messages: Message[],
  topicKeywords: Record<string, string[]>
): string {
  const topicScores: Record<string, number> = {};

  messages.forEach((msg) => {
    const topics = detectMessageTopics(msg.content, topicKeywords);
    Object.entries(topics).forEach(([topic, score]) => {
      topicScores[topic] = (topicScores[topic] || 0) + score;
    });
  });

  return (
    Object.entries(topicScores).reduce((a, b) =>
      topicScores[a[0]] > topicScores[b[0]] ? a : b
    )[0] || "general"
  );
}

function generateSegmentTitle(
  _messages: Message[],
  dominantTopic: string
): string {
  const topicTitles: Record<string, string[]> = {
    technical: [
      "Technical Implementation",
      "Code Discussion",
      "Development Issues",
      "API Integration",
    ],
    design: [
      "Design Review",
      "UI/UX Discussion",
      "Interface Planning",
      "Visual Design",
    ],
    planning: [
      "Project Planning",
      "Strategy Discussion",
      "Roadmap Planning",
      "Goal Setting",
    ],
    research: [
      "Research Findings",
      "Analysis Review",
      "Investigation Results",
      "Study Discussion",
    ],
    general: [
      "General Discussion",
      "Q&A Session",
      "Problem Solving",
      "Consultation",
    ],
  };

  const titles = topicTitles[dominantTopic] || topicTitles.general;
  return titles[Math.floor(Math.random() * titles.length)];
}

function generateSegmentSummary(messages: Message[]): string {
  // Simple extractive summarization - take the first user question or key statement
  const userMessages = messages.filter((msg) => msg.role === "user");
  if (userMessages.length > 0) {
    return (
      userMessages[0].content.slice(0, 150) +
      (userMessages[0].content.length > 150 ? "..." : "")
    );
  }
  return `Discussion covering ${messages.length} messages`;
}

// Enhanced bookmark generation with topic segmentation
export async function generateEnhancedBookmarksForChat(
  chatSessionId: string,
  messages: Message[]
): Promise<EnhancedBookmark[]> {
  // First detect topic segments
  const topicSegments = detectTopicSegments(messages);

  // Generate bookmarks at segment boundaries and key moments
  const enhancedBookmarks: EnhancedBookmark[] = [];

  topicSegments.forEach((segment, index) => {
    const segmentStartIndex = messages.findIndex(
      (msg) => msg.id === segment.startMessageId
    );
    const conversationProgress =
      segmentStartIndex / Math.max(messages.length - 1, 1);

    // Create bookmark for each significant topic segment
    enhancedBookmarks.push({
      id: `enhanced-bookmark-${index + 1}`,
      chatSessionId,
      userId: "mock-user", // Would be actual user ID
      title: segment.title,
      description: segment.summary,
      category: getDominantTopicCategory(segment.title),
      messageIds: `${segment.startMessageId},${segment.endMessageId}`,
      createdAt: new Date(
        Date.now() - (topicSegments.length - index) * 60000
      ).toISOString(), // Staggered times
      topicSegmentId: segment.id,
      messagePosition: segmentStartIndex,
      conversationProgress,
      segmentContext: segment,
      relatedMessages: messages
        .slice(segmentStartIndex, segmentStartIndex + segment.messageCount)
        .map((msg) => msg.id),
    });
  });

  // Add some additional bookmarks at key conversation moments
  const keyMoments = detectKeyMoments(messages);
  keyMoments.forEach((moment, index) => {
    enhancedBookmarks.push({
      id: `key-moment-${index + 1}`,
      chatSessionId,
      userId: "mock-user",
      title: moment.title,
      description: moment.description,
      category: "key-moment",
      messageIds: moment.messageId,
      createdAt: new Date(
        Date.now() - (keyMoments.length - index) * 30000
      ).toISOString(),
      messagePosition: moment.messageIndex,
      conversationProgress:
        moment.messageIndex / Math.max(messages.length - 1, 1),
      relatedMessages: [moment.messageId],
    });
  });

  return enhancedBookmarks.sort(
    (a, b) => a.messagePosition - b.messagePosition
  );
}

function getDominantTopicCategory(title: string): string {
  const titleLower = title.toLowerCase();
  if (
    titleLower.includes("technical") ||
    titleLower.includes("code") ||
    titleLower.includes("development")
  ) {
    return "Development";
  } else if (
    titleLower.includes("design") ||
    titleLower.includes("ui") ||
    titleLower.includes("interface")
  ) {
    return "Design";
  } else if (
    titleLower.includes("planning") ||
    titleLower.includes("strategy") ||
    titleLower.includes("roadmap")
  ) {
    return "Planning";
  } else if (
    titleLower.includes("research") ||
    titleLower.includes("analysis")
  ) {
    return "Research";
  }
  return "General";
}

interface KeyMoment {
  messageId: string;
  messageIndex: number;
  title: string;
  description: string;
}

function detectKeyMoments(messages: Message[]): KeyMoment[] {
  const keyMoments: KeyMoment[] = [];

  messages.forEach((message, index) => {
    const content = message.content.toLowerCase();

    // Detect questions
    if (content.includes("?") && message.role === "user") {
      keyMoments.push({
        messageId: message.id,
        messageIndex: index,
        title: "Important Question",
        description: message.content.slice(0, 100) + "...",
      });
    }

    // Detect decisions or conclusions
    if (
      (content.includes("decided") ||
        content.includes("conclusion") ||
        content.includes("solution")) &&
      message.role === "assistant"
    ) {
      keyMoments.push({
        messageId: message.id,
        messageIndex: index,
        title: "Key Decision Point",
        description: message.content.slice(0, 100) + "...",
      });
    }

    // Detect code or technical explanations
    if (
      content.includes("```") ||
      (content.includes("function") && content.includes("{"))
    ) {
      keyMoments.push({
        messageId: message.id,
        messageIndex: index,
        title: "Code Example",
        description: "Technical implementation or code sample",
      });
    }
  });

  // Limit to most significant moments (max 5)
  return keyMoments.slice(0, 5);
}

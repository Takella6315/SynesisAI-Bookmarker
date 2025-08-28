import blink from "../blink/client";
import { Message, Bookmark, EnhancedBookmark, TopicSegment } from "../types";

// Simple cache to avoid re-processing the same conversations
const topicSegmentCache = new Map<
  string,
  { segments: TopicSegment[]; messageCount: number; lastGenerated: number }
>();
const CACHE_EXPIRY = 30000; // 30 seconds

// LLM-based topic segmentation for accurate conversation analysis
async function generateTopicSegmentsWithLLM(
  messages: Message[]
): Promise<TopicSegment[]> {
  console.log(
    `🤖 Starting LLM topic segmentation for ${messages.length} messages`
  );

  if (messages.length < 2) {
    console.log(
      `🤖 Too few messages (${messages.length}), skipping LLM analysis`
    );
    return [];
  }

  // Create cache key based on message content and count
  const cacheKey = `${messages[0]?.chatSessionId || "unknown"}-${
    messages.length
  }`;
  const cachedResult = topicSegmentCache.get(cacheKey);

  // Check if we have a recent cached result for the same conversation
  if (cachedResult && Date.now() - cachedResult.lastGenerated < CACHE_EXPIRY) {
    console.log(
      `🧠 Using cached topic segments (${
        cachedResult.segments.length
      } segments) - cache age: ${Math.round(
        (Date.now() - cachedResult.lastGenerated) / 1000
      )}s`
    );
    return cachedResult.segments;
  }

  try {
    // Check cache first
    const cacheKey = messages.map((msg) => msg.content).join("|");
    const cached = topicSegmentCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.lastGenerated < CACHE_EXPIRY) {
      console.log("🗄️ Using cached topic segments");
      return cached.segments;
    }

    // Prepare conversation text for analysis (limit to recent messages to avoid token limits)
    const maxMessages = Math.min(20, messages.length); // Limit to last 20 messages or total messages if fewer
    const recentMessages = messages.slice(-maxMessages);
    const messageOffset = messages.length - maxMessages; // Offset to adjust indices back to full array

    const conversationText = recentMessages
      .map(
        (msg, index) =>
          `[${index}] ${msg.role.toUpperCase()}: ${msg.content.substring(
            0,
            200
          )}${msg.content.length > 200 ? "..." : ""}`
      )
      .join("\n\n");

    const prompt = `You are a conversation analyst. Analyze this conversation and identify distinct topic segments, especially focusing on programming, code, and technical discussions.

IMPORTANT: The conversation has ${maxMessages} messages indexed from 0 to ${
      maxMessages - 1
    }. Your startIndex and endIndex must be within this range.

Conversation:
${conversationText}

Your task: Identify topic segments where the conversation shifts to a different subject, programming concept, or problem area.

IMPORTANT: You must respond with ONLY valid JSON in exactly this format, no additional text:

{
  "segments": [
    {
      "startIndex": 0,
      "endIndex": 2,
      "title": "React Component Setup",
      "summary": "Discussion about setting up React components and props handling",
      "confidence": 0.85
    }
  ]
}

Guidelines:
- Message indices must be between 0 and ${maxMessages - 1}
- startIndex must be <= endIndex
- ALWAYS return at least 1 segment for conversations with 4+ messages
- If no topic shifts, use descriptive titles based on ACTUAL CONTENT concepts (avoid generic terms like "Topic 1", "Discussion", "Concepts")
- Minimum segment length: 2 messages (1 exchange)
- Maximum segment length: ${Math.min(20, maxMessages)} messages  
- Focus on meaningful topic shifts, but create segments even for single-topic conversations
- Programming concepts should be treated as distinct topics
- Error discussions vs feature discussions should be separate segments
- Titles should be 2-6 words maximum, descriptive of the SPECIFIC content being discussed
- Summaries should be 8-20 words maximum
- Confidence should be 0.0-1.0
- USE SPECIFIC TERMS from the actual conversation content, not generic placeholders

CRITICAL: Titles must reflect the actual concepts, technologies, or subjects mentioned in the messages. Examples:
- Good: "useState Hook", "Database Schema", "CSS Flexbox", "Authentication Logic"
- Bad: "Programming Concepts", "Technical Discussion", "Problem Solving", "General Topic"

IMPORTANT: You MUST always return at least one segment for any conversation with 4+ messages. Even if the topic doesn't change much, create logical segments based on conversation flow using SPECIFIC content terms.

Respond with ONLY the JSON object, no other text.`;

    // Use streamText but collect the full response
    let fullResponse = "";
    console.log(
      `🤖 Sending conversation to LLM for topic analysis (${messages.length} messages)`
    );

    try {
      await blink.ai.streamText(
        {
          prompt,
          model: "gpt-4o-mini",
          maxTokens: 1000,
        },
        (chunk) => {
          fullResponse += chunk;
        }
      );
      console.log(
        `🤖 LLM call completed successfully, response length: ${fullResponse.length}`
      );
    } catch (streamError) {
      console.error("🚨 LLM streamText call failed:", streamError);
      throw streamError;
    }

    console.log(`🤖 LLM raw response:`, fullResponse);

    // Clean up the response to extract JSON
    let jsonResponse = fullResponse.trim();

    // Sometimes LLM adds extra text before/after JSON, try to extract just the JSON
    const jsonStart = jsonResponse.indexOf("{");
    const jsonEnd = jsonResponse.lastIndexOf("}");

    if (jsonStart !== -1 && jsonEnd !== -1) {
      jsonResponse = jsonResponse.substring(jsonStart, jsonEnd + 1);
    }

    console.log(`🤖 Extracted JSON:`, jsonResponse);

    // Parse LLM response
    const analysisResult = JSON.parse(jsonResponse);
    console.log(`🤖 Parsed analysis result:`, analysisResult);
    console.log(
      `🤖 Number of segments in response:`,
      analysisResult.segments?.length || 0
    );

    const segments: TopicSegment[] = [];

    if (analysisResult.segments && Array.isArray(analysisResult.segments)) {
      analysisResult.segments.forEach((segment: any, index: number) => {
        // Validate segment indices first
        if (
          typeof segment.startIndex !== "number" ||
          typeof segment.endIndex !== "number" ||
          segment.startIndex < 0 ||
          segment.endIndex < 0 ||
          segment.startIndex > segment.endIndex
        ) {
          console.warn(
            `🤖 Skipping segment with invalid indices:`,
            segment.startIndex,
            "->",
            segment.endIndex
          );
          return;
        }

        // Clamp indices to valid range instead of rejecting
        const clampedStartIndex = Math.max(
          0,
          Math.min(segment.startIndex, maxMessages - 1)
        );
        const clampedEndIndex = Math.max(
          clampedStartIndex,
          Math.min(segment.endIndex, maxMessages - 1)
        );

        // Adjust indices to match the full message array
        const adjustedStartIndex = messageOffset + clampedStartIndex;
        const adjustedEndIndex = messageOffset + clampedEndIndex;

        // Final bounds check
        if (
          adjustedStartIndex < 0 ||
          adjustedEndIndex < 0 ||
          adjustedStartIndex >= messages.length ||
          adjustedEndIndex >= messages.length
        ) {
          console.warn(
            `🤖 Adjusted indices still out of bounds:`,
            adjustedStartIndex,
            "->",
            adjustedEndIndex,
            "total messages:",
            messages.length
          );
          return;
        }

        const startMsg = messages[adjustedStartIndex];
        const endMsg = messages[adjustedEndIndex];

        if (startMsg && endMsg && segment.title && segment.summary) {
          if (
            clampedStartIndex !== segment.startIndex ||
            clampedEndIndex !== segment.endIndex
          ) {
            console.log(
              `🤖 Clamped segment "${segment.title}" indices from ${segment.startIndex}-${segment.endIndex} to ${clampedStartIndex}-${clampedEndIndex}`
            );
          }
          console.log(
            `🤖 Creating segment "${segment.title}" at messages ${adjustedStartIndex}-${adjustedEndIndex} (${clampedStartIndex}-${clampedEndIndex} in analyzed slice)`
          );
          segments.push({
            id: `segment-${index + 1}`,
            chatSessionId: messages[0]?.chatSessionId || "",
            startMessageId: startMsg.id,
            endMessageId: endMsg.id,
            title: segment.title,
            summary: segment.summary,
            topicScore: segment.confidence || 0.7,
            messageCount: adjustedEndIndex - adjustedStartIndex + 1,
            createdAt: new Date().toISOString(),
          });
        } else {
          console.warn(`🤖 Skipping segment with missing data:`, segment);
        }
      });
    } else {
      throw new Error("Invalid response format: missing segments array");
    }

    console.log(
      `🧠 LLM generated ${segments.length} topic segments:`,
      segments.map((s) => s.title)
    );

    // Update cache with the new results
    topicSegmentCache.set(cacheKey, {
      segments,
      messageCount: messages.length,
      lastGenerated: Date.now(),
    });

    return segments;
  } catch (error) {
    console.error(
      "LLM topic segmentation failed, falling back to rule-based:",
      error
    );
    // Fallback to the existing simulated logic
    return detectTopicSegmentsRuleBased(messages);
  }
}

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

// LLM-based ConvNTM replacement for accurate topic segmentation
export async function detectTopicSegments(
  messages: Message[]
): Promise<TopicSegment[]> {
  console.log(`🧠 Detecting topic segments for ${messages.length} messages`);

  // Try LLM-based segmentation first
  try {
    const segments = await generateTopicSegmentsWithLLM(messages);
    console.log(`🧠 LLM returned ${segments.length} segments`);
    if (segments.length > 0) {
      console.log(
        `✅ LLM generated ${segments.length} segments:`,
        segments.map(
          (s, i) =>
            `${i + 1}. "${s.title}" (msgs ${messages.findIndex(
              (m) => m.id === s.startMessageId
            )}-${messages.findIndex((m) => m.id === s.endMessageId)})`
        )
      );
      return segments;
    } else {
      console.warn("🚨 LLM returned 0 segments, falling back to rule-based");
    }
  } catch (error) {
    console.error("🚨 LLM segmentation failed:", error);
  }

  // Fallback to rule-based
  console.log("📋 Falling back to rule-based segmentation");
  const segments = detectTopicSegmentsRuleBased(messages);
  console.log(
    `📋 Rule-based generated ${segments.length} segments:`,
    segments.map(
      (s, i) =>
        `${i + 1}. "${s.title}" (msgs ${messages.findIndex(
          (m) => m.id === s.startMessageId
        )}-${messages.findIndex((m) => m.id === s.endMessageId)})`
    )
  );
  return segments;
}

// Fallback rule-based segmentation for when LLM fails
function detectTopicSegmentsRuleBased(messages: Message[]): TopicSegment[] {
  const segments: TopicSegment[] = [];

  // Simple fallback: create segments based on conversation flow
  const segmentSize = Math.min(Math.max(Math.floor(messages.length / 3), 2), 8);

  for (let i = 0; i < messages.length; i += segmentSize) {
    const endIndex = Math.min(i + segmentSize, messages.length);
    const segmentMessages = messages.slice(i, endIndex);

    if (segmentMessages.length >= 2) {
      // Try to generate a meaningful title based on content
      const title = generateMeaningfulTitle(segmentMessages, segments.length);
      const summary = generateMeaningfulSummary(segmentMessages);

      segments.push({
        id: `fallback-segment-${segments.length + 1}`,
        chatSessionId: messages[0]?.chatSessionId || "",
        startMessageId: segmentMessages[0].id,
        endMessageId: segmentMessages[segmentMessages.length - 1].id,
        title,
        summary,
        topicScore: 0.6, // Default confidence for fallback
        messageCount: segmentMessages.length,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return segments;
}

function generateMeaningfulTitle(
  messages: Message[],
  segmentIndex: number
): string {
  console.log(
    `🔖 Generating meaningful title for segment ${segmentIndex + 1} with ${
      messages.length
    } messages`
  );

  // Extract actual content from the messages, prioritizing user questions and main topics
  const userMessages = messages.filter((msg) => msg.role === "user");
  const assistantMessages = messages.filter((msg) => msg.role === "assistant");

  // First try: Extract from user questions (highest priority)
  if (userMessages.length > 0) {
    const firstUserMsg = userMessages[0].content;
    console.log(
      `🔍 Analyzing user message: "${firstUserMsg.substring(0, 100)}..."`
    );

    if (firstUserMsg.includes("?")) {
      const questionTitle = generateQuestionTitle(firstUserMsg);
      if (
        !questionTitle.includes("Question about") &&
        questionTitle.length > 10
      ) {
        console.log(`✅ Using question-based title: "${questionTitle}"`);
        return questionTitle;
      }
    }

    // Extract meaningful content from first user message
    const contentTitle = extractContentBasedTitle(firstUserMsg);
    if (contentTitle && contentTitle.length > 5) {
      console.log(`✅ Using content-based title: "${contentTitle}"`);
      return contentTitle;
    }
  }

  // Second try: Extract from assistant responses
  if (assistantMessages.length > 0) {
    const firstAssistantMsg = assistantMessages[0].content;
    const contentTitle = extractContentBasedTitle(firstAssistantMsg);
    if (contentTitle && contentTitle.length > 5) {
      console.log(`✅ Using assistant content title: "${contentTitle}"`);
      return contentTitle;
    }
  }

  // Third try: Extract from any message content
  for (const message of messages) {
    const contentTitle = extractContentBasedTitle(message.content);
    if (contentTitle && contentTitle.length > 5) {
      console.log(`✅ Using any message content title: "${contentTitle}"`);
      return contentTitle;
    }
  }

  // Final fallback: use actual words from the conversation
  const allWords = messages
    .map((msg) => msg.content)
    .join(" ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 3 &&
        ![
          "this",
          "that",
          "with",
          "from",
          "they",
          "have",
          "been",
          "will",
          "would",
          "could",
          "should",
        ].includes(word.toLowerCase())
    )
    .slice(0, 4)
    .join(" ");

  if (allWords.length > 0) {
    console.log(
      `⚠️ Using fallback with actual words: "Discussion: ${allWords}"`
    );
    return `Discussion: ${allWords}`;
  }

  console.log(
    `⚠️ All methods failed, using generic title for segment ${segmentIndex + 1}`
  );
  return `Conversation Part ${segmentIndex + 1}`;
}

// New helper function to extract content-based titles
function extractContentBasedTitle(content: string): string | null {
  // Remove common prefixes and clean the content
  const cleanContent = content
    .replace(
      /^(well|so|the|in|conclusion|to summarize|basically|essentially|yes|no|sure|okay|alright|let me|i can|here's|this is)/i,
      ""
    )
    .trim();

  // Look for specific technologies, concepts, or subjects mentioned
  const words = cleanContent
    .split(/\s+/)
    .filter((word) => {
      const w = word.toLowerCase();
      return (
        word.length > 2 &&
        ![
          "the",
          "and",
          "but",
          "for",
          "are",
          "you",
          "can",
          "this",
          "that",
          "with",
          "from",
          "they",
          "have",
          "will",
          "been",
          "were",
          "what",
          "when",
          "where",
          "why",
          "how",
          "would",
          "could",
          "should",
          "might",
          "must",
          "shall",
          "may",
          "does",
          "did",
        ].includes(w)
      );
    })
    .slice(0, 6)
    .join(" ");

  if (words.length > 5) {
    return words;
  }

  // Try to extract first meaningful sentence
  const sentences = cleanContent.split(/[.!?]/);
  if (sentences.length > 0 && sentences[0].trim().length > 10) {
    const firstSentence = sentences[0].trim();
    const sentenceWords = firstSentence.split(/\s+/).slice(0, 8).join(" ");
    if (sentenceWords.length > 5) {
      return sentenceWords;
    }
  }

  return null;
}

function generateMeaningfulSummary(messages: Message[]): string {
  const userMessages = messages.filter((msg) => msg.role === "user");
  if (userMessages.length > 0) {
    const content = userMessages[0].content;
    // Take first sentence or first 100 characters
    const firstSentence = content.split(/[.!?]/)[0];
    return firstSentence.length > 100
      ? content.slice(0, 100) + "..."
      : firstSentence +
          (content.includes(".") ||
          content.includes("!") ||
          content.includes("?")
            ? ""
            : "...");
  }
  return `Discussion covering ${messages.length} messages`;
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
  // Need at least 2 messages (user + assistant) to generate meaningful bookmarks
  if (messages.length < 2) {
    return [];
  }

  // First detect topic segments using LLM
  const topicSegments = await detectTopicSegments(messages);

  // Generate bookmarks at segment boundaries and key moments
  const enhancedBookmarks: EnhancedBookmark[] = [];

  topicSegments.forEach((segment, index) => {
    const segmentStartIndex = messages.findIndex(
      (msg) => msg.id === segment.startMessageId
    );

    // Ensure we have a valid message index
    if (segmentStartIndex === -1) {
      console.warn(
        `🤖 Could not find start message for segment "${segment.title}", skipping`
      );
      return;
    }

    const conversationProgress =
      segmentStartIndex / Math.max(messages.length - 1, 1);

    console.log(
      `🤖 Creating enhanced bookmark "${
        segment.title
      }" at message ${segmentStartIndex}/${messages.length} (${Math.round(
        conversationProgress * 100
      )}%)`
    );

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
      keywords: moment.keywords,
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
  keywords: string[];
}

function detectKeyMoments(messages: Message[]): KeyMoment[] {
  const keyMoments: KeyMoment[] = [];

  messages.forEach((message, index) => {
    const content = message.content.toLowerCase();
    const originalContent = message.content;

    // Detect questions
    if (content.includes("?") && message.role === "user") {
      const title = generateQuestionTitle(originalContent);
      keyMoments.push({
        messageId: message.id,
        messageIndex: index,
        title,
        description: originalContent.slice(0, 100) + "...",
        keywords: ["Important Question", "Q&A"],
      });
    }

    // Detect decisions or conclusions
    if (
      (content.includes("decided") ||
        content.includes("conclusion") ||
        content.includes("solution")) &&
      message.role === "assistant"
    ) {
      const title = generateDecisionTitle(originalContent);
      keyMoments.push({
        messageId: message.id,
        messageIndex: index,
        title,
        description: originalContent.slice(0, 100) + "...",
        keywords: ["Key Decision Point", "Solution"],
      });
    }

    // Detect code or technical explanations
    if (
      content.includes("```") ||
      (content.includes("function") && content.includes("{"))
    ) {
      const title = generateCodeTitle(originalContent);
      keyMoments.push({
        messageId: message.id,
        messageIndex: index,
        title,
        description: "Technical implementation or code sample",
        keywords: ["Code Example", "Technical"],
      });
    }
  });

  // Limit to most significant moments (max 5)
  return keyMoments.slice(0, 5);
}

function generateQuestionTitle(content: string): string {
  const contentLower = content.toLowerCase();

  // Extract the main subject of the question
  if (contentLower.includes("how") && contentLower.includes("?")) {
    // "How to..." questions
    const match = content.match(/how\s+(?:do|can|to)\s+\w+\s+([^?]+)/i);
    if (match) {
      const subject = match[1].trim().split(/\s+/).slice(0, 8).join(" ");
      return `How to ${subject}`;
    }
    return "How-to Question";
  }

  if (contentLower.includes("what") && contentLower.includes("?")) {
    // "What is..." questions
    const match = content.match(/what\s+(?:is|are|does|do)\s+([^?]+)/i);
    if (match) {
      const subject = match[1].trim().split(/\s+/).slice(0, 8).join(" ");
      return `What is ${subject}`;
    }
    return extractMainTopic(content, "What about");
  }

  if (contentLower.includes("why") && contentLower.includes("?")) {
    // "Why..." questions
    const match = content.match(
      /why\s+(?:is|are|does|do|would|should)?\s*([^?]+)/i
    );
    if (match) {
      const subject = match[1].trim().split(/\s+/).slice(0, 8).join(" ");
      return `Why ${subject}`;
    }
    return extractMainTopic(content, "Why");
  }

  if (contentLower.includes("can") && contentLower.includes("?")) {
    // "Can..." questions
    const match = content.match(/can\s+(?:you|i|we)?\s*([^?]+)/i);
    if (match) {
      const subject = match[1].trim().split(/\s+/).slice(0, 8).join(" ");
      return `Can ${subject}`;
    }
    return extractMainTopic(content, "Can");
  }

  // Handle "Are the..." questions
  if (contentLower.includes("are") && contentLower.includes("?")) {
    const match = content.match(/are\s+(?:the|there)?\s*([^?]+)/i);
    if (match) {
      const subject = match[1].trim().split(/\s+/).slice(0, 8).join(" ");
      return `Are ${subject}`;
    }
    return extractMainTopic(content, "Are");
  }

  // Handle "Is the..." questions
  if (contentLower.includes("is") && contentLower.includes("?")) {
    const match = content.match(/is\s+(?:the|there)?\s*([^?]+)/i);
    if (match) {
      const subject = match[1].trim().split(/\s+/).slice(0, 8).join(" ");
      return `Is ${subject}`;
    }
    return extractMainTopic(content, "Is");
  }

  // Generic question - try to extract first meaningful words up to the question mark
  const questionText = content.split("?")[0].trim();
  const words = questionText.split(/\s+/).slice(0, 10).join(" ");
  const cleanWords = words.replace(/[!.,]/g, "").trim();
  return cleanWords.length > 0
    ? `Question: ${cleanWords}`
    : extractMainTopic(content, "Question about");
}

function generateDecisionTitle(content: string): string {
  const contentLower = content.toLowerCase();

  if (contentLower.includes("solution")) {
    // Extract what the solution is about
    const match = content.match(
      /(?:solution|solve)\s+(?:is|to|for)?\s*([^.!]+)/i
    );
    if (match) {
      const subject = match[1].trim().split(/\s+/).slice(0, 10).join(" ");
      return `Solution: ${subject}`;
    }
    // Fallback: extract main topic from the content
    return extractMainTopic(content, "Solution");
  }

  if (contentLower.includes("decided")) {
    // Extract what was decided
    const match = content.match(/decided\s+(?:to|on|that)?\s*([^.!]+)/i);
    if (match) {
      const subject = match[1].trim().split(/\s+/).slice(0, 10).join(" ");
      return `Decision: ${subject}`;
    }
    // Fallback: extract main topic from the content
    return extractMainTopic(content, "Decision");
  }

  if (contentLower.includes("conclusion")) {
    // Extract what the conclusion is about
    const match = content.match(/conclusion\s+(?:is|that)?\s*([^.!]+)/i);
    if (match) {
      const subject = match[1].trim().split(/\s+/).slice(0, 10).join(" ");
      return `Conclusion: ${subject}`;
    }
    // Fallback: extract main topic from the content
    return extractMainTopic(content, "Conclusion");
  }

  // Generic decision point - take first sentence or reasonable chunk
  const sentences = content.split(/[.!]/);
  const firstSentence = sentences[0].trim();
  const words = firstSentence.split(/\s+/).slice(0, 12).join(" ");
  const cleanWords = words.replace(/[,]/g, "").trim();
  return `Decision: ${cleanWords}`;
}

function extractMainTopic(content: string, prefix: string): string {
  // Remove common filler words and try to extract meaningful content
  const cleanContent = content
    .replace(
      /^(well|so|the|in|conclusion|to summarize|basically|essentially|yes|no|sure|okay|alright)/i,
      ""
    )
    .trim();

  console.log(
    `🔍 Extracting topic from content: "${cleanContent.substring(0, 100)}..."`
  );

  // First try: extract first meaningful sentence or phrase
  const sentences = cleanContent.split(/[.!?]/);
  if (sentences.length > 0 && sentences[0].trim().length > 10) {
    const firstSentence = sentences[0].trim();
    // Remove prefix words that might be repetitive
    const cleanSentence = firstSentence
      .replace(/^(the|a|an|this|that|it|they|you|we|i)\s+/i, "")
      .trim();

    // Take up to 10 words to capture more context
    const words = cleanSentence.split(/\s+/).slice(0, 10).join(" ");
    if (words.length > 3) {
      console.log(`📝 Using first sentence approach: "${prefix}: ${words}"`);
      return `${prefix}: ${words}`;
    }
  }

  // Second try: extract key concepts and nouns from the content
  const words = cleanContent
    .split(/\s+/)
    .filter((word) => {
      const w = word.toLowerCase();
      return (
        word.length > 2 &&
        // More lenient filtering - keep more meaningful words
        ![
          "the",
          "and",
          "but",
          "for",
          "are",
          "you",
          "can",
          "this",
          "that",
          "with",
          "from",
          "they",
          "have",
          "will",
          "been",
          "were",
          "what",
          "when",
          "where",
          "why",
          "how",
          "would",
          "could",
          "should",
          "might",
          "must",
          "shall",
          "may",
          "does",
          "did",
          "then",
          "than",
          "also",
          "just",
          "very",
          "more",
          "some",
          "any",
          "all",
        ].includes(w)
      );
    })
    .slice(0, 8) // Take more words to capture concepts better
    .join(" ");

  if (words.length > 3) {
    console.log(`📝 Using keyword extraction: "${prefix}: ${words}"`);
    return `${prefix}: ${words}`;
  }

  // Third try: use more context from the original content
  const contentWords = cleanContent
    .split(/\s+/)
    .filter((word) => word.length > 1) // Less aggressive filtering
    .slice(0, 6)
    .join(" ");

  if (contentWords.length > 0) {
    console.log(
      `📝 Using content words fallback: "${prefix}: ${contentWords}"`
    );
    return `${prefix}: ${contentWords}`;
  }

  // Final fallback: use actual content instead of generic terms
  const finalWords = content.split(/\s+/).slice(0, 4).join(" ");
  if (finalWords.length > 0) {
    console.log(
      `📝 Using final fallback with actual content: "${prefix}: ${finalWords}"`
    );
    return `${prefix}: ${finalWords}`;
  }

  console.log(`⚠️ All extraction methods failed, using generic fallback`);
  return `${prefix}: discussion`;
}

function generateCodeTitle(content: string): string {
  const contentLower = content.toLowerCase();

  // Look for function names
  const functionMatch = content.match(/function\s+(\w+)/i);
  if (functionMatch) {
    return `Function: ${functionMatch[1]}`;
  }

  // Look for class names
  const classMatch = content.match(/class\s+(\w+)/i);
  if (classMatch) {
    return `Class: ${classMatch[1]}`;
  }

  // Look for component names (React)
  const componentMatch = content.match(
    /(?:const|let|var)\s+(\w+)\s*=.*(?:React|jsx|tsx)/i
  );
  if (componentMatch) {
    return `Component: ${componentMatch[1]}`;
  }

  // Look for method calls or objects
  const methodMatch = content.match(/(\w+)\.(\w+)\s*\(/);
  if (methodMatch) {
    return `Method: ${methodMatch[1]}.${methodMatch[2]}`;
  }

  // Look for programming languages/technologies mentioned
  if (contentLower.includes("react")) return "React Code";
  if (contentLower.includes("typescript") || contentLower.includes("ts"))
    return "TypeScript Code";
  if (contentLower.includes("javascript") || contentLower.includes("js"))
    return "JavaScript Code";
  if (contentLower.includes("python")) return "Python Code";
  if (contentLower.includes("css")) return "CSS Code";
  if (contentLower.includes("html")) return "HTML Code";
  if (contentLower.includes("sql")) return "SQL Code";

  return "Code Example";
}

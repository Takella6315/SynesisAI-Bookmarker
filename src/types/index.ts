export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  summary?: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface Message {
  id: string;
  chatSessionId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  createdAt: string;
}

export interface Bookmark {
  id: string;
  chatSessionId: string;
  userId: string;
  title: string;
  description?: string;
  category?: string;
  keywords?: string[]; // Keywords for filtering
  messageIds?: string;
  createdAt: string;
}

export type LLMModel =
  | "gpt-4o-mini"
  | "gpt-4o"
  | "claude-3-5-sonnet-20241022"
  | "gemini-2.0-flash-exp";

export interface LLMModelInfo {
  id: LLMModel;
  name: string;
  provider: string;
  description: string;
}

export interface FolderViewState {
  type: "chats" | "bookmarks";
  parentChatId?: string;
  parentChatTitle?: string;
}

export interface Folder {
  id: string;
  userId: string;
  name: string;
  parentId?: string;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export interface FolderItem {
  id: string;
  folderId: string;
  itemType: "chat" | "bookmark";
  itemId: string;
  order: number;
  createdAt: string;
}

export interface TopicSegment {
  id: string;
  chatSessionId: string;
  startMessageId: string;
  endMessageId: string;
  title: string;
  summary?: string;
  topicScore: number; // Confidence score from ConvNTM model
  messageCount: number;
  createdAt: string;
}

export interface BookmarkPosition {
  id: string;
  bookmarkId: string;
  messageId: string;
  topicSegmentId?: string;
  position: number; // 0-1 representing position in conversation
  timestamp: string;
}

// Enhanced bookmark with positioning and topic context
export interface EnhancedBookmark extends Bookmark {
  topicSegmentId?: string;
  messagePosition: number; // Message index where bookmark was created
  conversationProgress: number; // 0-1 percentage through conversation
  segmentContext?: TopicSegment;
  relatedMessages?: string[]; // Array of message IDs related to this bookmark
}

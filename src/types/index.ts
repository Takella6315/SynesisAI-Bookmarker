export interface User {
  id: string
  email: string
  displayName?: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}

export interface ChatSession {
  id: string
  userId: string
  title: string
  summary?: string
  model: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

export interface Message {
  id: string
  chatSessionId: string
  userId: string
  role: 'user' | 'assistant'
  content: string
  model?: string
  createdAt: string
}

export interface Bookmark {
  id: string
  chatSessionId: string
  userId: string
  title: string
  description?: string
  category?: string
  messageIds?: string
  createdAt: string
}

export type LLMModel = 'gpt-4o-mini' | 'gpt-4o' | 'claude-3-5-sonnet-20241022' | 'gemini-2.0-flash-exp'

export interface LLMModelInfo {
  id: LLMModel
  name: string
  provider: string
  description: string
}

export interface FolderViewState {
  type: 'chats' | 'bookmarks'
  parentChatId?: string
  parentChatTitle?: string
}
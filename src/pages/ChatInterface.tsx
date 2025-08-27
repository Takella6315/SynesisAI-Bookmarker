import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  SendIcon,
  ArrowLeftIcon,
  SettingsIcon,
  BookmarkIcon,
  UserIcon,
  BotIcon,
  ChevronDownIcon,
  FilterIcon
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { ScrollArea } from '../components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { toast } from 'sonner'
import blink from '../blink/client'
import { ChatSession, Message, LLMModel, Bookmark } from '../types'
import { LLM_MODELS } from '../constants/models'
import { generateBookmarksForChat } from '../utils/bookmark-generator'

export default function ChatInterface() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [session, setSession] = useState<ChatSession | null>(null)
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([])
  const [currentBookmark, setCurrentBookmark] = useState<Bookmark | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [selectedModel, setSelectedModel] = useState<LLMModel>('gpt-4o-mini')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bookmarkId = searchParams.get('bookmark')
  const focusMode = searchParams.get('focus') === 'true'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const getMessagesForBookmark = (bookmark: Bookmark, messages: Message[]) => {
    // If bookmark has specific message IDs, filter by those
    if (bookmark.messageIds) {
      const messageIds = bookmark.messageIds.split(',')
      return messages.filter(msg => messageIds.includes(msg.id))
    }
    
    // Otherwise, filter by category/topic keywords
    const keywords = bookmark.category?.toLowerCase().split(' ') || []
    if (keywords.length === 0) return messages
    
    return messages.filter(msg => 
      keywords.some(keyword => 
        msg.content.toLowerCase().includes(keyword)
      )
    )
  }

  const loadChatSession = useCallback(async () => {
    if (!user || !id) return;
    try {
      const sessions = await blink.db.chatSessions.list({
        where: { id, userId: user.id },
      });
      if (sessions.length > 0) {
        const sessionData = sessions[0];
        setSession(sessionData);
        setSelectedModel(sessionData.model as LLMModel);
      }
    } catch (error) {
      console.error('Failed to load chat session:', error);
      navigate('/');
    }
  }, [user, id, navigate]);

  const loadMessages = useCallback(async () => {
    if (!user || !id) return;
    try {
      const messageList = await blink.db.messages.list({
        where: { chatSessionId: id, userId: user.id },
        orderBy: { createdAt: 'asc' }
      })
      setAllMessages(messageList)
      
      // Load bookmark if specified
      if (bookmarkId) {
        const bookmarks = await blink.db.bookmarks.list({
          where: { id: bookmarkId, userId: user.id },
        });
        if (bookmarks.length > 0) {
          const bookmark = bookmarks[0]
          setCurrentBookmark(bookmark)
          
          if (focusMode) {
            // Show only messages related to this bookmark
            const bookmarkMessages = getMessagesForBookmark(bookmark, messageList)
            setFilteredMessages(bookmarkMessages)
          } else {
            setFilteredMessages(messageList);
          }
        } else {
          setFilteredMessages(messageList)
        }
      } else {
        setCurrentBookmark(null)
        setFilteredMessages(messageList)
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [user, id, bookmarkId, focusMode]);

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user && id) {
      loadChatSession();
      loadMessages();
    }
  }, [user, id, loadChatSession, loadMessages]);

  useEffect(() => {
    scrollToBottom()
  }, [filteredMessages])
  
  // Store user info when they first authenticate
  useEffect(() => {
    const storeUserInfo = async () => {
      if (!user) return;

      try {
        // Check if user already exists
        const existingUsers = await blink.db.users.list({
          where: { id: user.id },
        });

        if (existingUsers.length === 0) {
          // Create user record
          await blink.db.users.create({
            id: user.id,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            avatarUrl: user.avatarUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Failed to store user info:', error);
      }
    };

    storeUserInfo();
  }, [user]);

  const updateSessionTitle = async (firstMessage: string) => {
    if (!session || session.messageCount > 0) return;

    try {
      // Generate a title from the first message
      const title = firstMessage.length > 50
        ? `${firstMessage.substring(0, 50)}...`
        : firstMessage;

      await blink.db.chatSessions.update(session.id, {
        title,
        updatedAt: new Date().toISOString(),
      });

      setSession(prev => prev ? { ...prev, title } : null);
    } catch (error) {
      console.error('Failed to update session title:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || !session) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      // Create user message
      const userMessageObj = await blink.db.messages.create({
        id: `msg_${Date.now()}_user`,
        chatSessionId: session.id,
        userId: user.id,
        role: 'user',
        content: userMessage,
        createdAt: new Date().toISOString()
      })

      // Optimistically update UI
      const afterUserMessages = [...allMessages, userMessageObj];
      setAllMessages(afterUserMessages);
      setFilteredMessages(prev => [...prev, userMessageObj]);

      // Update session title if this is the first message
      if (session.messageCount === 0) {
        await updateSessionTitle(userMessage);
      }

      // Generate AI response with streaming
      let assistantContent = ''
      const assistantMessageId = `msg_${Date.now()}_assistant`
      
      // Create placeholder assistant message
      const assistantMessage = {
        id: assistantMessageId,
        chatSessionId: session.id,
        userId: user.id,
        role: 'assistant' as const,
        content: '',
        model: selectedModel,
        createdAt: new Date().toISOString(),
      };

      // Add placeholder to UI
      setAllMessages(prev => [...prev, assistantMessage])
      setFilteredMessages(prev => [...prev, assistantMessage])
      
      // Stream the response
      await blink.ai.streamText(
        {
          prompt: userMessage,
          model: selectedModel,
          maxTokens: 2000,
        },
        (chunk) => {
          assistantContent += chunk;

          // Update the message in real-time
          setAllMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: assistantContent }
                : msg,
            ),
          );
          setFilteredMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: assistantContent }
                : msg,
            ),
          );
        },
      );

      // Save the final assistant message to database
      await blink.db.messages.create({
        id: assistantMessageId,
        chatSessionId: session.id,
        userId: user.id,
        role: 'assistant',
        content: assistantContent,
        model: selectedModel,
        createdAt: new Date().toISOString(),
      });

      const finalAssistantMessage = {
        ...assistantMessage,
        content: assistantContent
      }
      
      const updatedMessages = [...afterUserMessages, finalAssistantMessage]

      // Update session
      await blink.db.chatSessions.update(session.id, {
        messageCount: session.messageCount + 2,
        model: selectedModel,
        updatedAt: new Date().toISOString(),
      });

      setSession(prev => prev ? {
        ...prev,
        messageCount: prev.messageCount + 2,
        model: selectedModel,
        updatedAt: new Date().toISOString(),
      } : null);

      // Smart bookmark generation: only create new bookmarks if needed, otherwise update existing ones
      try {
        await generateBookmarksForChat(session.id, user.id, updatedMessages);
      } catch (error) {
        console.error('Failed to auto-generate bookmarks:', error);
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const createBookmark = async (messageId: string, content: string) => {
    try {
      // Generate bookmark title from message content
      const title = content.length > 30
        ? `${content.substring(0, 30)}...`
        : content;

      await blink.db.bookmarks.create({
        id: `bookmark_${Date.now()}`,
        chatSessionId: session!.id,
        userId: user.id,
        title,
        description: content.substring(0, 100),
        messageIds: messageId, // Fixed: use messageIds (plural) to match database schema
        createdAt: new Date().toISOString(),
      });

      toast.success('Bookmark created!');
    } catch (error) {
      console.error('Failed to create bookmark:', error);
      toast.error('Failed to create bookmark');
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading neural pathways...</p>
        </div>
      </div>
    );
  }

  const selectedModelInfo = LLM_MODELS.find(m => m.id === selectedModel);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="hover:bg-gray-100 text-gray-700"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-black">{session.title}</h1>
              {currentBookmark && (
                <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
                  <BookmarkIcon className="w-3 h-3 mr-1" />
                  {currentBookmark.title}
                </Badge>
              )}
              {focusMode && (
                <Badge variant="outline" className="border-gray-300 text-gray-700">
                  <FilterIcon className="w-3 h-3 mr-1" />
                  Focus Mode
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {focusMode ? `${filteredMessages.length} filtered messages` : `${filteredMessages.length} messages`}
              {currentBookmark && !focusMode && ` • Viewing bookmark: ${currentBookmark.title}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedModel} onValueChange={(value: LLMModel) => setSelectedModel(value)}>
            <SelectTrigger className="w-48 bg-white border-gray-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LLM_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{model.name}</span>
                    <span className="text-xs text-gray-500">{model.provider}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/settings')}
            className="text-gray-700 hover:bg-gray-100"
          >
            <SettingsIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                await blink.auth.logout();
                navigate('/landing');
              } catch (error) {
                console.error('Failed to logout:', error);
              }
            }}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center mx-auto mb-4 animate-float">
                <BotIcon className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
              <p className="text-muted-foreground">
                Ask me anything. I'm powered by {selectedModelInfo?.name}.
              </p>
            </div>
          ) : (
            filteredMessages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center flex-shrink-0">
                    <BotIcon className="w-4 h-4 text-accent" />
                  </div>
                )}
                
                <div className={`max-w-2xl ${message.role === 'user' ? 'order-first' : ''}`}>
                  <Card className={`p-4 ${
                    message.role === 'user' 
                      ? 'bg-accent text-accent-foreground ml-auto' 
                      : 'bg-card border-border'
                  }`}>
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                      <span className="text-xs opacity-70">
                        {formatTime(message.createdAt)}
                        {message.model && ` • ${LLM_MODELS.find(m => m.id === message.model)?.name}`}
                      </span>
                      {message.role === 'assistant' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => createBookmark(message.id, message.content)}
                          className="opacity-70 hover:opacity-100"
                        >
                          <BookmarkIcon className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </Card>
                </div>
                
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-foreground/10 to-foreground/5 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-4 h-4 text-foreground" />
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
                <BotIcon className="w-4 h-4 text-accent" />
              </div>
              <Card className="p-4 bg-card border-border">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-accent rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="min-h-[60px] max-h-32 resize-none bg-background/50 border-border focus:border-accent pr-12"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-2 bottom-2 bg-accent hover:bg-accent/90 text-accent-foreground glow-purple"
                size="sm"
              >
                <SendIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>Press Enter to send, Shift+Enter for new line</span>
            <span>Model: {selectedModelInfo?.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

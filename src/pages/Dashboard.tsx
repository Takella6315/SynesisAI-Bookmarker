import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  BookmarkIcon,
  SparklesIcon,
  ArrowLeftIcon,
  HomeIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { FolderCard } from '../components/ui/folder-card';
import Sidebar from '../components/layout/Sidebar';
import blink from '../blink/client';
import { ChatSession, Bookmark, Message, FolderViewState } from '../types';
import { LLM_MODELS } from '../constants/models';
import { generateBookmarksForChat, generateChatSummary } from '../utils/bookmark-generator';

export default function Dashboard() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [user, setUser] = useState(null);
  const [viewState, setViewState] = useState<FolderViewState>({ type: 'chats' });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [sessions, bookmarkList, messageList] = await Promise.all([
        blink.db.chatSessions.list({
          where: { userId: user.id },
          orderBy: { updatedAt: 'desc' },
          limit: 50,
        }),
        blink.db.bookmarks.list({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
        }),
        blink.db.messages.list({
          where: { userId: user.id },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      setChatSessions(sessions);
      setBookmarks(bookmarkList);
      setMessages(messageList);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const createNewChat = async () => {
    try {
      const newSession = await blink.db.chatSessions.create({
        id: `chat_${Date.now()}`,
        userId: user.id,
        title: 'New Chat',
        model: 'gpt-4o-mini',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
      });
      navigate(`/chat/${newSession.id}`);
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await blink.auth.logout();
      navigate('/landing');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const generateBookmarksForSession = async (sessionId: string) => {
    const sessionMessages = messages.filter(msg => msg.chatSessionId === sessionId);
    if (sessionMessages.length >= 4) {
      const newBookmarks = await generateBookmarksForChat(sessionId, user.id, sessionMessages);
      if (newBookmarks.length > 0) {
        setBookmarks(prev => [...prev, ...newBookmarks]);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getModelInfo = (modelId: string) => {
    return LLM_MODELS.find(m => m.id === modelId) || LLM_MODELS[0];
  };

  const getChatSummary = (session: ChatSession) => {
    const firstMessage = messages.find(msg =>
      msg.chatSessionId === session.id && msg.role === 'user',
    );

    if (firstMessage) {
      return generateChatSummary(firstMessage.content);
    }

    return session.title;
  };

  const getBookmarksForChat = (chatId: string) => {
    return bookmarks.filter(bookmark => bookmark.chatSessionId === chatId);
  };

  const handleOpenChat = (sessionId: string) => {
    navigate(`/chat/${sessionId}`);
  };

  const handleGoIntoChat = (session: ChatSession) => {
    setViewState({
      type: 'bookmarks',
      parentChatId: session.id,
      parentChatTitle: getChatSummary(session),
    });
  };

  const handleOpenBookmark = (bookmark: Bookmark) => {
    navigate(`/chat/${bookmark.chatSessionId}?bookmark=${bookmark.id}`);
  };

  const handleGoIntoBookmark = (bookmark: Bookmark) => {
    // For bookmarks, "Go Into" shows only messages related to that bookmark
    navigate(`/chat/${bookmark.chatSessionId}?bookmark=${bookmark.id}&focus=true`);
  };

  const handleBackToChats = () => {
    setViewState({ type: 'chats' });
  };

  const renderBreadcrumb = () => {
    if (viewState.type === 'chats') {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <HomeIcon className="w-4 h-4" />
          <span>All Chats</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToChats}
          className="p-0 h-auto hover:text-accent"
        >
          <HomeIcon className="w-4 h-4 mr-1" />
          All Chats
        </Button>
        <ChevronRightIcon className="w-3 h-3" />
        <span className="text-foreground">{viewState.parentChatTitle}</span>
      </div>
    );
  };

  const renderContent = () => {
    if (viewState.type === 'chats') {
      // Show all chat sessions as folders
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {chatSessions.map((session) => {
            const modelInfo = getModelInfo(session.model);
            const chatBookmarks = getBookmarksForChat(session.id);
            const summary = getChatSummary(session);

            return (
              <FolderCard
                key={session.id}
                title={summary}
                subtitle={`${session.messageCount} messages • ${chatBookmarks.length} bookmarks`}
                description={`${modelInfo.name} • ${formatDate(session.updatedAt)}`}
                icon="folder"
                messageCount={session.messageCount}
                timestamp={formatDate(session.updatedAt)}
                onOpen={() => handleOpenChat(session.id)}
                onGoInto={chatBookmarks.length > 0 ? () => handleGoIntoChat(session) : undefined}
              />
            );
          })}
        </div>
      );
    }

    // Show bookmarks for the selected chat
    const chatBookmarks = getBookmarksForChat(viewState.parentChatId!);

    if (chatBookmarks.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center mx-auto mb-4">
            <BookmarkIcon className="w-8 h-8 text-accent" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No bookmarks yet</h3>
          <p className="text-muted-foreground mb-4">
            Bookmarks will be automatically generated as you chat more.
          </p>
          <Button
            onClick={() => generateBookmarksForSession(viewState.parentChatId!)}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            Generate Bookmarks
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {chatBookmarks.map((bookmark) => (
          <FolderCard
            key={bookmark.id}
            title={bookmark.title}
            description={bookmark.description}
            icon="bookmark"
            timestamp={formatDate(bookmark.createdAt)}
            onOpen={() => handleOpenBookmark(bookmark)}
            onGoInto={() => handleGoIntoBookmark(bookmark)}
            isBookmark={true}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar onNewChat={createNewChat} />

      <div className="flex-1 overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-black">
                Neural File System
              </h1>
              <p className="text-gray-600 mt-1">
                Your AI conversations, organized like folders
              </p>
            </div>
            <div className="flex items-center gap-3">
              {viewState.type === 'bookmarks' && (
                <Button
                  variant="outline"
                  onClick={handleBackToChats}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
                >
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  Back to Chats
                </Button>
              )}
              <Button
                onClick={createNewChat}
                className="bg-black hover:bg-gray-800 text-white border-2 border-black hover:border-gray-800"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                New Chat
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400"
              >
                Logout
              </Button>
            </div>
          </div>

          {/* Breadcrumb */}
          {renderBreadcrumb()}
        </div>

        {/* Main Content */}
        <div className="p-8 overflow-y-auto h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading neural pathways...</p>
              </div>
            </div>
          ) : chatSessions.length === 0 && viewState.type === 'chats' ? (
            // Empty State
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center mb-6 animate-float">
                <SparklesIcon className="w-12 h-12 text-accent" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Welcome to Neural Chat</h2>
              <p className="text-muted-foreground mb-6">
                Start your first conversation with AI. Each chat becomes a folder with automatically generated bookmarks.
              </p>
              <Button
                onClick={createNewChat}
                className="bg-accent hover:bg-accent/90 text-accent-foreground glow-purple"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Create First Chat
              </Button>
            </div>
          ) : (
            renderContent()
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  LogOutIcon,
  MessageSquareIcon,
  BookmarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ArrowRightIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import blink from "../../blink/client";
import { ChatSession, Bookmark, Message } from "../../types";


interface SidebarProps {
  onNewChat: () => void;
  chats: ChatSession[];
  bookmarks: Bookmark[];
  messages: Message[];
}

export default function Sidebar({ onNewChat, chats, bookmarks, messages }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();

  // Load full user profile with avatar
  const loadUserProfile = useCallback(async () => {
    if (!user) {
      setUserProfile(null);
      return;
    }
    
    try {
      const { data: users } = await (blink.db as any).users.select(
        "*"
      ).filter({
        id: user.id,
      });
      if (users.length > 0) {
        setUserProfile(users[0]);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  }, [user]);

  // Listen for authentication state changes
  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user);
    });
    return unsubscribe;
  }, []);

  // Load user profile when user changes
  useEffect(() => {
    loadUserProfile();
  }, [user, loadUserProfile]);

  // Toggle chat expansion
  const toggleChatExpansion = (chatId: string) => {
    setExpandedChats(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chatId)) {
        newSet.delete(chatId);
      } else {
        newSet.add(chatId);
      }
      return newSet;
    });
  };

  // Toggle sidebar collapse
  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`h-screen bg-card border-r border-border flex flex-col transition-all duration-700 ease-in-out ease-out-in ${
      isCollapsed ? 'w-[75px]' : 'w-72'
    }`}>
      {isCollapsed ? (
        <div className="flex flex-col h-full">
          {/* Chevron button at top left */}
          <div className="p-4">
            <Button
              onClick={toggleSidebar}
              size="sm"
              variant="ghost"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Spacer to push buttons to bottom */}
          <div className="flex-1"></div>
          
          {/* Settings and logout buttons at bottom */}
          <div className="p-4 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (window.location.href = "/settings")}
              className="w-full"
            >
              <SettingsIcon className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => blink.auth.logout()}
              className="w-full"
            >
              <LogOutIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <>
        {/* Header */}
            <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="ml-10 flex items-center gap-0">
                <img src="/logo.png" alt="SynesisAI" width={45} height={45} />
                <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-accent bg-clip-text font-sans tracking-tight">
                  SynesisAI
                </h1>
              </div>
              <Button
                onClick={toggleSidebar}
                size="sm"
                variant="ghost"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </Button>
            </div>

            {/* Search */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 border-border focus:border-accent"
              />
            </div>
          </div>
          {/* Content - Tree View */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-2 mb-3">
                <MessageSquareIcon className="w-4 h-4" />
                <span>Chats & Bookmarks</span>
              </div>
              
              {chats.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No chats yet
                </div>
              ) : chats.filter(chat => 
                chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                bookmarks.some(bookmark => 
                  bookmark.chatSessionId === chat.id && 
                  bookmark.title.toLowerCase().includes(searchQuery.toLowerCase())
                )
              ).length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No results found
                </div>
              ) : (
                <div className="space-y-1">
                  {chats
                    .filter(chat => 
                      chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      bookmarks.some(bookmark => 
                        bookmark.chatSessionId === chat.id && 
                        bookmark.title.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                    )
                    .map((chat) => (
                    <div key={chat.id} className="space-y-1">
                      {/* Chat Item */}
                      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                        {/* Collapse/Expand Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleChatExpansion(chat.id);
                          }}
                          className="p-1 hover:bg-muted/70 rounded transition-colors"
                        >
                          {expandedChats.has(chat.id) ? (
                            <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                        
                        {/* Chat Icon and Title */}
                        <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => navigate(`/chat/${chat.id}`)}>
                          <MessageSquareIcon className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-medium text-foreground truncate">
                            {chat.title.length > 25 ? chat.title.substring(0, 25) + "..." : chat.title}
                          </span>
                        </div>
                        {/* Bookmark Count and Navigation Button */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/chat/${chat.id}`);
                            }}
                          >
                            <ArrowRightIcon className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Bookmarks for this chat - Only show when expanded */}
                      {expandedChats.has(chat.id) && bookmarks
                        .filter(bookmark => bookmark.chatSessionId === chat.id)
                        .map((bookmark) => (
                          <div 
                            key={bookmark.id}
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors ml-6"
                            onClick={() => navigate(`/chat/${bookmark.chatSessionId}?bookmark=${bookmark.id}`)}
                          >
                            <BookmarkIcon className="w-3 h-3 text-amber-500" />
                            <span className="text-sm text-muted-foreground truncate flex-1">
                              {bookmark.title}
                            </span>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Footer - Pushed to bottom */}
          <div className="mt-auto p-4 border-t border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={userProfile?.avatarUrl} alt="Profile" />
                  <AvatarFallback className="bg-gradient-to-br from-accent to-accent/70 text-accent-foreground text-xs font-bold">
                    {user?.email?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {userProfile?.displayName || user?.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (window.location.href = "/settings")}
                >
                  <SettingsIcon className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => blink.auth.logout()}
                >
                  <LogOutIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

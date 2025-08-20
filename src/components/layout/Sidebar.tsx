import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  FolderIcon, 
  PlusIcon, 
  SearchIcon, 
  BookmarkIcon,
  MessageSquareIcon,
  SettingsIcon,
  LogOutIcon
} from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import { Separator } from '../ui/separator'
import blink from '../../blink/client'
import { ChatSession, Bookmark } from '../../types'

interface SidebarProps {
  onNewChat: () => void
}

export default function Sidebar({ onNewChat }: SidebarProps) {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [user, setUser] = useState(null)
  const location = useLocation()

  const loadChatSessions = useCallback(async () => {
    if (!user) return
    try {
      const sessions = await blink.db.chatSessions.list({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        limit: 50
      })
      setChatSessions(sessions)
    } catch (error) {
      console.error('Failed to load chat sessions:', error)
    }
  }, [user])

  const loadBookmarks = useCallback(async () => {
    if (!user) return
    try {
      const bookmarkList = await blink.db.bookmarks.list({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        limit: 20
      })
      setBookmarks(bookmarkList)
    } catch (error) {
      console.error('Failed to load bookmarks:', error)
    }
  }, [user])

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (user) {
      loadChatSessions()
      loadBookmarks()
    }
  }, [user, loadChatSessions, loadBookmarks])

  const filteredSessions = chatSessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredBookmarks = bookmarks.filter(bookmark =>
    bookmark.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="w-80 h-screen bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">
            Neural Chat
          </h1>
          <Button
            onClick={onNewChat}
            size="sm"
            className="bg-accent hover:bg-accent/90 text-accent-foreground glow-purple"
          >
            <PlusIcon className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search chats and bookmarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background/50 border-border focus:border-accent"
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Chat Sessions */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FolderIcon className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Chat Folders
              </h2>
            </div>
            <div className="space-y-1">
              {filteredSessions.map((session) => (
                <Link
                  key={session.id}
                  to={`/chat/${session.id}`}
                  className={`block p-3 rounded-lg transition-all duration-200 hover:bg-accent/10 hover:border-accent/30 border border-transparent group ${
                    location.pathname === `/chat/${session.id}` 
                      ? 'bg-accent/10 border-accent/30' 
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center group-hover:from-accent/30 group-hover:to-accent/20 transition-all">
                      <MessageSquareIcon className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {session.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.messageCount} messages • {session.model}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
              {filteredSessions.length === 0 && searchQuery && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No chats found
                </p>
              )}
            </div>
          </div>

          {/* Bookmarks */}
          {filteredBookmarks.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookmarkIcon className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Bookmarks
                  </h2>
                </div>
                <div className="space-y-1">
                  {filteredBookmarks.map((bookmark) => (
                    <Link
                      key={bookmark.id}
                      to={`/chat/${bookmark.chatSessionId}?bookmark=${bookmark.id}`}
                      className="block p-3 rounded-lg transition-all duration-200 hover:bg-accent/10 hover:border-accent/30 border border-transparent group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center group-hover:bg-accent/30 transition-all">
                          <BookmarkIcon className="w-3 h-3 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {bookmark.title}
                          </p>
                          {bookmark.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {bookmark.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center">
              <span className="text-xs font-bold text-accent-foreground">
                {user?.email?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => window.location.href = '/settings'}
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
    </div>
  )
}
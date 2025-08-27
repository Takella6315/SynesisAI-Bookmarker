import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  PlusIcon,
  SearchIcon,
  BookmarkIcon,
  MessageSquareIcon,
  SettingsIcon,
  LogOutIcon,
  TrashIcon,
  FolderIcon,
  FolderOpenIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import blink from "../../blink/client";
import { ChatSession, Bookmark, Folder, FolderItem } from "../../types";

interface SidebarProps {
  onNewChat: () => void;
}

export default function Sidebar({ onNewChat }: SidebarProps) {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderItems, setFolderItems] = useState<FolderItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<any>(null);
  const location = useLocation();

  const loadChatSessions = useCallback(async () => {
    if (!user) return;
    try {
      // TODO: Replace with actual database call when schema is set up
      // const sessions = await blink.db.chatSessions.list({
      //   where: { userId: user.id },
      //   orderBy: { updatedAt: "desc" },
      //   limit: 50,
      // });
      // setChatSessions(sessions);

      // Mock data for now
      const mockSessions: ChatSession[] = [
        {
          id: "1",
          userId: user.id,
          title: "React Component Help",
          summary:
            "Discussion about creating reusable React components with TypeScript",
          model: "gpt-4o",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 15,
        },
        {
          id: "2",
          userId: user.id,
          title: "Database Design",
          summary: "Planning database schema for chat application",
          model: "claude-3-5-sonnet-20241022",
          createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          messageCount: 8,
        },
      ];
      setChatSessions(mockSessions);
    } catch (error) {
      console.error("Failed to load chat sessions:", error);
    }
  }, [user]);

  const loadBookmarks = useCallback(async () => {
    if (!user) return;
    try {
      // TODO: Replace with actual database call when schema is set up
      // const bookmarkList = await blink.db.bookmarks.list({
      //   where: { userId: user.id },
      //   orderBy: { createdAt: "desc" },
      //   limit: 20,
      // });
      // setBookmarks(bookmarkList);

      // Mock data for now
      const mockBookmarks: Bookmark[] = [
        {
          id: "1",
          chatSessionId: "1",
          userId: user.id,
          title: "TypeScript Best Practices",
          description: "Useful tips for writing clean TypeScript code",
          category: "Development",
          messageIds: "msg1,msg2",
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          chatSessionId: "2",
          userId: user.id,
          title: "Database Schema Design",
          description:
            "Key principles for designing efficient database schemas",
          category: "Backend",
          messageIds: "msg3",
          createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        },
      ];
      setBookmarks(mockBookmarks);
    } catch (error) {
      console.error("Failed to load bookmarks:", error);
    }
  }, [user]);

  const loadFolders = useCallback(async () => {
    if (!user) return;
    try {
      // TODO: Replace with actual database call when schema is set up
      // const folderList = await blink.db.folders.list({
      //   where: { userId: user.id },
      //   orderBy: { name: "asc" },
      // });
      // setFolders(folderList);

      // Mock folder data
      const mockFolders: Folder[] = [
        {
          id: "folder-1",
          userId: user.id,
          name: "Work Projects",
          color: "#3b82f6",
          icon: "briefcase",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          itemCount: 3,
        },
        {
          id: "folder-2",
          userId: user.id,
          name: "Learning",
          parentId: "folder-1",
          color: "#10b981",
          icon: "book",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          itemCount: 2,
        },
        {
          id: "folder-3",
          userId: user.id,
          name: "Personal",
          color: "#f59e0b",
          icon: "user",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          itemCount: 1,
        },
        {
          id: "folder-4",
          userId: user.id,
          name: "Research",
          parentId: "folder-1",
          color: "#8b5cf6",
          icon: "search",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          itemCount: 2,
        },
      ];
      setFolders(mockFolders);

      // Mock folder items data
      const mockFolderItems: FolderItem[] = [
        {
          id: "fi-1",
          folderId: "folder-1",
          itemType: "chat",
          itemId: "1",
          order: 1,
          createdAt: new Date().toISOString(),
        },
        {
          id: "fi-2",
          folderId: "folder-2",
          itemType: "chat",
          itemId: "2",
          order: 1,
          createdAt: new Date().toISOString(),
        },
        {
          id: "fi-3",
          folderId: "folder-3",
          itemType: "bookmark",
          itemId: "1",
          order: 1,
          createdAt: new Date().toISOString(),
        },
      ];
      setFolderItems(mockFolderItems);
    } catch (error) {
      console.error("Failed to load folders:", error);
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
      loadChatSessions();
      loadBookmarks();
      loadFolders();
    }
  }, [user, loadChatSessions, loadBookmarks, loadFolders]);

  const filteredSessions = chatSessions.filter((session) =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBookmarks = bookmarks.filter((bookmark) =>
    bookmark.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group chat sessions by date
  const groupChatsByDate = (sessions: ChatSession[]) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    const groups = {
      today: sessions.filter(
        (s) => new Date(s.updatedAt).toDateString() === today
      ),
      yesterday: sessions.filter(
        (s) => new Date(s.updatedAt).toDateString() === yesterday
      ),
      older: sessions.filter((s) => {
        const date = new Date(s.updatedAt).toDateString();
        return date !== today && date !== yesterday;
      }),
    };

    return groups;
  };

  // Folder helper functions
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const buildFolderTree = (folders: Folder[]): Folder[] => {
    const folderMap = new Map(
      folders.map((f) => [f.id, { ...f, children: [] as Folder[] }])
    );
    const rootFolders: Folder[] = [];

    folders.forEach((folder) => {
      const folderWithChildren = folderMap.get(folder.id);
      if (folder.parentId && folderMap.has(folder.parentId)) {
        folderMap.get(folder.parentId)!.children!.push(folderWithChildren!);
      } else {
        rootFolders.push(folderWithChildren!);
      }
    });

    return rootFolders;
  };

  const getFolderItems = (folderId: string, type: "chat" | "bookmark") => {
    const items = folderItems
      .filter((fi) => fi.folderId === folderId && fi.itemType === type)
      .map((fi) => {
        if (type === "chat") {
          return chatSessions.find((c) => c.id === fi.itemId);
        } else {
          return bookmarks.find((b) => b.id === fi.itemId);
        }
      })
      .filter(Boolean);
    return items;
  };

  const folderTree = buildFolderTree(
    folders.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Get items that are not in any folder
  const itemsInFolders = new Set(folderItems.map((fi) => fi.itemId));
  const ungroupedSessions = filteredSessions.filter(
    (session) => !itemsInFolders.has(session.id)
  );
  const ungroupedBookmarks = filteredBookmarks.filter(
    (bookmark) => !itemsInFolders.has(bookmark.id)
  );

  // Folder component for recursive rendering
  const FolderComponent = ({
    folder,
    level = 0,
  }: {
    folder: Folder & { children?: Folder[] };
    level?: number;
  }) => {
    const isExpanded = expandedFolders.has(folder.id);
    const folderChats = getFolderItems(folder.id, "chat") as ChatSession[];
    const folderBookmarks = getFolderItems(folder.id, "bookmark") as Bookmark[];
    const hasItems = folderChats.length > 0 || folderBookmarks.length > 0;
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder.id} className="space-y-1">
        {/* Folder Header */}
        <div
          className={`flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group`}
          style={{ paddingLeft: `${8 + level * 16}px` }}
          onClick={() => toggleFolder(folder.id)}
        >
          <div className="flex items-center gap-1">
            {(hasChildren || hasItems) &&
              (isExpanded ? (
                <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
              ))}
            {isExpanded ? (
              <FolderOpenIcon
                className="w-4 h-4"
                style={{ color: folder.color }}
              />
            ) : (
              <FolderIcon className="w-4 h-4" style={{ color: folder.color }} />
            )}
          </div>
          <span className="text-sm font-medium text-foreground flex-1">
            {folder.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {folder.itemCount}
          </span>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Add folder options menu
              }}
            >
              <MoreHorizontalIcon className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Folder Contents */}
        {isExpanded && (
          <div className="space-y-1">
            {/* Folder Chats */}
            {folderChats.map((chat) => (
              <Link
                key={`folder-chat-${chat.id}`}
                to={`/chat/${chat.id}`}
                className={`block w-full p-2 rounded-lg text-left hover:bg-accent/50 transition-colors group ${
                  location.pathname === `/chat/${chat.id}`
                    ? "bg-accent/30 border border-accent/50"
                    : "hover:bg-muted/50"
                }`}
                style={{ paddingLeft: `${24 + level * 16}px` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <MessageSquareIcon className="w-3 h-3 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground truncate">
                        {chat.title}
                      </p>
                    </div>
                    {chat.summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1 ml-5">
                        {chat.summary}
                      </p>
                    )}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // TODO: Remove from folder
                      }}
                    >
                      <TrashIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Link>
            ))}

            {/* Folder Bookmarks */}
            {folderBookmarks.map((bookmark) => (
              <Link
                key={`folder-bookmark-${bookmark.id}`}
                to={`/chat/${bookmark.chatSessionId}?bookmark=${bookmark.id}`}
                className="block w-full p-2 rounded-lg text-left hover:bg-muted/50 transition-colors group"
                style={{ paddingLeft: `${24 + level * 16}px` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <BookmarkIcon className="w-3 h-3 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground truncate">
                        {bookmark.title}
                      </p>
                    </div>
                    {bookmark.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1 ml-5">
                        {bookmark.description}
                      </p>
                    )}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // TODO: Remove from folder
                      }}
                    >
                      <TrashIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Link>
            ))}

            {/* Nested Folders */}
            {folder.children?.map((childFolder) => (
              <FolderComponent
                key={childFolder.id}
                folder={childFolder}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-80 h-screen bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-accent bg-clip-text font-sans tracking-tight">
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
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background/50 border-border focus:border-accent"
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {/* Folders */}
          {folderTree.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm font-medium text-muted-foreground px-2">
                <div className="flex items-center gap-2">
                  <FolderIcon className="w-4 h-4" />
                  <span>Folders</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-accent/20"
                  onClick={() => {
                    // TODO: Add new folder functionality
                  }}
                >
                  <PlusIcon className="w-3 h-3" />
                </Button>
              </div>
              <div className="space-y-1">
                {folderTree.map((folder) => (
                  <FolderComponent key={folder.id} folder={folder} />
                ))}
              </div>
            </div>
          )}

          {folderTree.length > 0 && <Separator />}

          {/* Chat Sessions */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-2">
              <MessageSquareIcon className="w-4 h-4" />
              <span>Recent Chats</span>
            </div>
            {ungroupedSessions.length === 0 ? (
              <div className="text-sm text-muted-foreground px-2 py-4 text-center">
                {searchQuery ? "No matching chats" : "No chats yet"}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Today */}
                {groupChatsByDate(ungroupedSessions).today.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-muted-foreground px-2 py-1">
                      Today
                    </h4>
                    {groupChatsByDate(ungroupedSessions).today.map(
                      (session) => (
                        <Link
                          key={session.id}
                          to={`/chat/${session.id}`}
                          className={`block w-full p-3 rounded-lg text-left hover:bg-accent/50 transition-colors group ${
                            location.pathname === `/chat/${session.id}`
                              ? "bg-accent/30 border border-accent/50"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {session.title}
                              </p>
                              {session.summary && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {session.summary}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>{session.messageCount} messages</span>
                                <span>•</span>
                                <span>
                                  {new Date(
                                    session.updatedAt
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // TODO: Add delete functionality
                                }}
                              >
                                <TrashIcon className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </Link>
                      )
                    )}
                  </div>
                )}

                {/* Yesterday */}
                {groupChatsByDate(ungroupedSessions).yesterday.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-muted-foreground px-2 py-1">
                      Yesterday
                    </h4>
                    {groupChatsByDate(ungroupedSessions).yesterday.map(
                      (session) => (
                        <Link
                          key={session.id}
                          to={`/chat/${session.id}`}
                          className={`block w-full p-3 rounded-lg text-left hover:bg-accent/50 transition-colors group ${
                            location.pathname === `/chat/${session.id}`
                              ? "bg-accent/30 border border-accent/50"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {session.title}
                              </p>
                              {session.summary && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {session.summary}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>{session.messageCount} messages</span>
                                <span>•</span>
                                <span>
                                  {new Date(
                                    session.updatedAt
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // TODO: Add delete functionality
                                }}
                              >
                                <TrashIcon className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </Link>
                      )
                    )}
                  </div>
                )}

                {/* Older */}
                {groupChatsByDate(ungroupedSessions).older.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-muted-foreground px-2 py-1">
                      Previous 7 days
                    </h4>
                    {groupChatsByDate(ungroupedSessions).older.map(
                      (session) => (
                        <Link
                          key={session.id}
                          to={`/chat/${session.id}`}
                          className={`block w-full p-3 rounded-lg text-left hover:bg-accent/50 transition-colors group ${
                            location.pathname === `/chat/${session.id}`
                              ? "bg-accent/30 border border-accent/50"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {session.title}
                              </p>
                              {session.summary && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {session.summary}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                <span>{session.messageCount} messages</span>
                                <span>•</span>
                                <span>
                                  {new Date(
                                    session.updatedAt
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // TODO: Add delete functionality
                                }}
                              >
                                <TrashIcon className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </Link>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Bookmarks */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-2">
              <BookmarkIcon className="w-4 h-4" />
              <span>Bookmarks</span>
            </div>
            {ungroupedBookmarks.length === 0 ? (
              <div className="text-sm text-muted-foreground px-2 py-4 text-center">
                {searchQuery ? "No matching bookmarks" : "No bookmarks yet"}
              </div>
            ) : (
              <div className="space-y-1">
                {ungroupedBookmarks.map((bookmark) => (
                  <Link
                    key={bookmark.id}
                    to={`/chat/${bookmark.chatSessionId}?bookmark=${bookmark.id}`}
                    className="block w-full p-3 rounded-lg text-left hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {bookmark.title}
                        </p>
                        {bookmark.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {bookmark.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {bookmark.category && (
                            <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-1 rounded">
                              {bookmark.category}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(bookmark.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-destructive/20 hover:text-destructive"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // TODO: Add delete bookmark functionality
                          }}
                        >
                          <TrashIcon className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
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
    </div>
  );
}

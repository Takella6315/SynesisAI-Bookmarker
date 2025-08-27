import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  SendIcon,
  ArrowLeftIcon,
  SettingsIcon,
  BookmarkIcon,
  UserIcon,
  BotIcon,
  ChevronDownIcon,
  FilterIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { ScrollArea } from "../components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import blink from "../blink/client";
import {
  ChatSession,
  Message,
  LLMModel,
  Bookmark,
  EnhancedBookmark,
} from "../types";
import { LLM_MODELS } from "../constants/models";
import {
  generateBookmarksForChat,
  generateEnhancedBookmarksForChat,
} from "../utils/bookmark-generator";
import FloatingBookmarkTimeline from "../components/ui/FloatingBookmarkTimeline";

export default function ChatInterface() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [currentBookmark, setCurrentBookmark] = useState<Bookmark | null>(null);
  const [enhancedBookmarks, setEnhancedBookmarks] = useState<
    EnhancedBookmark[]
  >([]);
  const [showFloatingTimeline, setShowFloatingTimeline] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isManuallyNavigating, setIsManuallyNavigating] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<LLMModel>("gpt-4o-mini");
  const [bookmarkMessageIndex, setBookmarkMessageIndex] = useState(0); // Track current position in bookmark messages
  const [bookmarkMessages, setBookmarkMessages] = useState<Message[]>([]); // Store bookmark-specific messages
  const [messageQueue, setMessageQueue] = useState<Message[]>([]); // Keep last 15 messages for LLM context
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousMessageCountRef = useRef(0);
  const isNearBottomRef = useRef(true); // Track if user is near bottom
  const bookmarkId = searchParams.get("bookmark");
  const focusMode = searchParams.get("focus") === "true";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const isNearBottom = () => {
    const threshold = 100; // pixels from bottom
    const position = window.innerHeight + window.scrollY;
    const height = document.body.offsetHeight;
    return position >= height - threshold;
  };

  const scrollToMessage = (messageId: string) => {
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Handle bookmark click from floating timeline
  const handleBookmarkClick = (bookmark: EnhancedBookmark) => {
    const messageIndex = bookmark.messagePosition;
    const targetMessage = allMessages[messageIndex];

    if (targetMessage) {
      // Set manual navigation flag to prevent auto-scroll
      setIsManuallyNavigating(true);
      // User is navigating away from bottom
      isNearBottomRef.current = false;

      // Scroll to the bookmark position
      scrollToMessage(targetMessage.id);
      setCurrentMessageIndex(messageIndex);

      // Don't update URL to avoid triggering loadMessages reload
      // Just track the bookmark state internally
      // const newSearchParams = new URLSearchParams(searchParams);
      // newSearchParams.set("bookmark", bookmark.id);
      // navigate(`/chat/${id}?${newSearchParams.toString()}`, { replace: true });

      // Reset manual navigation flag after a longer delay to ensure scroll completes
      setTimeout(() => {
        setIsManuallyNavigating(false);
      }, 2000);
    }
  };

  const navigateBookmarkMessage = (direction: "next" | "prev") => {
    if (bookmarkMessages.length === 0) return;

    let newIndex = bookmarkMessageIndex;
    if (direction === "next") {
      newIndex = Math.min(
        bookmarkMessageIndex + 1,
        bookmarkMessages.length - 1
      );
    } else {
      newIndex = Math.max(bookmarkMessageIndex - 1, 0);
    }

    // Set manual navigation flag to prevent auto-scroll
    setIsManuallyNavigating(true);
    // User is navigating away from bottom
    isNearBottomRef.current = false;
    setBookmarkMessageIndex(newIndex);
    scrollToMessage(bookmarkMessages[newIndex].id);

    // Reset manual navigation flag after a longer delay
    setTimeout(() => {
      setIsManuallyNavigating(false);
    }, 2000);
  };

  const goToFirstBookmarkMessage = () => {
    if (bookmarkMessages.length > 0) {
      // Set manual navigation flag to prevent auto-scroll
      setIsManuallyNavigating(true);
      // User is navigating away from bottom
      isNearBottomRef.current = false;
      setBookmarkMessageIndex(0);
      scrollToMessage(bookmarkMessages[0].id);

      // Reset manual navigation flag after a longer delay
      setTimeout(() => {
        setIsManuallyNavigating(false);
      }, 2000);
    }
  };

  const updateBookmarkMessageIndex = () => {
    if (!currentBookmark || bookmarkMessages.length === 0) return;

    // Find which bookmark message is currently most visible
    const messageElements = bookmarkMessages
      .map((msg) => ({
        id: msg.id,
        element: document.getElementById(`message-${msg.id}`),
      }))
      .filter((item) => item.element);

    if (messageElements.length === 0) return;

    // Find the message closest to the center of the viewport
    const viewportCenter = window.innerHeight / 2;
    let closestMessage = messageElements[0];
    let closestDistance = Infinity;

    messageElements.forEach((item) => {
      if (item.element) {
        const rect = item.element.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestMessage = item;
        }
      }
    });

    const newIndex = bookmarkMessages.findIndex(
      (msg) => msg.id === closestMessage.id
    );
    if (newIndex !== -1 && newIndex !== bookmarkMessageIndex) {
      setBookmarkMessageIndex(newIndex);
    }
  };

  const updateMessageQueue = (newMessage: Message) => {
    setMessageQueue((prev) => {
      const updated = [...prev, newMessage];
      // Keep only the last 15 messages
      return updated.slice(-15);
    });
  };

  const getLLMContext = () => {
    // Format the last 15 messages as context for the LLM
    return messageQueue
      .map(
        (msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`
      )
      .join("\n\n");
  };

  const getMessagesForBookmark = (bookmark: Bookmark, messages: Message[]) => {
    // If bookmark has specific message IDs, filter by those
    if (bookmark.messageIds) {
      const messageIds = bookmark.messageIds.split(",");
      const taggedMessages = messages.filter((msg) =>
        messageIds.includes(msg.id)
      );

      // For focus mode, we want to show conversation pairs
      // Find all messages that are part of conversations with tagged messages
      const conversationMessages: Message[] = [];

      taggedMessages.forEach((taggedMsg) => {
        // Find the conversation pair for this tagged message
        const msgIndex = messages.findIndex((msg) => msg.id === taggedMsg.id);

        if (msgIndex !== -1) {
          // Add the tagged message
          conversationMessages.push(taggedMsg);

          // If it's a user message, add the next message (AI response) if it exists
          if (taggedMsg.role === "user" && msgIndex + 1 < messages.length) {
            const nextMsg = messages[msgIndex + 1];
            if (nextMsg.role === "assistant") {
              conversationMessages.push(nextMsg);
            }
          }

          // If it's an AI message, add the previous message (user input) if it exists
          if (taggedMsg.role === "assistant" && msgIndex > 0) {
            const prevMsg = messages[msgIndex - 1];
            if (prevMsg.role === "user") {
              conversationMessages.push(prevMsg);
            }
          }
        }
      });

      // Remove duplicates and sort by creation time
      const uniqueMessages = conversationMessages.filter(
        (msg, index, self) => index === self.findIndex((m) => m.id === msg.id)
      );

      return uniqueMessages.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }

    // Otherwise, filter by category/topic keywords (fallback)
    const keywords = bookmark.category?.toLowerCase().split(" ") || [];
    if (keywords.length === 0) return messages;

    return messages.filter((msg) =>
      keywords.some((keyword) => msg.content.toLowerCase().includes(keyword))
    );
  };

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
      console.error("Failed to load chat session:", error);
      navigate("/");
    }
  }, [user, id, navigate]);

  const loadMessages = useCallback(async () => {
    if (!user || !id) return;
    try {
      const messageList = await blink.db.messages.list({
        where: { chatSessionId: id, userId: user.id },
        orderBy: { createdAt: "asc" },
      });
      setAllMessages(messageList);

      // Generate enhanced bookmarks with topic segmentation
      if (messageList.length > 0) {
        try {
          const enhancedBookmarkList = await generateEnhancedBookmarksForChat(
            id!,
            messageList
          );
          setEnhancedBookmarks(enhancedBookmarkList);
        } catch (error) {
          console.error("Failed to generate enhanced bookmarks:", error);
          // Fallback to empty array
          setEnhancedBookmarks([]);
        }
      }

      // Initialize message queue with existing messages (last 15)
      const initialQueue = messageList.slice(-15);
      setMessageQueue(initialQueue);

      // Load bookmark if specified
      if (bookmarkId) {
        const bookmarks = await blink.db.bookmarks.list({
          where: { id: bookmarkId, userId: user.id },
        });
        if (bookmarks.length > 0) {
          const bookmark = bookmarks[0];
          setCurrentBookmark(bookmark);

          // Get messages for this bookmark (including conversation pairs)
          const bookmarkMessageList = getMessagesForBookmark(
            bookmark,
            messageList
          );
          setBookmarkMessages(bookmarkMessageList);
          setBookmarkMessageIndex(0); // Start at first bookmark message

          console.log(`📚 Bookmark "${bookmark.title}" processing:`, {
            totalMessages: messageList.length,
            taggedMessageIds: bookmark.messageIds?.split(",") || [],
            bookmarkMessagesFound: bookmarkMessageList.length,
            focusMode,
            messages: bookmarkMessageList.map((m) => ({
              id: m.id,
              role: m.role,
              content: `${m.content.substring(0, 50)}...`,
            })),
          });

          if (focusMode) {
            // Show only messages related to this bookmark (conversation pairs)
            setFilteredMessages(bookmarkMessageList);
          } else {
            setFilteredMessages(messageList);
          }

          // Auto-scroll to first bookmark message after a short delay
          // Set manual navigation flag to prevent auto-scroll from other effects
          setIsManuallyNavigating(true);
          setTimeout(() => {
            if (bookmarkMessageList.length > 0) {
              scrollToMessage(bookmarkMessageList[0].id);

              // Reset manual navigation flag after scroll is complete
              setTimeout(() => {
                setIsManuallyNavigating(false);
              }, 1000);
            }
          }, 100);
        } else {
          setFilteredMessages(messageList);
          setBookmarkMessages([]);
          setBookmarkMessageIndex(0);
        }
      } else {
        setCurrentBookmark(null);
        setFilteredMessages(messageList);
        setBookmarkMessages([]);
        setBookmarkMessageIndex(0);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }, [user, id, bookmarkId, focusMode]); // Function to regenerate enhanced bookmarks
  const regenerateBookmarks = useCallback(
    async (messages: Message[]) => {
      if (!id || messages.length === 0) return;

      console.log(`🔖 Regenerating bookmarks for ${messages.length} messages`);

      try {
        const enhancedBookmarkList = await generateEnhancedBookmarksForChat(
          id,
          messages
        );
        console.log(
          `🔖 Generated ${enhancedBookmarkList.length} enhanced bookmarks:`,
          enhancedBookmarkList.map((b) => b.title)
        );
        setEnhancedBookmarks(enhancedBookmarkList);
      } catch (error) {
        console.error("Failed to regenerate enhanced bookmarks:", error);
        // Keep existing bookmarks on error
      }
    },
    [id]
  );

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

  // Regenerate bookmarks when messages change (during active chat)
  useEffect(() => {
    if (allMessages.length > 0) {
      regenerateBookmarks(allMessages);
    }
  }, [allMessages, regenerateBookmarks]);

  // Auto-show floating timeline when bookmarks are available
  useEffect(() => {
    if (enhancedBookmarks.length > 0 && !showFloatingTimeline) {
      // Only auto-show if we have a reasonable number of messages (more than just hello/intro)
      if (allMessages.length >= 4) {
        console.log(
          `📍 Auto-showing timeline with ${enhancedBookmarks.length} bookmarks for ${allMessages.length} messages`
        );
        setShowFloatingTimeline(true);
      }
    }
  }, [enhancedBookmarks, showFloatingTimeline, allMessages.length]);

  useEffect(() => {
    // Only auto-scroll to bottom if:
    // 1. User is not manually navigating to a bookmark
    // 2. New messages were actually added (not just refiltered)
    // 3. User was already near the bottom (natural chat behavior)
    const currentMessageCount = filteredMessages.length;
    const hadNewMessages =
      currentMessageCount > previousMessageCountRef.current;

    if (!isManuallyNavigating && hadNewMessages && isNearBottomRef.current) {
      scrollToBottom();
    }

    // Update the previous count
    previousMessageCountRef.current = currentMessageCount;
  }, [filteredMessages, isManuallyNavigating]);

  // Add scroll listener for bookmark navigation
  useEffect(() => {
    if (currentBookmark && bookmarkMessages.length > 0) {
      const handleScroll = () => {
        updateBookmarkMessageIndex();
      };

      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, [currentBookmark, bookmarkMessages, bookmarkMessageIndex]);

  // Track current message position for timeline
  useEffect(() => {
    const handleScroll = () => {
      if (allMessages.length === 0) return;

      // Track if user is near bottom for auto-scroll behavior
      isNearBottomRef.current = isNearBottom();

      // Find the message currently in the center of the viewport
      const viewportCenter = window.innerHeight / 2;
      let closestIndex = 0;
      let closestDistance = Infinity;

      allMessages.forEach((message, index) => {
        const element = document.getElementById(`message-${message.id}`);
        if (element) {
          const rect = element.getBoundingClientRect();
          const distance = Math.abs(
            rect.top + rect.height / 2 - viewportCenter
          );
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
        }
      });

      setCurrentMessageIndex(closestIndex);
    };

    // Throttle scroll events
    let timeoutId: number;
    const throttledScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(handleScroll, 100);
    };

    window.addEventListener("scroll", throttledScroll);
    return () => {
      window.removeEventListener("scroll", throttledScroll);
      clearTimeout(timeoutId);
    };
  }, [allMessages]);

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
            displayName: user.displayName || user.email.split("@")[0],
            avatarUrl: user.avatarUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("Failed to store user info:", error);
      }
    };

    storeUserInfo();
  }, [user]);

  const updateSessionTitle = async (firstMessage: string) => {
    if (!session || session.messageCount > 0) return;

    try {
      // Generate a title from the first message
      const title =
        firstMessage.length > 50
          ? `${firstMessage.substring(0, 50)}...`
          : firstMessage;

      await blink.db.chatSessions.update(session.id, {
        title,
        updatedAt: new Date().toISOString(),
      });

      setSession((prev) => (prev ? { ...prev, title } : null));
    } catch (error) {
      console.error("Failed to update session title:", error);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || !session) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    try {
      // Create user message
      const userMessageObj = await blink.db.messages.create({
        id: `msg_${Date.now()}_user`,
        chatSessionId: session.id,
        userId: user.id,
        role: "user",
        content: userMessage,
        createdAt: new Date().toISOString(),
      });

      // Update message queue with user message
      updateMessageQueue(userMessageObj);

      // Optimistically update UI
      const afterUserMessages = [...allMessages, userMessageObj];
      setAllMessages(afterUserMessages);
      setFilteredMessages((prev) => [...prev, userMessageObj]);

      // Update session title if this is the first message
      if (session.messageCount === 0) {
        await updateSessionTitle(userMessage);
      }

      // Generate AI response with streaming and markdown formatting
      let assistantContent = "";
      const assistantMessageId = `msg_${Date.now()}_assistant`;

      // Create placeholder assistant message
      const assistantMessage = {
        id: assistantMessageId,
        chatSessionId: session.id,
        userId: user.id,
        role: "assistant" as const,
        content: "",
        model: selectedModel,
        createdAt: new Date().toISOString(),
      };

      // Add placeholder to UI
      setAllMessages((prev) => [...prev, assistantMessage]);
      setFilteredMessages((prev) => [...prev, assistantMessage]);

      // Build context for LLM
      const llmContext = getLLMContext();
      const enhancedPrompt = `You are a helpful AI assistant. Please respond in markdown format to make your responses well-structured and easy to read.

${
  llmContext ? `Previous conversation context:\n${llmContext}\n\n` : ""
}User's latest message: ${userMessage}

Please provide a helpful response formatted in markdown. Use appropriate markdown elements like:
- **Bold** for emphasis
- *Italic* for subtle emphasis  
- \`code\` for technical terms
- Lists for multiple points
- Headers for organizing information
- Code blocks when sharing code examples

Keep your response conversational and helpful.`;

      console.log(
        `🤖 LLM Context (${messageQueue.length} messages):`,
        llmContext ? `${llmContext.substring(0, 200)}...` : "No context"
      );
      console.log(
        "🤖 Enhanced prompt:",
        `${enhancedPrompt.substring(0, 300)}...`
      );

      // Stream the response
      await blink.ai.streamText(
        {
          prompt: enhancedPrompt,
          model: selectedModel,
          maxTokens: 2000,
        },
        (chunk) => {
          assistantContent += chunk;

          // Update the message in real-time
          setAllMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: assistantContent }
                : msg
            )
          );
          setFilteredMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: assistantContent }
                : msg
            )
          );
        }
      );

      // Save the final assistant message to database
      await blink.db.messages.create({
        id: assistantMessageId,
        chatSessionId: session.id,
        userId: user.id,
        role: "assistant",
        content: assistantContent,
        model: selectedModel,
        createdAt: new Date().toISOString(),
      });

      const finalAssistantMessage = {
        ...assistantMessage,
        content: assistantContent,
      };

      // Update message queue with assistant message
      updateMessageQueue(finalAssistantMessage);

      const updatedMessages = [...afterUserMessages, finalAssistantMessage];

      // Update session
      await blink.db.chatSessions.update(session.id, {
        messageCount: session.messageCount + 2,
        model: selectedModel,
        updatedAt: new Date().toISOString(),
      });

      setSession((prev) =>
        prev
          ? {
              ...prev,
              messageCount: prev.messageCount + 2,
              model: selectedModel,
              updatedAt: new Date().toISOString(),
            }
          : null
      );

      // Smart bookmark generation: only create new bookmarks if needed, otherwise update existing ones
      try {
        await generateBookmarksForChat(session.id, user.id, updatedMessages);
      } catch (error) {
        console.error("Failed to auto-generate bookmarks:", error);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const createBookmark = async (messageId: string, content: string) => {
    try {
      // Generate bookmark title from message content
      const title =
        content.length > 30 ? `${content.substring(0, 30)}...` : content;

      await blink.db.bookmarks.create({
        id: `bookmark_${Date.now()}`,
        chatSessionId: session!.id,
        userId: user.id,
        title,
        description: content.substring(0, 100),
        messageIds: messageId, // Fixed: use messageIds (plural) to match database schema
        createdAt: new Date().toISOString(),
      });

      toast.success("Bookmark created!");
    } catch (error) {
      console.error("Failed to create bookmark:", error);
      toast.error("Failed to create bookmark");
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
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

  const selectedModelInfo = LLM_MODELS.find((m) => m.id === selectedModel);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="hover:bg-gray-100 text-gray-700"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-black">{session.title}</h1>
              {currentBookmark && (
                <Badge
                  variant="secondary"
                  className="bg-gray-100 text-gray-700 border-gray-200"
                >
                  <BookmarkIcon className="w-3 h-3 mr-1" />
                  {currentBookmark.title}
                </Badge>
              )}
              {focusMode && (
                <Badge
                  variant="outline"
                  className="border-gray-300 text-gray-700"
                >
                  <FilterIcon className="w-3 h-3 mr-1" />
                  Focus Mode
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {focusMode
                ? `${filteredMessages.length} filtered messages`
                : `${filteredMessages.length} messages`}
              {currentBookmark &&
                !focusMode &&
                ` • Viewing bookmark: ${currentBookmark.title}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={selectedModel}
            onValueChange={(value: LLMModel) => setSelectedModel(value)}
          >
            <SelectTrigger className="w-48 bg-white border-gray-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LLM_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{model.name}</span>
                    <span className="text-xs text-gray-500">
                      {model.provider}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFloatingTimeline(!showFloatingTimeline)}
            className="text-gray-700 hover:bg-gray-100"
            title="Show conversation timeline"
          >
            <ClockIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/settings")}
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
                navigate("/landing");
              } catch (error) {
                console.error("Failed to logout:", error);
              }
            }}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Bookmark Navigation */}
      {currentBookmark && bookmarkMessages.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookmarkIcon className="w-4 h-4 text-black" />
              <span className="text-sm font-medium text-black">
                {currentBookmark.title}
              </span>
              <Badge
                variant="secondary"
                className="text-xs bg-white text-gray-700 border-gray-200"
              >
                {bookmarkMessages.length} message
                {bookmarkMessages.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateBookmarkMessage("prev")}
                disabled={bookmarkMessageIndex === 0}
                className="h-8 w-8 p-0 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </Button>

              <span className="text-sm text-gray-600 min-w-[60px] text-center">
                {bookmarkMessageIndex + 1} of {bookmarkMessages.length}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateBookmarkMessage("next")}
                disabled={bookmarkMessageIndex === bookmarkMessages.length - 1}
                className="h-8 w-8 p-0 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center mx-auto mb-4 animate-float">
                <BotIcon className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Start a conversation
              </h3>
              <p className="text-muted-foreground">
                Ask me anything. I'm powered by {selectedModelInfo?.name}.
              </p>
            </div>
          ) : (
            filteredMessages.map((message) => {
              // Check if this message is part of the current bookmark
              const isBookmarkMessage =
                currentBookmark &&
                bookmarkMessages.some((bm) => bm.id === message.id);
              const isCurrentBookmarkMessage =
                isBookmarkMessage &&
                bookmarkMessages[bookmarkMessageIndex]?.id === message.id;

              return (
                <div
                  key={message.id}
                  id={`message-${message.id}`}
                  className={`flex gap-4 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center flex-shrink-0">
                      <BotIcon className="w-4 h-4 text-accent" />
                    </div>
                  )}

                  <div
                    className={`max-w-2xl ${
                      message.role === "user" ? "order-first" : ""
                    }`}
                  >
                    <Card
                      className={`p-4 transition-all duration-200 ${
                        message.role === "user"
                          ? "bg-accent text-accent-foreground ml-auto"
                          : "bg-card border-border"
                      } ${
                        isBookmarkMessage
                          ? "ring-2 ring-black/20 shadow-lg shadow-black/10"
                          : ""
                      } ${
                        isCurrentBookmarkMessage
                          ? "ring-2 ring-accent/50 shadow-xl shadow-accent/20"
                          : ""
                      }`}
                    >
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        {message.role === "assistant" ? (
                          <div
                            className="whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{
                              __html: message.content
                                .replace(
                                  /\*\*(.*?)\*\*/g,
                                  "<strong>$1</strong>"
                                )
                                .replace(/\*(.*?)\*/g, "<em>$1</em>")
                                .replace(
                                  /`(.*?)`/g,
                                  '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>'
                                )
                                .replace(
                                  /^### (.*$)/gm,
                                  '<h3 class="text-lg font-semibold mt-4 mb-2 text-foreground">$1</h3>'
                                )
                                .replace(
                                  /^## (.*$)/gm,
                                  '<h2 class="text-xl font-semibold mt-4 mb-2 text-foreground">$1</h2>'
                                )
                                .replace(
                                  /^# (.*$)/gm,
                                  '<h1 class="text-2xl font-bold mt-4 mb-2 text-foreground">$1</h1>'
                                )
                                .replace(
                                  /^- (.*$)/gm,
                                  '<li class="ml-4 list-disc">$1</li>'
                                )
                                .replace(
                                  /^(\d+)\. (.*$)/gm,
                                  '<li class="ml-4 list-decimal">$1. $2</li>'
                                )
                                .replace(/\n\n/g, "</p><p>")
                                .replace(/^/, "<p>")
                                .replace(/$/, "</p>"),
                            }}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap">
                            {message.content}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                        <span className="text-xs opacity-70">
                          {formatTime(message.createdAt)}
                          {message.model &&
                            ` • ${
                              LLM_MODELS.find((m) => m.id === message.model)
                                ?.name
                            }`}
                        </span>
                        {message.role === "assistant" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              createBookmark(message.id, message.content)
                            }
                            className="opacity-70 hover:opacity-100"
                          >
                            <BookmarkIcon className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  </div>

                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-foreground/10 to-foreground/5 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-4 h-4 text-foreground" />
                    </div>
                  )}
                </div>
              );
            })
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
                    <div
                      className="w-2 h-2 bg-accent rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-accent rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Thinking...
                  </span>
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

      {/* Floating Bookmark Timeline */}
      {showFloatingTimeline && (
        <FloatingBookmarkTimeline
          messages={allMessages}
          bookmarks={enhancedBookmarks}
          currentMessageIndex={currentMessageIndex}
          onBookmarkClick={handleBookmarkClick}
          onClose={() => setShowFloatingTimeline(false)}
          chatSessionId={id || ""}
        />
      )}
    </div>
  );
}

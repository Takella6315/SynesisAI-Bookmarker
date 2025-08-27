import { useState, useMemo } from "react";
import {
  BookmarkIcon,
  ClockIcon,
  MessageSquareIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XIcon,
  FilterIcon,
  TagIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { EnhancedBookmark, Message } from "../../types";

interface FloatingBookmarkTimelineProps {
  messages: Message[];
  bookmarks: EnhancedBookmark[];
  currentMessageIndex?: number;
  onBookmarkClick: (bookmark: EnhancedBookmark) => void;
  onClose: () => void;
  chatSessionId: string;
}

export default function FloatingBookmarkTimeline({
  messages,
  bookmarks,
  currentMessageIndex = 0,
  onBookmarkClick,
  onClose,
  chatSessionId,
}: FloatingBookmarkTimelineProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Sort bookmarks chronologically by message position
  const sortedBookmarks = useMemo(() => {
    return [...bookmarks]
      .filter((b) => b.chatSessionId === chatSessionId)
      .sort((a, b) => a.messagePosition - b.messagePosition);
  }, [bookmarks, chatSessionId]);

  // Filter bookmarks by category
  const filteredBookmarks = useMemo(() => {
    if (filterCategory === "all") return sortedBookmarks;
    return sortedBookmarks.filter((b) => b.category === filterCategory);
  }, [sortedBookmarks, filterCategory]);

  // Get unique categories for filtering
  const categories = useMemo(() => {
    const cats = new Set(
      bookmarks.map((b) => b.category).filter(Boolean) as string[]
    );
    return Array.from(cats);
  }, [bookmarks]);

  // Calculate timeline visualization
  const timelineData = useMemo(() => {
    const totalMessages = messages.length;
    return filteredBookmarks.map((bookmark) => ({
      ...bookmark,
      progressPercentage:
        (bookmark.messagePosition / Math.max(totalMessages - 1, 1)) * 100,
      isCurrentlyViewed:
        currentMessageIndex >= bookmark.messagePosition - 2 &&
        currentMessageIndex <= bookmark.messagePosition + 2,
    }));
  }, [filteredBookmarks, messages.length, currentMessageIndex]);

  // Format timestamp relative to conversation start
  const formatRelativeTime = (bookmark: EnhancedBookmark) => {
    if (messages.length === 0) return "";
    const messageIndex = bookmark.messagePosition;
    const totalMessages = messages.length;
    const percentage = Math.round(
      (messageIndex / Math.max(totalMessages - 1, 1)) * 100
    );
    return `${percentage}% through conversation`;
  };

  if (isMinimized) {
    return (
      <div className="fixed top-20 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          variant="outline"
          size="sm"
          className="bg-background/95 backdrop-blur-sm border-border shadow-lg hover:shadow-xl transition-all"
        >
          <BookmarkIcon className="w-4 h-4 mr-2" />
          <span className="text-sm">{filteredBookmarks.length} Bookmarks</span>
          <ChevronUpIcon className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-20 right-4 z-50 w-96 max-h-[70vh]">
      <Card className="bg-background/95 backdrop-blur-sm border-border shadow-lg hover:shadow-xl transition-all">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BookmarkIcon className="w-5 h-5" />
              Conversation Bookmarks
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                onClick={() => setIsMinimized(true)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <ChevronDownIcon className="w-4 h-4" />
              </Button>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <XIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Timeline Progress Bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Conversation Timeline</span>
              <span>{filteredBookmarks.length} bookmarks</span>
            </div>
            <div className="relative h-2 bg-muted rounded-full">
              <div
                className="absolute h-full bg-accent rounded-full transition-all duration-300"
                style={{
                  width: `${
                    (currentMessageIndex / Math.max(messages.length - 1, 1)) *
                    100
                  }%`,
                }}
              />
              {/* Bookmark markers on timeline */}
              {timelineData.map((bookmark) => (
                <button
                  key={bookmark.id}
                  onClick={() => onBookmarkClick(bookmark)}
                  className={`absolute top-0 h-2 w-1 rounded-full transition-all duration-200 hover:scale-y-150 ${
                    bookmark.isCurrentlyViewed
                      ? "bg-primary shadow-md scale-y-125"
                      : "bg-muted-foreground/60 hover:bg-primary/80"
                  }`}
                  style={{ left: `${bookmark.progressPercentage}%` }}
                  title={`${bookmark.title} - ${formatRelativeTime(bookmark)}`}
                />
              ))}
            </div>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <FilterIcon className="w-4 h-4 text-muted-foreground" />
              <div className="flex flex-wrap gap-1">
                <Button
                  onClick={() => setFilterCategory("all")}
                  variant={filterCategory === "all" ? "default" : "outline"}
                  size="sm"
                  className="h-6 px-2 text-xs"
                >
                  All
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category}
                    onClick={() => setFilterCategory(category)}
                    variant={
                      filterCategory === category ? "default" : "outline"
                    }
                    size="sm"
                    className="h-6 px-2 text-xs"
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-0">
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {timelineData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookmarkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    No bookmarks in this conversation yet
                  </p>
                </div>
              ) : (
                timelineData.map((bookmark, index) => (
                  <div key={bookmark.id} className="relative">
                    {/* Timeline connector */}
                    {index < timelineData.length - 1 && (
                      <div className="absolute left-3 top-12 bottom-0 w-px bg-border" />
                    )}

                    <div
                      onClick={() => onBookmarkClick(bookmark)}
                      className={`relative cursor-pointer p-3 rounded-lg border transition-all duration-200 hover:shadow-md ${
                        bookmark.isCurrentlyViewed
                          ? "bg-accent/20 border-accent shadow-sm"
                          : "bg-background hover:bg-accent/10 border-border"
                      }`}
                    >
                      {/* Timeline dot */}
                      <div
                        className={`absolute left-3 top-3 w-2 h-2 rounded-full ${
                          bookmark.isCurrentlyViewed
                            ? "bg-primary"
                            : "bg-muted-foreground"
                        }`}
                      />

                      <div className="ml-6">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-sm line-clamp-2 flex-1">
                            {bookmark.title}
                          </h4>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquareIcon className="w-3 h-3" />
                            <span>#{bookmark.messagePosition + 1}</span>
                          </div>
                        </div>

                        {bookmark.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {bookmark.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            {bookmark.category && (
                              <Badge
                                variant="secondary"
                                className="text-xs px-1.5 py-0.5"
                              >
                                <TagIcon className="w-2.5 h-2.5 mr-1" />
                                {bookmark.category}
                              </Badge>
                            )}
                            {bookmark.segmentContext && (
                              <Badge
                                variant="outline"
                                className="text-xs px-1.5 py-0.5"
                              >
                                Topic: {bookmark.segmentContext.title}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ClockIcon className="w-3 h-3" />
                            <span>{formatRelativeTime(bookmark)}</span>
                          </div>
                        </div>

                        {/* Progress indicator */}
                        <div className="mt-2">
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-accent to-primary rounded-full transition-all duration-300"
                              style={{
                                width: `${bookmark.progressPercentage}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

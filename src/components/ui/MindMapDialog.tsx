import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './dialog';
import { Button } from './button';
import { XIcon, MapIcon } from 'lucide-react';
import MindMapView from './MindMapView';
import { ChatSession, Bookmark } from '../../types';

interface MindMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chats: ChatSession[];
  bookmarks: Bookmark[];
  onChatClick?: (chatId: string) => void;
  onBookmarkClick?: (bookmarkId: string, chatId: string) => void;
}

export default function MindMapDialog({ 
  open, 
  onOpenChange, 
  chats, 
  bookmarks, 
  onChatClick, 
  onBookmarkClick 
}: MindMapDialogProps) {
  const handleChatClick = (chatId: string) => {
    if (onChatClick) {
      onChatClick(chatId);
      onOpenChange(false); // Close dialog when navigating
    }
  };

  const handleBookmarkClick = (bookmarkId: string, chatId: string) => {
    if (onBookmarkClick) {
      onBookmarkClick(bookmarkId, chatId);
      onOpenChange(false); // Close dialog when navigating
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] w-[95vw] h-[85vh] p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <MapIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Knowledge Mind Map
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Interactive visualization of your chats and bookmarks. Click on nodes to navigate.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 relative overflow-hidden">
          {chats.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapIcon className="w-8 h-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Data to Visualize</h3>
                <p className="text-gray-500 text-sm">
                  Start creating chats and bookmarks to see them in the mind map!
                </p>
              </div>
            </div>
          ) : (
            <MindMapView
              chats={chats}
              bookmarks={bookmarks}
              onChatClick={handleChatClick}
              onBookmarkClick={handleBookmarkClick}
            />
          )}
        </div>
        
        {chats.length > 0 && (
          <div className="px-6 py-3 border-t border-border bg-gray-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded"></div>
                  <span>Chat Sessions ({chats.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gradient-to-br from-amber-400 to-amber-500 rounded"></div>
                  <span>Bookmarks ({bookmarks.length})</span>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                💡 Tip: Drag nodes to reorganize • Use mouse wheel to zoom
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

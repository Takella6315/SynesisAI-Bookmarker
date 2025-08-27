import { useState } from 'react';
import { Card } from './card';
import { Button } from './button';
import {
  FolderIcon,
  FolderOpenIcon,
  MessageSquareIcon,
  BookmarkIcon,
  ExternalLinkIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface FolderCardProps {
  title: string
  subtitle?: string
  description?: string
  icon?: 'folder' | 'chat' | 'bookmark'
  messageCount?: number
  timestamp?: string
  onOpen?: () => void
  onGoInto?: () => void
  className?: string
  isBookmark?: boolean
}

export function FolderCard({
  title,
  subtitle,
  description,
  icon = 'folder',
  messageCount,
  timestamp,
  onOpen,
  onGoInto,
  className,
  isBookmark = false,
}: FolderCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getIcon = () => {
    switch (icon) {
      case 'chat':
        return <MessageSquareIcon className="w-6 h-6 text-accent" />;
      case 'bookmark':
        return <BookmarkIcon className="w-5 h-5 text-accent" />;
      default:
        return <FolderIcon className="w-6 h-6 text-accent text-black" />;
    }
  };

  return (
    <Card
      className={cn(
        'folder-card p-6 cursor-pointer border-border backdrop-blur-sm transition-all duration-300 group',
        'hover:shadow-lg hover:shadow-accent/10 hover:scale-[1.02]',
        isBookmark && 'bg-accent/5 border-accent/20',
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
            {getIcon()}
          </div>
          {timestamp && (
            <div className="text-xs text-muted-foreground">
              {timestamp}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground line-clamp-2">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground">
              {subtitle}
            </p>
          )}
          {description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {description}
            </p>
          )}
          {messageCount !== undefined && (
            <p className="text-sm text-muted-foreground">
              {messageCount} messages
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {onOpen && (
            <Button
              variant="default"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="flex-1 bg-black border-accent/30 text-white"
            >
              <ExternalLinkIcon className="w-3 h-3 mr-1" />
              Open
            </Button>
          )}
          {onGoInto && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onGoInto();
              }}
              className="flex-1 bg-black border-accent/30 text-white"
            >
              <ChevronRightIcon className="w-3 h-3 mr-1" />
              Go Into
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

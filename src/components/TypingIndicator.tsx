import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface TypingIndicatorProps {
  typingUsers: Array<{ user_id: string; is_typing: boolean }>;
  className?: string;
}

export function TypingIndicator({ typingUsers, className = '' }: TypingIndicatorProps) {
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    const hasTypingUsers = typingUsers.some(user => user.is_typing);
    setShowIndicator(hasTypingUsers);
  }, [typingUsers]);

  if (!showIndicator) return null;

  return (
    <div className={`flex items-center gap-2 text-muted-foreground text-sm ${className}`}>
      <Loader2 className="h-3 w-3 animate-spin" />
      <span>Someone is typing...</span>
      <div className="flex gap-1">
        <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
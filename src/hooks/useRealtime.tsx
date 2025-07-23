import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeProps {
  sessionId?: string;
  onNewMessage?: (message: any) => void;
  onTypingChange?: (typingUsers: any[]) => void;
  onSessionUpdate?: (session: any) => void;
}

export const useRealtime = ({
  sessionId,
  onNewMessage,
  onTypingChange,
  onSessionUpdate,
}: UseRealtimeProps) => {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // Create channel for the specific session
    const channel = supabase.channel(`session:${sessionId}`, {
      config: {
        presence: {
          key: sessionId,
        },
      },
    });

    // Listen to new messages
    if (onNewMessage) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('New message received:', payload.new);
          onNewMessage(payload.new);
        }
      );
    }

    // Listen to typing status changes
    if (onTypingChange) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_status',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('Typing status changed:', payload);
          // Fetch current typing users
          fetchTypingUsers();
        }
      );
    }

    // Listen to session updates
    if (onSessionUpdate) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('Session updated:', payload.new);
          onSessionUpdate(payload.new);
        }
      );
    }

    const fetchTypingUsers = async () => {
      if (!onTypingChange) return;
      
      try {
        const { data } = await supabase
          .from('typing_status')
          .select('user_id, is_typing')
          .eq('session_id', sessionId)
          .eq('is_typing', true);
        
        onTypingChange(data || []);
      } catch (error) {
        console.error('Error fetching typing users:', error);
      }
    };

    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log('Realtime subscription status:', status);
      if (status === 'SUBSCRIBED') {
        fetchTypingUsers();
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [sessionId, onNewMessage, onTypingChange, onSessionUpdate]);

  const updateTypingStatus = async (isTyping: boolean) => {
    if (!sessionId) return;

    try {
      const { data: existingStatus } = await supabase
        .from('typing_status')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (existingStatus) {
        await supabase
          .from('typing_status')
          .update({ 
            is_typing: isTyping, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', existingStatus.id);
      } else {
        await supabase
          .from('typing_status')
          .insert({
            session_id: sessionId,
            user_id: (await supabase.auth.getUser()).data.user?.id,
            is_typing: isTyping,
          });
      }
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  };

  return {
    updateTypingStatus,
  };
};
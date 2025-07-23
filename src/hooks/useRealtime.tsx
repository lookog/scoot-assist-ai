import { useEffect, useRef, useCallback } from 'react';
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

  // Stable callback references to prevent reconnections
  const handleNewMessage = useCallback((payload: any) => {
    console.log('New message received:', payload.new);
    onNewMessage?.(payload.new);
  }, [onNewMessage]);

  const handleTypingChange = useCallback(async (payload: any) => {
    console.log('Typing status changed:', payload);
    if (!onTypingChange || !sessionId) return;
    
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
  }, [onTypingChange, sessionId]);

  const handleSessionUpdate = useCallback((payload: any) => {
    console.log('Session updated:', payload.new);
    onSessionUpdate?.(payload.new);
  }, [onSessionUpdate]);

  useEffect(() => {
    if (!sessionId) {
      // Clean up any existing channel if no sessionId
      if (channelRef.current) {
        console.log('Cleaning up realtime channel - no sessionId');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Clean up existing channel before creating new one
    if (channelRef.current) {
      console.log('Cleaning up existing realtime channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    console.log('Setting up realtime channel for session:', sessionId);

    // Create a single channel for the session
    const channel = supabase.channel(`session-${sessionId}`, {
      config: {
        presence: {
          key: sessionId,
        },
      },
    });

    // Set up message listener only if callback provided
    if (onNewMessage) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${sessionId}`,
        },
        handleNewMessage
      );
    }

    // Set up typing status listener only if callback provided
    if (onTypingChange) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_status',
          filter: `session_id=eq.${sessionId}`,
        },
        handleTypingChange
      );
    }

    // Set up session update listener only if callback provided
    if (onSessionUpdate) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_sessions',
          filter: `id=eq.${sessionId}`,
        },
        handleSessionUpdate
      );
    }

    // Subscribe to the channel
    channel.subscribe((status) => {
      console.log('Realtime subscription status:', status);
      
      // Initial typing users fetch when connected
      if (status === 'SUBSCRIBED' && onTypingChange) {
        handleTypingChange({});
      }
    });

    channelRef.current = channel;

    // Cleanup function
    return () => {
      console.log('Cleaning up realtime channel in useEffect cleanup');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionId]); // Only depend on sessionId, not the callbacks

  const updateTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!sessionId) return;

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      const { data: existingStatus } = await supabase
        .from('typing_status')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', user.data.user.id)
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
            user_id: user.data.user.id,
            is_typing: isTyping,
          });
      }
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, [sessionId]);

  return {
    updateTypingStatus,
  };
};
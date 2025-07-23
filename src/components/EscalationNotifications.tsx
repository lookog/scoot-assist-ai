import { useState, useEffect } from 'react';
import { Bell, X, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EscalationNotification {
  id: string;
  session_id: string;
  status: string;
  original_question: string;
  resolution_notes?: string;
  resolved_at?: string;
}

interface EscalationNotificationsProps {
  sessionId?: string;
}

export function EscalationNotifications({ sessionId }: EscalationNotificationsProps) {
  const [notifications, setNotifications] = useState<EscalationNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const checkForResolvedEscalations = async () => {
      try {
        const query = supabase
          .from('escalated_queries')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'resolved')
          .not('resolved_at', 'is', null); // Only show truly resolved queries

        if (sessionId) {
          query.eq('session_id', sessionId);
        }

        const { data, error } = await query;
        
        if (error) throw error;
        
        const resolvedToday = data?.filter(eq => {
          const resolvedDate = new Date(eq.resolved_at);
          const today = new Date();
          return (
            resolvedDate.toDateString() === today.toDateString() &&
            !dismissedNotifications.has(eq.id)
          );
        }) || [];

        setNotifications(resolvedToday);
      } catch (error) {
        console.error('Error checking escalations:', error);
      }
    };

    checkForResolvedEscalations();

    // Set up real-time subscription for escalation updates
    const channel = supabase
      .channel('escalation-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'escalated_queries',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          if (
            payload.new.status === 'resolved' && 
            payload.old.status !== 'resolved' &&
            payload.new.resolved_at &&
            !dismissedNotifications.has(payload.new.id)
          ) {
            setNotifications(prev => [...prev, payload.new]);
            toast({
              title: "✅ Query Resolved",
              description: "One of your escalated queries has been resolved!",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, sessionId, dismissedNotifications]);

  const dismissNotification = (notificationId: string) => {
    setDismissedNotifications(prev => new Set([...prev, notificationId]));
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const dismissAllNotifications = () => {
    const allIds = notifications.map(n => n.id);
    setDismissedNotifications(prev => new Set([...prev, ...allIds]));
    setNotifications([]);
  };

  if (notifications.length === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {notifications.length > 0 && (
          <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
            {notifications.length}
          </Badge>
        )}
      </Button>

      {showNotifications && (
        <Card className="absolute top-10 right-0 w-80 z-50 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Resolved Queries</h3>
              <div className="flex items-center gap-2">
                {notifications.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={dismissAllNotifications}
                    className="text-xs h-6 px-2"
                  >
                    Dismiss All
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNotifications(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Query Resolved
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                        "{notification.original_question}"
                      </p>
                      {notification.resolution_notes && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-2 p-2 bg-green-100 dark:bg-green-900/30 rounded">
                          {notification.resolution_notes}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissNotification(notification.id)}
                      className="h-6 w-6 p-0 text-green-600 hover:text-green-800"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
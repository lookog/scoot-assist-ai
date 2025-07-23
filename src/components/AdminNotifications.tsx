import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, AlertTriangle, Package, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export function AdminNotifications() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useAdminNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleDrillDown = (notification: any) => {
    if (notification.type === 'escalation') {
      navigate('/admin/escalated');
    } else if (notification.type === 'order_inquiry') {
      navigate('/admin/order-inquiries');
    }
    setIsOpen(false);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'escalation':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'order_inquiry':
        return <Package className="h-4 w-4 text-primary" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getNotificationVariant = (type: string) => {
    switch (type) {
      case 'escalation':
        return 'destructive';
      case 'order_inquiry':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const handleNotificationClick = async (notification: any) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="space-y-4">
          <SheetTitle className="flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-auto p-1"
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          <div className="space-y-4">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    !notification.is_read ? 'border-primary/50 bg-primary/5' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getNotificationIcon(notification.type)}
                        <CardTitle className="text-sm font-medium">
                          {notification.title}
                        </CardTitle>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-primary rounded-full" />
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        className="h-auto p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-2">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={getNotificationVariant(notification.type)} className="text-xs">
                        {notification.type.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>

                    {/* Show relevant data based on notification type */}
                    {notification.type === 'escalation' && notification.data?.original_question && (
                      <>
                        <Separator className="my-2" />
                        <div className="text-xs">
                          <p className="font-medium text-muted-foreground">Original Question:</p>
                          <p className="text-foreground">
                            {notification.data.original_question.substring(0, 100)}
                            {notification.data.original_question.length > 100 ? '...' : ''}
                          </p>
                        </div>
                      </>
                    )}

                    {notification.type === 'order_inquiry' && notification.data?.inquiry_type && (
                      <>
                        <Separator className="my-2" />
                        <div className="text-xs">
                          <p className="font-medium text-muted-foreground">Inquiry Type:</p>
                          <p className="text-foreground">{notification.data.inquiry_type}</p>
                        </div>
                      </>
                    )}
                    
                    {/* Drill-down button */}
                    <div className="flex justify-end mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDrillDown(notification);
                        }}
                        className="h-7 text-xs"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
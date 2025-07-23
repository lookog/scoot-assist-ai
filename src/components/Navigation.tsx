import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { MessageCircle, History, User } from "lucide-react";
import { cn } from "@/lib/utils";

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageCircle,
      path: '/chat'
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '/history'
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      path: '/profile'
    }
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <Card className="fixed bottom-0 left-0 right-0 border-t border-l-0 border-r-0 border-b-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="flex items-center justify-around p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-lg transition-colors min-w-[4rem]",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
};

export default Navigation;
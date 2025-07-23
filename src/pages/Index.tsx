import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, History, User, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const quickActions = [
    {
      title: "Start New Chat",
      description: "Get instant help with your scooter",
      icon: MessageCircle,
      action: () => navigate("/chat"),
      color: "bg-primary text-primary-foreground"
    },
    {
      title: "View History",
      description: "Browse your previous conversations",
      icon: History,
      action: () => navigate("/history"),
      color: "bg-secondary text-secondary-foreground"
    },
    {
      title: "Manage Profile",
      description: "Update your account settings",
      icon: User,
      action: () => navigate("/profile"),
      color: "bg-muted text-muted-foreground"
    }
  ];

  return (
    <div className="p-4 space-y-6">
      {/* Hero Section */}
      <div className="text-center py-8">
        <div className="mb-6">
          <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome to ScootAssist AI
          </h1>
          <p className="text-muted-foreground">
            Hello {user?.email?.split('@')[0] || user?.phone || 'there'}! 👋
          </p>
        </div>
        
        <p className="text-muted-foreground max-w-md mx-auto">
          Your AI-powered scooter assistance is ready to help with support, 
          troubleshooting, and any questions you have.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        {quickActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Card 
              key={index}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={action.action}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${action.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Start a conversation to see your recent activity here
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;

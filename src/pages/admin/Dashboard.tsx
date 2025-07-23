import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, HelpCircle, Users, TrendingUp } from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalQuestions: 0,
    escalatedQueries: 0,
    totalSessions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersResult, questionsResult, escalatedResult, sessionsResult] = await Promise.all([
          supabase.from('users').select('id', { count: 'exact', head: true }),
          supabase.from('qa_items').select('id', { count: 'exact', head: true }),
          supabase.from('escalated_queries').select('id', { count: 'exact', head: true }),
          supabase.from('chat_sessions').select('id', { count: 'exact', head: true }),
        ]);

        setStats({
          totalUsers: usersResult.count || 0,
          totalQuestions: questionsResult.count || 0,
          escalatedQueries: escalatedResult.count || 0,
          totalSessions: sessionsResult.count || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      description: 'Registered users',
    },
    {
      title: 'FAQ Items',
      value: stats.totalQuestions,
      icon: HelpCircle,
      description: 'Available Q&A items',
    },
    {
      title: 'Escalated Queries',
      value: stats.escalatedQueries,
      icon: MessageSquare,
      description: 'Queries needing attention',
    },
    {
      title: 'Chat Sessions',
      value: stats.totalSessions,
      icon: TrendingUp,
      description: 'Total conversations',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of your ScootAssist platform</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Activity tracking coming soon...</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button className="w-full text-left p-2 rounded hover:bg-muted">
              Manage FAQ Items
            </button>
            <button className="w-full text-left p-2 rounded hover:bg-muted">
              Review Escalated Queries
            </button>
            <button className="w-full text-left p-2 rounded hover:bg-muted">
              View Analytics
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
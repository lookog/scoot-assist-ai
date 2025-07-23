import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, TrendingUp, Users, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Analytics = () => {
  const [analytics, setAnalytics] = useState({
    topQuestions: [],
    categoryStats: [],
    userEngagement: {
      totalSessions: 0,
      avgSessionLength: 0,
      totalMessages: 0,
    },
    escalationStats: {
      totalEscalated: 0,
      resolved: 0,
      pending: 0,
    }
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch top viewed questions (handle null view_count)
      const { data: topQuestions } = await supabase
        .from('qa_items')
        .select('question, view_count')
        .order('view_count', { ascending: false, nullsFirst: false })
        .limit(10);

      // Fetch category statistics
      const { data: categories } = await supabase
        .from('qa_categories')
        .select(`
          name,
          qa_items (id)
        `);

      const categoryStats = categories?.map(cat => ({
        name: cat.name,
        count: cat.qa_items?.length || 0
      })) || [];

      // Fetch user engagement stats
      const [sessionsResult, messagesResult] = await Promise.all([
        supabase.from('chat_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('messages').select('id', { count: 'exact', head: true }),
      ]);

      // Fetch escalation stats
      const [totalEscalated, resolved, pending] = await Promise.all([
        supabase.from('escalated_queries').select('id', { count: 'exact', head: true }),
        supabase.from('escalated_queries').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabase.from('escalated_queries').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setAnalytics({
        topQuestions: topQuestions || [],
        categoryStats,
        userEngagement: {
          totalSessions: sessionsResult.count || 0,
          avgSessionLength: 0, // Would need more complex query
          totalMessages: messagesResult.count || 0,
        },
        escalationStats: {
          totalEscalated: totalEscalated.count || 0,
          resolved: resolved.count || 0,
          pending: pending.count || 0,
        }
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

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
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-muted-foreground">Performance insights and metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => navigate('/admin/chat-review')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.userEngagement.totalSessions}</div>
            <p className="text-xs text-muted-foreground">Chat conversations</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => navigate('/admin/chat-review')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.userEngagement.totalMessages}</div>
            <p className="text-xs text-muted-foreground">Messages exchanged</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => navigate('/admin/escalated-queries')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escalations</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.escalationStats.totalEscalated}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.escalationStats.resolved} resolved, {analytics.escalationStats.pending} pending
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => navigate('/admin/escalated-queries')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.escalationStats.totalEscalated > 0 
                ? Math.round((analytics.escalationStats.resolved / analytics.escalationStats.totalEscalated) * 100)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Queries resolved</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Questions */}
        <Card>
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate('/admin/faq-management')}
          >
            <CardTitle>Most Viewed Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topQuestions.map((item: any, index) => (
                <div 
                  key={index} 
                  className="flex justify-between items-start cursor-pointer hover:bg-muted/30 p-2 rounded transition-colors"
                  onClick={() => navigate('/admin/faq-management')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.question}</p>
                  </div>
                  <div className="ml-4 text-sm text-muted-foreground">
                    {item.view_count || 0} views
                  </div>
                </div>
              ))}
              {analytics.topQuestions.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate('/admin/category-management')}
          >
            <CardTitle>Questions by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.categoryStats.map((category: any, index) => (
                <div 
                  key={index} 
                  className="flex justify-between items-center cursor-pointer hover:bg-muted/30 p-2 rounded transition-colors"
                  onClick={() => navigate('/admin/category-management')}
                >
                  <span className="text-sm font-medium">{category.name}</span>
                  <span className="text-sm text-muted-foreground">{category.count} items</span>
                </div>
              ))}
              {analytics.categoryStats.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No categories available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Analytics Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Advanced analytics features like time-series charts, user behavior tracking, 
            and performance metrics will be available in future updates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;
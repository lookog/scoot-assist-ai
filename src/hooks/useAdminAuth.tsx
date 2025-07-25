import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AdminContextType {
  user: User | null;
  session: Session | null;
  adminData: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [adminData, setAdminData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer admin data fetching to avoid deadlocks
          setTimeout(async () => {
            try {
              const { data: adminUser } = await supabase
                .from('admin_users')
                .select('*')
                .eq('id', session.user.id)
                .eq('is_active', true)
                .single();
              
              setAdminData(adminUser);
            } catch (error) {
              console.error('Error fetching admin data:', error);
              setAdminData(null);
            }
            setLoading(false);
          }, 0);
        } else {
          setAdminData(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          const { data: adminUser } = await supabase
            .from('admin_users')
            .select('*')
            .eq('id', session.user.id)
            .eq('is_active', true)
            .single();
          
          setAdminData(adminUser);
        } catch (error) {
          console.error('Error fetching admin data:', error);
          setAdminData(null);
        }
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      // Clean up any existing auth state first
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          localStorage.removeItem(key);
        }
      });

      // Attempt global sign out
      await supabase.auth.signOut({ scope: 'global' });
      
      // Force page refresh to ensure clean state
      window.location.href = '/admin/auth';
    } catch (error) {
      console.error('Error signing out:', error);
      // Force redirect even if signout fails
      window.location.href = '/admin/auth';
    }
  };

  return (
    <AdminContext.Provider value={{ user, session, adminData, loading, signOut }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminProvider');
  }
  return context;
};
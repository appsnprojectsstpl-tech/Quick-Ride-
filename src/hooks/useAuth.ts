import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface AuthState {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: {
    name: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  isLoading: boolean;
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    profile: null,
    isLoading: true,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          fetchUserData(session.user.id);
        } else {
          setState({
            user: null,
            session: null,
            role: null,
            profile: null,
            isLoading: false,
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      const [sessionResult, roleResult, profileResult] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from('user_roles').select('role').eq('user_id', userId).single(),
        supabase.from('profiles').select('name, phone, avatar_url').eq('user_id', userId).single(),
      ]);

      setState({
        user: sessionResult.data.session?.user || null,
        session: sessionResult.data.session,
        role: roleResult.data?.role || null,
        profile: profileResult.data || null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { ...state, signOut };
};

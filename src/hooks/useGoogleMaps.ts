import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useGoogleMapsApiKey = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchApiKey = async () => {
      try {
        // Wait for session to be available
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (isMounted) {
            setError('Authentication required');
            setIsLoading(false);
          }
          return;
        }

        const { data, error } = await supabase.functions.invoke('get-maps-key');
        
        if (!isMounted) return;
        
        if (error) throw error;
        if (!data?.apiKey) throw new Error('No API key returned');
        
        setApiKey(data.apiKey);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load maps');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Listen for auth state changes and fetch when authenticated
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && !apiKey) {
        fetchApiKey();
      }
    });

    // Initial fetch attempt
    fetchApiKey();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [apiKey]);

  return { apiKey, isLoading, error };
};

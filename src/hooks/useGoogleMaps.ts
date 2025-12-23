import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useGoogleMapsApiKey = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-maps-key');
        
        if (error) throw error;
        if (!data?.apiKey) throw new Error('No API key returned');
        
        setApiKey(data.apiKey);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load maps');
      } finally {
        setIsLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  return { apiKey, isLoading, error };
};

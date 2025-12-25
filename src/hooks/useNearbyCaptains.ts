import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NearbyCaptain {
  id: string;
  lat: number;
  lng: number;
  distance_km: number;
  vehicle_type: 'bike' | 'auto' | 'cab';
  rating: number | null;
}

interface UseNearbyCaptainsOptions {
  lat: number | null;
  lng: number | null;
  radiusKm?: number;
  enabled?: boolean;
  pollIntervalMs?: number;
}

export const useNearbyCaptains = ({
  lat,
  lng,
  radiusKm = 3,
  enabled = true,
  pollIntervalMs = 10000,
}: UseNearbyCaptainsOptions) => {
  const [nearbyCaptains, setNearbyCaptains] = useState<NearbyCaptain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchNearbyCaptains = useCallback(async () => {
    if (!lat || !lng || !enabled) return;

    // Rate limit: minimum 5 seconds between calls
    const now = Date.now();
    if (now - lastFetchRef.current < 5000) return;
    lastFetchRef.current = now;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.functions.invoke('get-nearby-captains', {
        body: { lat, lng, radius_km: radiusKm },
      });

      if (fetchError) throw fetchError;

      setNearbyCaptains(data?.captains || []);
    } catch (err) {
      console.error('[useNearbyCaptains] Error:', err);
      setError('Failed to fetch nearby captains');
    } finally {
      setIsLoading(false);
    }
  }, [lat, lng, radiusKm, enabled]);

  // Initial fetch and polling
  useEffect(() => {
    if (!enabled || !lat || !lng) {
      setNearbyCaptains([]);
      return;
    }

    fetchNearbyCaptains();

    const interval = setInterval(fetchNearbyCaptains, pollIntervalMs);

    return () => clearInterval(interval);
  }, [fetchNearbyCaptains, enabled, lat, lng, pollIntervalMs]);

  // Realtime subscription for captain location updates
  useEffect(() => {
    if (!enabled || !lat || !lng) return;

    const channel = supabase
      .channel('nearby-captains-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'captains',
          filter: 'status=eq.online',
        },
        () => {
          // Debounce realtime updates
          setTimeout(fetchNearbyCaptains, 1000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, lat, lng, fetchNearbyCaptains]);

  return {
    nearbyCaptains,
    isLoading,
    error,
    refetch: fetchNearbyCaptains,
  };
};

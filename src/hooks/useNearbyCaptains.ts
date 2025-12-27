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
  vehicleType?: 'bike' | 'auto' | 'cab' | null;
  enabled?: boolean;
  pollIntervalMs?: number;
}

export const useNearbyCaptains = ({
  lat,
  lng,
  radiusKm = 3,
  vehicleType = null,
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
      const res = await fetch('http://localhost:3001/api/get-nearby-captains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, radius_km: radiusKm })
      });
      const data = await res.json();
      const fetchError = !res.ok ? data : null;

      if (fetchError) throw fetchError;

      let captains = data?.captains || [];

      // Filter by vehicle type if specified
      if (vehicleType) {
        captains = captains.filter((c: NearbyCaptain) => c.vehicle_type === vehicleType);
      }

      setNearbyCaptains(captains);
    } catch (err) {
      console.error('[useNearbyCaptains] Error:', err);
      setError('Failed to fetch nearby captains');
    } finally {
      setIsLoading(false);
    }
  }, [lat, lng, radiusKm, vehicleType, enabled]);

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

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CaptainLocation {
  lat: number;
  lng: number;
  updatedAt: string;
}

interface UseCaptainTrackingOptions {
  captainId: string | null;
  enabled: boolean;
}

export const useCaptainTracking = ({ captainId, enabled }: UseCaptainTrackingOptions) => {
  const [captainLocation, setCaptainLocation] = useState<CaptainLocation | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!captainId || !enabled) {
      setCaptainLocation(null);
      setIsTracking(false);
      return;
    }

    setIsTracking(true);

    // Fetch initial captain location
    const fetchCaptainLocation = async () => {
      const { data } = await supabase
        .from('captains')
        .select('current_lat, current_lng, location_updated_at')
        .eq('id', captainId)
        .single();

      if (data && data.current_lat && data.current_lng) {
        setCaptainLocation({
          lat: data.current_lat,
          lng: data.current_lng,
          updatedAt: data.location_updated_at || new Date().toISOString(),
        });
      }
    };

    fetchCaptainLocation();

    // Subscribe to captain location updates
    const channel = supabase
      .channel(`captain-location-${captainId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'captains',
          filter: `id=eq.${captainId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.current_lat && updated.current_lng) {
            setCaptainLocation({
              lat: updated.current_lat,
              lng: updated.current_lng,
              updatedAt: updated.location_updated_at || new Date().toISOString(),
            });
          }
        }
      )
      .subscribe();

    // Poll every 5 seconds as backup
    const pollInterval = setInterval(fetchCaptainLocation, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      setIsTracking(false);
    };
  }, [captainId, enabled]);

  return { captainLocation, isTracking };
};

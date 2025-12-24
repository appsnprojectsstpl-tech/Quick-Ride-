import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RideOffer {
  id: string;
  ride_id: string;
  expires_at: string;
  distance_to_pickup_km: number;
  eta_minutes: number;
  estimated_earnings: number;
  response_status: string;
  ride: {
    id: string;
    pickup_address: string;
    drop_address: string;
    estimated_distance_km: number;
    estimated_duration_mins: number;
    final_fare: number;
    vehicle_type: string;
    pickup_lat: number;
    pickup_lng: number;
    drop_lat: number;
    drop_lng: number;
  };
}

interface UseRideOffersOptions {
  captainId: string | null;
  enabled?: boolean;
}

export const useRideOffers = ({ captainId, enabled = true }: UseRideOffersOptions) => {
  const [currentOffer, setCurrentOffer] = useState<RideOffer | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check for pending offers on mount and subscribe to new ones
  useEffect(() => {
    if (!captainId || !enabled) {
      setCurrentOffer(null);
      return;
    }

    const checkPendingOffers = async () => {
      setIsLoading(true);
      try {
        const { data: offers, error } = await supabase
          .from('ride_offers')
          .select(`
            id,
            ride_id,
            expires_at,
            distance_to_pickup_km,
            eta_minutes,
            estimated_earnings,
            response_status,
            rides (
              id,
              pickup_address,
              drop_address,
              estimated_distance_km,
              estimated_duration_mins,
              final_fare,
              vehicle_type,
              pickup_lat,
              pickup_lng,
              drop_lat,
              drop_lng
            )
          `)
          .eq('captain_id', captainId)
          .eq('response_status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error fetching offers:', error);
          return;
        }

        if (offers && offers.length > 0) {
          const offer = offers[0];
          setCurrentOffer({
            ...offer,
            ride: offer.rides as any,
          });
        }
      } catch (error) {
        console.error('Error checking pending offers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkPendingOffers();

    // Subscribe to new offers via realtime
    const channel = supabase
      .channel(`captain-offers-${captainId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_offers',
          filter: `captain_id=eq.${captainId}`,
        },
        async (payload) => {
          console.log('[useRideOffers] New offer received:', payload.new);
          
          // Fetch full offer with ride details
          const { data: offer, error } = await supabase
            .from('ride_offers')
            .select(`
              id,
              ride_id,
              expires_at,
              distance_to_pickup_km,
              eta_minutes,
              estimated_earnings,
              response_status,
              rides (
                id,
                pickup_address,
                drop_address,
                estimated_distance_km,
                estimated_duration_mins,
                final_fare,
                vehicle_type,
                pickup_lat,
                pickup_lng,
                drop_lat,
                drop_lng
              )
            `)
            .eq('id', (payload.new as any).id)
            .single();

          if (!error && offer && offer.response_status === 'pending') {
            setCurrentOffer({
              ...offer,
              ride: offer.rides as any,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_offers',
          filter: `captain_id=eq.${captainId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          // If offer was responded to, clear it
          if (updated.response_status !== 'pending') {
            setCurrentOffer((current) => 
              current?.id === updated.id ? null : current
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [captainId, enabled]);

  const clearOffer = useCallback(() => {
    setCurrentOffer(null);
  }, []);

  return {
    currentOffer,
    isLoading,
    clearOffer,
  };
};

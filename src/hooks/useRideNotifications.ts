import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import type { Database } from '@/integrations/supabase/types';

type RideStatus = Database['public']['Enums']['ride_status'];

const statusMessages: Record<RideStatus, { title: string; description: string }> = {
  pending: { title: 'Ride Requested', description: 'Looking for nearby captains...' },
  matched: { title: 'Captain Found!', description: 'A captain has been assigned to your ride' },
  captain_arriving: { title: 'Captain On The Way', description: 'Your captain is heading to pickup location' },
  waiting_for_rider: { title: 'Captain Arrived', description: 'Your captain is waiting at the pickup point' },
  in_progress: { title: 'Ride Started', description: 'Enjoy your ride!' },
  completed: { title: 'Ride Completed', description: 'Thank you for riding with us' },
  cancelled: { title: 'Ride Cancelled', description: 'Your ride has been cancelled' },
};

const captainStatusMessages: Record<RideStatus, { title: string; description: string }> = {
  pending: { title: 'New Ride Request', description: 'A rider is looking for a ride' },
  matched: { title: 'Ride Assigned', description: 'You have been matched with a rider' },
  captain_arriving: { title: 'Navigate to Pickup', description: 'Head to the pickup location' },
  waiting_for_rider: { title: 'Waiting for Rider', description: 'The rider has been notified of your arrival' },
  in_progress: { title: 'Ride In Progress', description: 'Navigate to drop-off location' },
  completed: { title: 'Ride Completed', description: 'Great job! Earnings have been added' },
  cancelled: { title: 'Ride Cancelled', description: 'The ride has been cancelled' },
};

interface UseRideNotificationsOptions {
  userId?: string;
  captainId?: string;
  role: 'rider' | 'captain';
  onStatusChange?: (status: RideStatus, rideId: string) => void;
}

export const useRideNotifications = ({
  userId,
  captainId,
  role,
  onStatusChange,
}: UseRideNotificationsOptions) => {
  const { toast } = useToast();
  const { 
    requestPermission, 
    permission,
    notifyRideAccepted,
    notifyCaptainArriving,
    notifyCaptainArrived,
    notifyRideStarted,
    notifyRideCompleted,
    notifyRideCancelled,
    notifyRideRequest,
  } = usePushNotifications();

  const showNotification = useCallback((status: RideStatus, rideData?: any) => {
    const messages = role === 'rider' ? statusMessages : captainStatusMessages;
    const message = messages[status];
    
    if (message) {
      // In-app toast
      toast({
        title: message.title,
        description: message.description,
        duration: 5000,
      });

      // Push notification based on status
      if (permission === 'granted') {
        if (role === 'rider') {
          switch (status) {
            case 'matched':
              notifyRideAccepted(rideData?.captainName || 'Your captain', rideData?.vehicleInfo || '');
              break;
            case 'captain_arriving':
              notifyCaptainArriving(rideData?.eta || 'a few minutes');
              break;
            case 'waiting_for_rider':
              notifyCaptainArrived();
              break;
            case 'in_progress':
              notifyRideStarted(rideData?.dropAddress || 'destination');
              break;
            case 'completed':
              notifyRideCompleted(rideData?.fare || 0);
              break;
            case 'cancelled':
              notifyRideCancelled(rideData?.reason);
              break;
          }
        } else {
          // Captain notifications
          if (status === 'matched') {
            notifyRideRequest(rideData?.pickupAddress || 'Pickup location', rideData?.fare || 0);
          }
        }
      }
    }
  }, [role, toast, permission, notifyRideAccepted, notifyCaptainArriving, notifyCaptainArrived, notifyRideStarted, notifyRideCompleted, notifyRideCancelled, notifyRideRequest]);

  useEffect(() => {
    if (permission === 'default') {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!userId && !captainId) return;

    const channel = supabase
      .channel('ride-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rides',
        },
        (payload) => {
          const newRide = payload.new as Database['public']['Tables']['rides']['Row'];
          const oldRide = payload.old as Database['public']['Tables']['rides']['Row'];

          // Check if this update is relevant to the user
          const isRelevant = role === 'rider' 
            ? newRide.rider_id === userId
            : newRide.captain_id === captainId;

          if (isRelevant && newRide.status !== oldRide.status) {
            showNotification(newRide.status);
            onStatusChange?.(newRide.status, newRide.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rides',
        },
        (payload) => {
          const newRide = payload.new as Database['public']['Tables']['rides']['Row'];
          
          // For captains, notify about new ride requests in their area
          if (role === 'captain' && newRide.captain_id === captainId) {
            showNotification('matched');
            onStatusChange?.('matched', newRide.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, captainId, role, showNotification, onStatusChange]);

  return { requestPermission };
};

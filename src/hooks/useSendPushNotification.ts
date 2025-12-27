import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type NotificationType =
  | 'ride_request'
  | 'ride_accepted'
  | 'captain_arriving'
  | 'captain_arrived'
  | 'ride_started'
  | 'ride_completed'
  | 'ride_cancelled'
  | 'reassignment'
  | 'sos_alert';

interface SendNotificationOptions {
  userIds: string[];
  type: NotificationType;
  data?: {
    rideId?: string;
    pickupAddress?: string;
    dropAddress?: string;
    fare?: number;
    captainName?: string;
    vehicleInfo?: string;
    eta?: string;
    reason?: string;
    [key: string]: any;
  };
}

// Notification templates
const getNotificationContent = (type: NotificationType, data: SendNotificationOptions['data'] = {}) => {
  switch (type) {
    case 'ride_request':
      return {
        title: '🚗 New Ride Request!',
        body: `Pickup: ${data.pickupAddress}\nEarning: ₹${Math.round((data.fare || 0) * 0.8)}`,
      };
    case 'ride_accepted':
      return {
        title: '✅ Ride Confirmed!',
        body: `${data.captainName} is on the way\n${data.vehicleInfo}`,
      };
    case 'captain_arriving':
      return {
        title: '🚗 Captain is Arriving',
        body: `Your captain will arrive in ${data.eta || 'a few minutes'}`,
      };
    case 'captain_arrived':
      return {
        title: '📍 Captain has Arrived!',
        body: 'Your captain is waiting at the pickup location',
      };
    case 'ride_started':
      return {
        title: '🎉 Ride Started!',
        body: `On the way to ${data.dropAddress || 'your destination'}`,
      };
    case 'ride_completed':
      return {
        title: '🏁 Ride Completed!',
        body: `Total fare: ₹${data.fare}\nThank you for riding!`,
      };
    case 'ride_cancelled':
      return {
        title: '❌ Ride Cancelled',
        body: data.reason || 'Your ride has been cancelled',
      };
    case 'reassignment':
      return {
        title: '🔄 Finding New Captain',
        body: 'Your previous captain cancelled. We\'re finding a new one.',
      };
    case 'sos_alert':
      return {
        title: '🆘 SOS Alert!',
        body: 'Emergency assistance has been requested',
      };
    default:
      return {
        title: 'RapidCab Notification',
        body: 'You have a new notification',
      };
  }
};

export const useSendPushNotification = () => {
  const sendNotification = useCallback(async (options: SendNotificationOptions) => {
    const { userIds, type, data = {} } = options;

    if (!userIds || userIds.length === 0) {
      console.log('[useSendPushNotification] No user IDs provided');
      return { success: false, error: 'No user IDs provided' };
    }

    const { title, body } = getNotificationContent(type, data);

    try {
      const response = await fetch('http://localhost:3001/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: userIds,
          title,
          body,
          data: {
            type,
            ride_id: data.rideId || '',
            ...data,
          },
          priority: type === 'ride_request' || type === 'sos_alert' ? 'high' : 'normal',
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[useSendPushNotification] Error:', errorData);
        return { success: false, error: errorData.error || 'Request failed' };
      }

      const responseData = await response.json();
      console.log('[useSendPushNotification] Success:', responseData);
      return { success: true, data: responseData };
    } catch (error) {
      console.error('[useSendPushNotification] Exception:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  // Convenience methods for specific notification types
  const notifyRideRequest = useCallback((captainUserIds: string[], rideData: {
    rideId: string;
    pickupAddress: string;
    fare: number;
  }) => {
    return sendNotification({
      userIds: captainUserIds,
      type: 'ride_request',
      data: rideData,
    });
  }, [sendNotification]);

  const notifyRideAccepted = useCallback((riderUserId: string, data: {
    rideId: string;
    captainName: string;
    vehicleInfo: string;
  }) => {
    return sendNotification({
      userIds: [riderUserId],
      type: 'ride_accepted',
      data,
    });
  }, [sendNotification]);

  const notifyCaptainArriving = useCallback((riderUserId: string, data: {
    rideId: string;
    eta: string;
  }) => {
    return sendNotification({
      userIds: [riderUserId],
      type: 'captain_arriving',
      data,
    });
  }, [sendNotification]);

  const notifyCaptainArrived = useCallback((riderUserId: string, rideId: string) => {
    return sendNotification({
      userIds: [riderUserId],
      type: 'captain_arrived',
      data: { rideId },
    });
  }, [sendNotification]);

  const notifyRideStarted = useCallback((riderUserId: string, data: {
    rideId: string;
    dropAddress: string;
  }) => {
    return sendNotification({
      userIds: [riderUserId],
      type: 'ride_started',
      data,
    });
  }, [sendNotification]);

  const notifyRideCompleted = useCallback((userIds: string[], data: {
    rideId: string;
    fare: number;
  }) => {
    return sendNotification({
      userIds,
      type: 'ride_completed',
      data,
    });
  }, [sendNotification]);

  const notifyRideCancelled = useCallback((userIds: string[], data: {
    rideId: string;
    reason?: string;
  }) => {
    return sendNotification({
      userIds,
      type: 'ride_cancelled',
      data,
    });
  }, [sendNotification]);

  const notifyReassignment = useCallback((riderUserId: string, rideId: string) => {
    return sendNotification({
      userIds: [riderUserId],
      type: 'reassignment',
      data: { rideId },
    });
  }, [sendNotification]);

  const notifySOS = useCallback((userIds: string[], data: {
    rideId: string;
    [key: string]: any;
  }) => {
    return sendNotification({
      userIds,
      type: 'sos_alert',
      data,
    });
  }, [sendNotification]);

  return {
    sendNotification,
    notifyRideRequest,
    notifyRideAccepted,
    notifyCaptainArriving,
    notifyCaptainArrived,
    notifyRideStarted,
    notifyRideCompleted,
    notifyRideCancelled,
    notifyReassignment,
    notifySOS,
  };
};

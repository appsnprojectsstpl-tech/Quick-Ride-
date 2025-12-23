import { useState, useEffect, useCallback } from 'react';

interface UsePushNotificationsOptions {
  onPermissionChange?: (permission: NotificationPermission) => void;
}

export const usePushNotifications = (options: UsePushNotificationsOptions = {}) => {
  const { onPermissionChange } = options;
  
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return 'denied';
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      onPermissionChange?.(result);
      return result;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }, [isSupported, onPermissionChange]);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      console.log('Notifications not available or not permitted');
      return null;
    }

    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }, [isSupported, permission]);

  // Ride-specific notifications
  const notifyRideRequest = useCallback((pickupAddress: string, fare: number) => {
    return showNotification('New Ride Request! 🚗', {
      body: `Pickup: ${pickupAddress}\nFare: ₹${fare}`,
      tag: 'ride-request',
      requireInteraction: true,
    });
  }, [showNotification]);

  const notifyRideAccepted = useCallback((captainName: string, vehicleInfo: string) => {
    return showNotification('Ride Accepted! ✅', {
      body: `${captainName} is on the way\n${vehicleInfo}`,
      tag: 'ride-accepted',
    });
  }, [showNotification]);

  const notifyCaptainArriving = useCallback((eta: string) => {
    return showNotification('Captain is Arriving! 🚗', {
      body: `Your captain will arrive in ${eta}`,
      tag: 'captain-arriving',
    });
  }, [showNotification]);

  const notifyCaptainArrived = useCallback(() => {
    return showNotification('Captain has Arrived! 📍', {
      body: 'Your captain is waiting at the pickup location',
      tag: 'captain-arrived',
      requireInteraction: true,
    });
  }, [showNotification]);

  const notifyRideStarted = useCallback((destination: string) => {
    return showNotification('Ride Started! 🎉', {
      body: `On the way to ${destination}`,
      tag: 'ride-started',
    });
  }, [showNotification]);

  const notifyRideCompleted = useCallback((fare: number) => {
    return showNotification('Ride Completed! 🏁', {
      body: `Total fare: ₹${fare}\nThank you for riding with us!`,
      tag: 'ride-completed',
    });
  }, [showNotification]);

  const notifyRideCancelled = useCallback((reason?: string) => {
    return showNotification('Ride Cancelled ❌', {
      body: reason || 'Your ride has been cancelled',
      tag: 'ride-cancelled',
    });
  }, [showNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    notifyRideRequest,
    notifyRideAccepted,
    notifyCaptainArriving,
    notifyCaptainArrived,
    notifyRideStarted,
    notifyRideCompleted,
    notifyRideCancelled,
  };
};

import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePushNotificationsOptions {
  onPermissionChange?: (permission: NotificationPermission) => void;
}

// Sound utility for playing notification beeps
const playNotificationSound = (type: 'success' | 'alert' | 'warning' = 'alert') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Different tones for different notification types
    const frequencies = {
      success: [600, 800],
      alert: [800, 1000],
      warning: [400, 400],
    };
    
    const [freq1, freq2] = frequencies[type];
    
    oscillator.frequency.value = freq1;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.2;
    
    oscillator.start();
    setTimeout(() => {
      oscillator.frequency.value = freq2;
    }, 150);
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, 300);
  } catch (e) {
    console.log('Audio not supported');
  }
};

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

  // Ride-specific notifications with sound
  const notifyRideRequest = useCallback((pickupAddress: string, fare: number) => {
    playNotificationSound('alert');
    return showNotification('New Ride Request! 🚗', {
      body: `Pickup: ${pickupAddress}\nFare: ₹${fare}`,
      tag: 'ride-request',
      requireInteraction: true,
    });
  }, [showNotification]);

  const notifyRideAccepted = useCallback((captainName: string, vehicleInfo: string) => {
    playNotificationSound('success');
    return showNotification('Ride Accepted! ✅', {
      body: `${captainName} is on the way\n${vehicleInfo}`,
      tag: 'ride-accepted',
    });
  }, [showNotification]);

  const notifyCaptainArriving = useCallback((eta: string) => {
    playNotificationSound('success');
    return showNotification('Captain is Arriving! 🚗', {
      body: `Your captain will arrive in ${eta}`,
      tag: 'captain-arriving',
    });
  }, [showNotification]);

  const notifyCaptainArrived = useCallback(() => {
    playNotificationSound('alert');
    return showNotification('Captain has Arrived! 📍', {
      body: 'Your captain is waiting at the pickup location',
      tag: 'captain-arrived',
      requireInteraction: true,
    });
  }, [showNotification]);

  const notifyRideStarted = useCallback((destination: string) => {
    playNotificationSound('success');
    return showNotification('Ride Started! 🎉', {
      body: `On the way to ${destination}`,
      tag: 'ride-started',
    });
  }, [showNotification]);

  const notifyRideCompleted = useCallback((fare: number) => {
    playNotificationSound('success');
    return showNotification('Ride Completed! 🏁', {
      body: `Total fare: ₹${fare}\nThank you for riding with us!`,
      tag: 'ride-completed',
    });
  }, [showNotification]);

  const notifyRideCancelled = useCallback((reason?: string) => {
    playNotificationSound('warning');
    return showNotification('Ride Cancelled ❌', {
      body: reason || 'Your ride has been cancelled',
      tag: 'ride-cancelled',
    });
  }, [showNotification]);

  const notifyReassignment = useCallback(() => {
    playNotificationSound('alert');
    return showNotification('Finding New Captain 🔄', {
      body: 'Your previous captain cancelled. We\'re finding a new one.',
      tag: 'reassignment',
      requireInteraction: true,
    });
  }, [showNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    playNotificationSound,
    notifyRideRequest,
    notifyRideAccepted,
    notifyCaptainArriving,
    notifyCaptainArrived,
    notifyRideStarted,
    notifyRideCompleted,
    notifyRideCancelled,
    notifyReassignment,
  };
};

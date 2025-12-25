import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

interface UsePushNotificationsOptions {
  userId?: string | null;
  onPermissionChange?: (permission: NotificationPermission | 'granted' | 'denied') => void;
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onNotificationAction?: (action: ActionPerformed) => void;
}

// Sound utility for playing notification beeps (web fallback)
const playNotificationSound = (type: 'success' | 'alert' | 'warning' = 'alert') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
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

// Detect platform
const isNative = Capacitor.isNativePlatform();
const getPlatform = (): 'ios' | 'android' | 'web' => {
  if (!isNative) return 'web';
  return Capacitor.getPlatform() as 'ios' | 'android';
};

export const usePushNotifications = (options: UsePushNotificationsOptions = {}) => {
  const { userId, onPermissionChange, onNotificationReceived, onNotificationAction } = options;
  
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<'default' | 'granted' | 'denied'>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const tokenSavedRef = useRef(false);

  // Initialize push notifications
  useEffect(() => {
    if (isNative) {
      setIsSupported(true);
      checkNativePermissions();
    } else if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission as 'default' | 'granted' | 'denied');
    }
  }, []);

  // Native permission check
  const checkNativePermissions = async () => {
    try {
      const permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'granted') {
        setPermission('granted');
        await registerNativePush();
      } else if (permStatus.receive === 'denied') {
        setPermission('denied');
      }
    } catch (error) {
      console.error('Error checking native permissions:', error);
    }
  };

  // Register for native push notifications
  const registerNativePush = async () => {
    try {
      // Register with FCM/APNs
      await PushNotifications.register();

      // Listen for token
      PushNotifications.addListener('registration', async (token: Token) => {
        console.log('[Push] FCM Token received:', token.value);
        setFcmToken(token.value);
        
        // Save token to database
        if (userId && !tokenSavedRef.current) {
          await saveTokenToDatabase(token.value);
        }
      });

      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] Registration error:', error);
      });

      // Listen for notifications when app is open
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] Notification received:', notification);
        playNotificationSound('alert');
        onNotificationReceived?.(notification);
      });

      // Listen for notification taps
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Notification action:', action);
        onNotificationAction?.(action);
      });
    } catch (error) {
      console.error('Error registering native push:', error);
    }
  };

  // Save token to database
  const saveTokenToDatabase = async (token: string) => {
    if (!userId || tokenSavedRef.current) return;
    
    try {
      const platform = getPlatform();
      
      // Upsert token (update if exists, insert if not)
      const { error } = await supabase
        .from('device_tokens')
        .upsert(
          { 
            user_id: userId, 
            token, 
            platform,
            is_active: true,
            updated_at: new Date().toISOString()
          },
          { 
            onConflict: 'user_id,token',
            ignoreDuplicates: false
          }
        );

      if (error) {
        console.error('[Push] Error saving token:', error);
      } else {
        console.log('[Push] Token saved successfully');
        tokenSavedRef.current = true;
      }
    } catch (error) {
      console.error('[Push] Error in saveTokenToDatabase:', error);
    }
  };

  // Effect to save token when userId becomes available
  useEffect(() => {
    if (userId && fcmToken && !tokenSavedRef.current) {
      saveTokenToDatabase(fcmToken);
    }
  }, [userId, fcmToken]);

  // Request permission
  const requestPermission = useCallback(async () => {
    if (!isSupported) return 'denied';
    
    try {
      if (isNative) {
        const permStatus = await PushNotifications.requestPermissions();
        const result = permStatus.receive === 'granted' ? 'granted' : 'denied';
        setPermission(result);
        onPermissionChange?.(result);
        
        if (result === 'granted') {
          await registerNativePush();
        }
        
        return result;
      } else {
        // Web notifications
        const result = await Notification.requestPermission();
        setPermission(result as 'default' | 'granted' | 'denied');
        onPermissionChange?.(result);
        return result;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }, [isSupported, onPermissionChange]);

  // Show web notification (fallback for web)
  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== 'granted' || isNative) {
      console.log('Web notifications not available');
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

  // Ride-specific notifications (local - for web fallback)
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

  // Deactivate token on logout
  const deactivateToken = useCallback(async () => {
    if (!userId || !fcmToken) return;
    
    try {
      await supabase
        .from('device_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('token', fcmToken);
      
      tokenSavedRef.current = false;
      console.log('[Push] Token deactivated');
    } catch (error) {
      console.error('[Push] Error deactivating token:', error);
    }
  }, [userId, fcmToken]);

  return {
    isSupported,
    permission,
    fcmToken,
    isNative,
    requestPermission,
    showNotification,
    playNotificationSound,
    deactivateToken,
    // Local notification helpers (web fallback)
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

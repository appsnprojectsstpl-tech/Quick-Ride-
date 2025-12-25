import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import CaptainHome from './CaptainHome';
import CaptainRides from './CaptainRides';
import CaptainEarnings from './CaptainEarnings';
import CaptainProfile from './CaptainProfile';
import CaptainKYC from './CaptainKYC';
import CaptainNavBar from '@/components/captain/CaptainNavBar';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CaptainApp = () => {
  const { user, role, isLoading } = useAuth();
  const [captain, setCaptain] = useState<any>(null);
  const [isLoadingCaptain, setIsLoadingCaptain] = useState(true);
  const navigate = useNavigate();

  // Initialize push notifications for captain
  const { requestPermission, permission, isSupported, playNotificationSound } = usePushNotifications({
    userId: user?.id,
    onNotificationReceived: (notification) => {
      // Play sound and show toast when notification received in foreground
      const data = notification.data as any;
      if (data?.type === 'ride_request') {
        playNotificationSound('alert');
        toast.info('New Ride Request!', {
          description: notification.body,
        });
      }
    },
    onNotificationAction: (action) => {
      // Handle notification tap
      const data = action.notification.data as any;
      if (data?.type === 'ride_request') {
        // Navigate to home to see the offer
        navigate('/captain');
      }
    }
  });

  // Request notification permission when captain is authenticated
  useEffect(() => {
    if (user && isSupported && permission === 'default') {
      // Request immediately for captains - they need notifications for rides
      requestPermission();
    }
  }, [user, isSupported, permission, requestPermission]);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCaptain();
    }
  }, [user]);

  const fetchCaptain = async () => {
    const { data } = await supabase
      .from('captains')
      .select('*')
      .eq('user_id', user?.id)
      .single();

    setCaptain(data);
    setIsLoadingCaptain(false);
  };

  if (isLoading || isLoadingCaptain) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If captain not verified, show KYC flow
  const showKYC = captain && !captain.is_verified;

  return (
    <div className="mobile-layout pb-20">
      <Routes>
        <Route path="/" element={showKYC ? <CaptainKYC /> : <CaptainHome captain={captain} />} />
        <Route path="/kyc" element={<CaptainKYC />} />
        <Route path="/rides" element={<CaptainRides />} />
        <Route path="/earnings" element={<CaptainEarnings captain={captain} />} />
        <Route path="/profile" element={<CaptainProfile captain={captain} />} />
      </Routes>
      {!showKYC && <CaptainNavBar />}
    </div>
  );
};

export default CaptainApp;

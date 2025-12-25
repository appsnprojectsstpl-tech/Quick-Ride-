import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BookingProvider } from '@/contexts/BookingContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import RiderHome from './RiderHome';
import RiderHistory from './RiderHistory';
import RiderProfile from './RiderProfile';
import EmergencyContacts from './EmergencyContacts';
import SavedPlaces from './SavedPlaces';
import RiderNavBar from '@/components/rider/RiderNavBar';
import { Loader2 } from 'lucide-react';

const RiderApp = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  // Initialize push notifications
  const { requestPermission, permission, isSupported } = usePushNotifications({
    userId: user?.id,
    onNotificationAction: (action) => {
      // Handle notification tap - navigate to relevant screen
      const data = action.notification.data as any;
      if (data?.type === 'ride_accepted' || data?.type === 'captain_arriving') {
        // Already on home, ride card will show
      }
    }
  });

  // Request notification permission when user is authenticated
  useEffect(() => {
    if (user && isSupported && permission === 'default') {
      // Small delay to not overwhelm user immediately
      const timer = setTimeout(() => {
        requestPermission();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, isSupported, permission, requestPermission]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <BookingProvider>
      <div className="mobile-layout pb-20">
        <Routes>
          <Route path="/" element={<RiderHome />} />
          <Route path="/history" element={<ProtectedRoute><RiderHistory /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><RiderProfile /></ProtectedRoute>} />
          <Route path="/emergency-contacts" element={<ProtectedRoute><EmergencyContacts /></ProtectedRoute>} />
          <Route path="/saved-places" element={<ProtectedRoute><SavedPlaces /></ProtectedRoute>} />
        </Routes>
        <RiderNavBar />
      </div>
    </BookingProvider>
  );
};

// Protected route wrapper - redirects to auth if not logged in
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};

export default RiderApp;

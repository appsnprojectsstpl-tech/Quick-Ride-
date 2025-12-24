import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BookingProvider } from '@/contexts/BookingContext';
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

  // Only redirect for protected routes (profile, history, etc.)
  // Allow browsing and vehicle selection without auth
  // Auth will be required at booking confirmation time

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

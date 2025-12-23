import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import RiderHome from './RiderHome';
import RiderHistory from './RiderHistory';
import RiderProfile from './RiderProfile';
import EmergencyContacts from './EmergencyContacts';
import SavedPlaces from './SavedPlaces';
import RiderNavBar from '@/components/rider/RiderNavBar';
import { Loader2 } from 'lucide-react';

const RiderApp = () => {
  const { user, role, isLoading } = useAuth();
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

  return (
    <div className="mobile-layout pb-20">
      <Routes>
        <Route path="/" element={<RiderHome />} />
        <Route path="/history" element={<RiderHistory />} />
        <Route path="/profile" element={<RiderProfile />} />
        <Route path="/emergency-contacts" element={<EmergencyContacts />} />
        <Route path="/saved-places" element={<SavedPlaces />} />
      </Routes>
      <RiderNavBar />
    </div>
  );
};

export default RiderApp;

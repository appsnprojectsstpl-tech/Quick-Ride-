import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import CaptainHome from './CaptainHome';
import CaptainRides from './CaptainRides';
import CaptainEarnings from './CaptainEarnings';
import CaptainProfile from './CaptainProfile';
import CaptainKYC from './CaptainKYC';
import CaptainNavBar from '@/components/captain/CaptainNavBar';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const CaptainApp = () => {
  const { user, role, isLoading } = useAuth();
  const [captain, setCaptain] = useState<any>(null);
  const [isLoadingCaptain, setIsLoadingCaptain] = useState(true);
  const navigate = useNavigate();

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

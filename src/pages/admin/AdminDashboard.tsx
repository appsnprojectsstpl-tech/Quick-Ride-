import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminOverview from './AdminOverview';
import AdminRides from './AdminRides';
import AdminCaptains from './AdminCaptains';
import AdminRiders from './AdminRiders';
import AdminKYC from './AdminKYC';
import AdminPricing from './AdminPricing';
import AdminIncidents from './AdminIncidents';
import { Loader2 } from 'lucide-react';

const AdminDashboard = () => {
  const { user, role, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate('/auth');
      } else if (role !== 'admin') {
        // Non-admin users are redirected to home
        navigate('/');
      }
    }
  }, [user, role, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Additional guard: don't render admin content for non-admins
  if (role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <main className="flex-1 ml-64 p-6">
        <Routes>
          <Route path="/" element={<AdminOverview />} />
          <Route path="/rides" element={<AdminRides />} />
          <Route path="/captains" element={<AdminCaptains />} />
          <Route path="/riders" element={<AdminRiders />} />
          <Route path="/kyc" element={<AdminKYC />} />
          <Route path="/pricing" element={<AdminPricing />} />
          <Route path="/incidents" element={<AdminIncidents />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminDashboard;

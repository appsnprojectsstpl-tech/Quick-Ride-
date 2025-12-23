import { ArrowLeft, User, Phone, Mail, Car, FileText, LogOut, ChevronRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface CaptainProfileProps {
  captain: any;
}

const menuItems = [
  { icon: FileText, label: 'Documents & KYC', path: '/captain/kyc' },
  { icon: Car, label: 'Vehicle Details', path: '/captain/vehicle' },
];

const CaptainProfile = ({ captain }: CaptainProfileProps) => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const kycStatusColors: Record<string, string> = {
    pending: 'bg-warning/10 text-warning',
    under_review: 'bg-info/10 text-info',
    approved: 'bg-success/10 text-success',
    rejected: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="mobile-header">
        <Button variant="ghost" size="icon" onClick={() => navigate('/captain')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-display font-bold text-lg">Profile</h1>
        <div className="w-10" />
      </header>

      {/* Profile Card */}
      <div className="p-4">
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {profile?.name?.charAt(0) || 'C'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{profile?.name || 'Captain'}</h2>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1 text-sm">
                  <Star className="w-4 h-4 text-primary fill-primary" />
                  <span>{captain?.rating?.toFixed(1) || '5.0'}</span>
                </div>
                <span className="text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">
                  {captain?.total_rides || 0} rides
                </span>
              </div>
              <Badge className={kycStatusColors[captain?.kyc_status] || 'bg-muted'}>
                {captain?.kyc_status === 'approved' ? 'Verified' : captain?.kyc_status}
              </Badge>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>{profile?.phone || 'Not set'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{user?.email}</span>
            </div>
          </div>

          <Button variant="outline" className="w-full mt-4">
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border text-center">
            <p className="text-xl font-bold">{captain?.total_rides || 0}</p>
            <p className="text-xs text-muted-foreground">Total Rides</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border text-center">
            <p className="text-xl font-bold">₹{captain?.total_earnings || 0}</p>
            <p className="text-xs text-muted-foreground">Earned</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border text-center">
            <p className="text-xl font-bold">{captain?.rating?.toFixed(1) || '5.0'}</p>
            <p className="text-xs text-muted-foreground">Rating</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">{item.label}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Wallet */}
      <div className="px-4 mb-4">
        <div className="bg-primary/10 rounded-xl p-4 border border-primary/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Wallet Balance</p>
              <p className="text-2xl font-bold">₹{captain?.wallet_balance || 0}</p>
            </div>
            <Button size="sm">Withdraw</Button>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="p-4">
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
};

export default CaptainProfile;

import { useState, useEffect } from 'react';
import { Menu, Bell, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import GoogleMapView from '@/components/maps/GoogleMapView';
import RideRequestCard from '@/components/captain/RideRequestCard';
import ActiveRideView from '@/components/captain/ActiveRideView';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRideNotifications } from '@/hooks/useRideNotifications';
import { AnimatePresence } from 'framer-motion';

interface CaptainHomeProps {
  captain: any;
}

const CaptainHome = ({ captain }: CaptainHomeProps) => {
  const [isOnline, setIsOnline] = useState(captain?.status === 'online');
  const [currentLocation, setCurrentLocation] = useState({ lat: 12.9716, lng: 77.5946 });
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [riderInfo, setRiderInfo] = useState<any>(null);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Real-time ride notifications
  useRideNotifications({
    captainId: captain?.id,
    role: 'captain',
    onStatusChange: (status) => {
      console.log('Ride status changed:', status);
    },
  });

  // Get and update current location
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });

        // Update captain location in DB
        if (captain?.id && isOnline) {
          await supabase
            .from('captains')
            .update({
              current_lat: latitude,
              current_lng: longitude,
              location_updated_at: new Date().toISOString(),
            })
            .eq('id', captain.id);
        }
      },
      (error) => console.error('Location error:', error),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [captain?.id, isOnline]);

  // Toggle online status
  const handleToggleOnline = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);

    await supabase
      .from('captains')
      .update({ status: newStatus ? 'online' : 'offline' })
      .eq('id', captain.id);

    toast({
      title: newStatus ? "You're online!" : "You're offline",
      description: newStatus ? 'You can now receive ride requests' : 'You won\'t receive any rides',
    });
  };

  // Fetch active ride on mount
  useEffect(() => {
    if (!captain?.id) return;

    const fetchActiveRide = async () => {
      const { data: rides } = await supabase
        .from('rides')
        .select('*')
        .eq('captain_id', captain.id)
        .in('status', ['matched', 'captain_arriving', 'waiting_for_rider', 'in_progress'])
        .limit(1);

      if (rides && rides.length > 0) {
        setActiveRide(rides[0]);

        // Fetch rider info
        const { data: riderProfile } = await supabase
          .from('profiles')
          .select('name, phone, avatar_url')
          .eq('user_id', rides[0].rider_id)
          .single();

        setRiderInfo(riderProfile);
      }
    };

    fetchActiveRide();

    // Subscribe to ride updates
    const channel = supabase
      .channel('captain-rides')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `captain_id=eq.${captain.id}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object' && 'status' in payload.new) {
            const newRide = payload.new as any;
            if (['matched', 'captain_arriving', 'waiting_for_rider', 'in_progress'].includes(newRide.status)) {
              setActiveRide(newRide);
            } else if (newRide.status === 'completed' || newRide.status === 'cancelled') {
              setActiveRide(null);
              setRiderInfo(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [captain?.id]);

  const handleAcceptRequest = () => {
    // In production, this would be handled by the match-captain function
    setPendingRequest(null);
    toast({ title: 'Ride accepted!' });
  };

  const handleDeclineRequest = () => {
    setPendingRequest(null);
  };

  const handleStatusUpdate = (newStatus: string) => {
    if (activeRide) {
      setActiveRide({ ...activeRide, status: newStatus });
      if (newStatus === 'completed') {
        setTimeout(() => {
          setActiveRide(null);
          setRiderInfo(null);
        }, 2000);
      }
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="mobile-header z-20">
        <Button variant="ghost" size="icon">
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-lg">
            Hello, {profile?.name?.split(' ')[0] || 'Captain'} 👋
          </h1>
        </div>
        
        {/* Online Toggle */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${isOnline ? 'text-success' : 'text-muted-foreground'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <Switch
            checked={isOnline}
            onCheckedChange={handleToggleOnline}
            disabled={!!activeRide}
          />
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-xl font-bold">₹{captain?.wallet_balance || 0}</p>
            <p className="text-xs text-muted-foreground">Today's Earning</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">{captain?.total_rides || 0}</p>
            <p className="text-xs text-muted-foreground">Total Rides</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">⭐ {captain?.rating?.toFixed(1) || '5.0'}</p>
            <p className="text-xs text-muted-foreground">Rating</p>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <GoogleMapView
          center={currentLocation}
          zoom={16}
          markers={[{ lat: currentLocation.lat, lng: currentLocation.lng, title: 'You' }]}
          className="h-full"
        />

        {/* Offline Overlay */}
        {!isOnline && !activeRide && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="text-center p-6">
              <Power className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-bold mb-2">You're Offline</h2>
              <p className="text-muted-foreground mb-4">Go online to start receiving ride requests</p>
              <Button onClick={handleToggleOnline} size="lg">
                Go Online
              </Button>
            </div>
          </div>
        )}

        {/* Active Ride */}
        {activeRide && (
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <ActiveRideView
              rideId={activeRide.id}
              status={activeRide.status}
              rider={riderInfo}
              otp={activeRide.otp}
              pickupAddress={activeRide.pickup_address}
              dropAddress={activeRide.drop_address}
              fare={activeRide.final_fare || 0}
              onStatusUpdate={handleStatusUpdate}
            />
          </div>
        )}
      </div>

      {/* Ride Request Popup */}
      <AnimatePresence>
        {pendingRequest && !activeRide && (
          <RideRequestCard
            request={pendingRequest}
            distanceToPickup={2.5}
            onAccept={handleAcceptRequest}
            onDecline={handleDeclineRequest}
            timeRemaining={30}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CaptainHome;

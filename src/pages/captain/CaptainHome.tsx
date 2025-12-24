import { useState, useEffect, useCallback } from 'react';
import { Menu, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import GoogleMapView from '@/components/maps/GoogleMapView';
import RideOfferPopup from '@/components/captain/RideOfferPopup';
import ActiveRideView from '@/components/captain/ActiveRideView';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRideNotifications } from '@/hooks/useRideNotifications';
import { useRideOffers } from '@/hooks/useRideOffers';
import { AnimatePresence } from 'framer-motion';

interface CaptainHomeProps {
  captain: any;
}

const CaptainHome = ({ captain }: CaptainHomeProps) => {
  const [isOnline, setIsOnline] = useState(captain?.status === 'online');
  const [currentLocation, setCurrentLocation] = useState({ lat: 12.9716, lng: 77.5946 });
  const [activeRide, setActiveRide] = useState<any>(null);
  const [riderInfo, setRiderInfo] = useState<any>(null);
  const [routePath, setRoutePath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [captainMetrics, setCaptainMetrics] = useState<any>(null);
  const { profile } = useAuth();
  const { toast } = useToast();

  // Real-time ride notifications
  useRideNotifications({
    captainId: captain?.id,
    role: 'captain',
    onStatusChange: (status) => {
      console.log('Ride status changed:', status);
    },
  });

  // Real-time ride offers
  const { currentOffer, clearOffer } = useRideOffers({
    captainId: captain?.id,
    enabled: isOnline && !activeRide,
  });

  // Fetch captain metrics
  useEffect(() => {
    if (!captain?.id) return;

    const fetchMetrics = async () => {
      const { data } = await supabase
        .from('captain_metrics')
        .select('*')
        .eq('captain_id', captain.id)
        .single();
      
      if (data) {
        setCaptainMetrics(data);
      }
    };

    fetchMetrics();
  }, [captain?.id]);

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
    // Check if in cooldown
    if (captainMetrics?.cooldown_until) {
      const cooldownEnd = new Date(captainMetrics.cooldown_until);
      if (cooldownEnd > new Date()) {
        const minsRemaining = Math.ceil((cooldownEnd.getTime() - Date.now()) / 60000);
        toast({
          variant: 'destructive',
          title: 'Cooldown Active',
          description: `You can go online in ${minsRemaining} minutes due to excessive cancellations.`,
        });
        return;
      }
    }

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
              // Fetch rider info for new rides
              if (!riderInfo && newRide.rider_id) {
                supabase
                  .from('profiles')
                  .select('name, phone, avatar_url')
                  .eq('user_id', newRide.rider_id)
                  .single()
                  .then(({ data }) => setRiderInfo(data));
              }
            } else if (newRide.status === 'completed' || newRide.status === 'cancelled') {
              setActiveRide(null);
              setRiderInfo(null);
              setRoutePath([]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [captain?.id]);

  const handleOfferAccepted = (rideDetails: any) => {
    clearOffer();
    setActiveRide(rideDetails);
    toast({ title: 'Ride accepted!', description: 'Navigate to pickup location.' });
    
    // Fetch rider info
    if (rideDetails?.rider_id) {
      supabase
        .from('profiles')
        .select('name, phone, avatar_url')
        .eq('user_id', rideDetails.rider_id)
        .single()
        .then(({ data }) => setRiderInfo(data));
    }
  };

  const handleOfferDeclined = () => {
    clearOffer();
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (activeRide) {
      setActiveRide({ ...activeRide, status: newStatus });
      if (newStatus === 'completed') {
        // Update metrics on completion
        if (captainMetrics) {
          setCaptainMetrics({
            ...captainMetrics,
            total_rides_completed: (captainMetrics.total_rides_completed || 0) + 1,
          });
        }
        setTimeout(() => {
          setActiveRide(null);
          setRiderInfo(null);
          setRoutePath([]);
        }, 2000);
      }
    }
  };

  const handleCancelRide = async (reason: string) => {
    if (!activeRide) return;

    try {
      const { data, error } = await supabase.functions.invoke('handle-cancellation', {
        body: {
          ride_id: activeRide.id,
          cancelled_by: 'captain',
          user_id: captain?.user_id,
          captain_id: captain?.id,
          reason,
        },
      });

      if (error) throw error;

      setActiveRide(null);
      setRiderInfo(null);
      setRoutePath([]);

      if (data?.penalty_type === 'cooldown') {
        toast({
          variant: 'destructive',
          title: 'Cooldown Applied',
          description: 'You have been placed in a 30-minute cooldown due to excessive cancellations.',
        });
        setIsOnline(false);
      } else {
        toast({ title: 'Ride cancelled', description: reason });
      }
    } catch (error) {
      console.error('Cancel error:', error);
      toast({ variant: 'destructive', title: 'Failed to cancel ride' });
    }
  };

  const handleRouteUpdate = useCallback((decodedPath: Array<{ lat: number; lng: number }>) => {
    setRoutePath(decodedPath);
  }, []);

  // Build markers for active ride
  const buildMarkers = (): Array<{ lat: number; lng: number; title: string; icon: 'pickup' | 'drop' | 'dropoff' | 'captain' | 'default' }> => {
    const markers: Array<{ lat: number; lng: number; title: string; icon: 'pickup' | 'drop' | 'dropoff' | 'captain' | 'default' }> = [
      { lat: currentLocation.lat, lng: currentLocation.lng, title: 'You', icon: 'captain' }
    ];

    if (activeRide) {
      markers.push(
        { lat: activeRide.pickup_lat, lng: activeRide.pickup_lng, title: 'Pickup', icon: 'pickup' },
        { lat: activeRide.drop_lat, lng: activeRide.drop_lng, title: 'Drop-off', icon: 'dropoff' }
      );
    }

    return markers;
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
          {captainMetrics && (
            <div className="text-center">
              <p className="text-xl font-bold text-success">{captainMetrics.acceptance_rate?.toFixed(0) || 100}%</p>
              <p className="text-xs text-muted-foreground">Accept Rate</p>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <GoogleMapView
          center={currentLocation}
          zoom={16}
          markers={buildMarkers()}
          polylinePath={routePath}
          className="h-full"
        />

        {/* Offline Overlay */}
        {!isOnline && !activeRide && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="text-center p-6">
              <Power className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-bold mb-2">You're Offline</h2>
              <p className="text-muted-foreground mb-4">Go online to start receiving ride requests</p>
              {captainMetrics?.cooldown_until && new Date(captainMetrics.cooldown_until) > new Date() ? (
                <div className="text-destructive text-sm mb-4">
                  Cooldown active until {new Date(captainMetrics.cooldown_until).toLocaleTimeString()}
                </div>
              ) : null}
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
              pickupLat={activeRide.pickup_lat}
              pickupLng={activeRide.pickup_lng}
              dropLat={activeRide.drop_lat}
              dropLng={activeRide.drop_lng}
              fare={activeRide.final_fare || 0}
              captainLocation={currentLocation}
              onStatusUpdate={handleStatusUpdate}
              onRouteUpdate={handleRouteUpdate}
            />
          </div>
        )}
      </div>

      {/* Ride Offer Popup */}
      <AnimatePresence>
        {currentOffer && !activeRide && (
          <RideOfferPopup
            offer={currentOffer}
            captainId={captain?.id}
            onAccepted={handleOfferAccepted}
            onDeclined={handleOfferDeclined}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CaptainHome;

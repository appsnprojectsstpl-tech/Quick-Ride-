import { useState, useEffect } from 'react';
import { Menu, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GoogleMapView from '@/components/maps/GoogleMapView';
import LocationSearch from '@/components/rider/LocationSearch';
import RideBookingSheet from '@/components/rider/RideBookingSheet';
import ActiveRideCard from '@/components/rider/ActiveRideCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRideNotifications } from '@/hooks/useRideNotifications';
import { Database } from '@/integrations/supabase/types';

type RideStatus = Database['public']['Enums']['ride_status'];

interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface ActiveRide {
  id: string;
  status: RideStatus;
  otp: string | null;
  captain: {
    name: string;
    phone: string;
    avatar_url: string | null;
    rating: number;
    vehicle: {
      make: string;
      model: string;
      registration_number: string;
    };
    eta_mins: number;
  } | null;
  pickup: Location;
  drop: Location;
}

const RiderHome = () => {
  const [pickup, setPickup] = useState<Location | null>(null);
  const [drop, setDrop] = useState<Location | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [currentLocation, setCurrentLocation] = useState({ lat: 12.9716, lng: 77.5946 });
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Real-time ride notifications
  useRideNotifications({
    userId: user?.id,
    role: 'rider',
    onStatusChange: (status) => {
      console.log('Ride status changed:', status);
    },
  });

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => console.error('Location error:', error)
      );
    }
  }, []);

  // Check for active rides
  useEffect(() => {
    if (!user) return;

    const fetchActiveRide = async () => {
      const { data: rides } = await supabase
        .from('rides')
        .select(`
          id, status, otp, pickup_lat, pickup_lng, pickup_address,
          drop_lat, drop_lng, drop_address, captain_id,
          captains (
            id, rating, user_id,
            vehicles (make, model, registration_number)
          )
        `)
        .eq('rider_id', user.id)
        .in('status', ['pending', 'matched', 'captain_arriving', 'waiting_for_rider', 'in_progress'])
        .order('requested_at', { ascending: false })
        .limit(1);

      if (rides && rides.length > 0) {
        const ride = rides[0];
        let captainData = null;

        if (ride.captains) {
          const { data: captainProfile } = await supabase
            .from('profiles')
            .select('name, phone, avatar_url')
            .eq('user_id', (ride.captains as any).user_id)
            .single();

          captainData = {
            name: captainProfile?.name || 'Captain',
            phone: captainProfile?.phone || '',
            avatar_url: captainProfile?.avatar_url,
            rating: (ride.captains as any).rating || 5,
            vehicle: (ride.captains as any).vehicles?.[0] || { make: '', model: '', registration_number: '' },
            eta_mins: 5,
          };
        }

        setActiveRide({
          id: ride.id,
          status: ride.status,
          otp: ride.otp,
          captain: captainData,
          pickup: { lat: ride.pickup_lat, lng: ride.pickup_lng, address: ride.pickup_address },
          drop: { lat: ride.drop_lat, lng: ride.drop_lng, address: ride.drop_address },
        });
      }
    };

    fetchActiveRide();

    // Subscribe to ride updates
    const channel = supabase
      .channel('rider-rides')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rides',
          filter: `rider_id=eq.${user.id}`,
        },
        (payload) => {
          fetchActiveRide();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleRideBooked = async (rideId: string) => {
    // Try to match with a captain
    const { data, error } = await supabase.functions.invoke('match-captain', {
      body: {
        ride_id: rideId,
        pickup_lat: pickup?.lat,
        pickup_lng: pickup?.lng,
        vehicle_type: 'bike',
      },
    });

    if (error || !data?.matched) {
      toast({
        title: 'No captains available',
        description: 'We\'ll keep looking for a captain nearby.',
      });
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide) return;

    const { error } = await supabase
      .from('rides')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'rider',
        cancellation_reason: 'Cancelled by rider',
      })
      .eq('id', activeRide.id);

    if (!error) {
      setActiveRide(null);
      toast({ title: 'Ride cancelled' });
    }
  };

  const handleSOS = async () => {
    toast({
      variant: 'destructive',
      title: 'SOS Triggered',
      description: 'Emergency contacts are being notified.',
    });

    if (activeRide) {
      await supabase.from('incidents').insert({
        ride_id: activeRide.id,
        reported_by: user?.id,
        incident_type: 'sos',
        status: 'open',
        location_lat: currentLocation.lat,
        location_lng: currentLocation.lng,
      });
    }
  };

  const mapMarkers = [];
  if (pickup) mapMarkers.push({ lat: pickup.lat, lng: pickup.lng, title: 'Pickup' });
  if (drop) mapMarkers.push({ lat: drop.lat, lng: drop.lng, title: 'Drop' });

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="mobile-header z-20">
        <Button variant="ghost" size="icon">
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-lg">
            Hello, {profile?.name?.split(' ')[0] || 'Rider'} 👋
          </h1>
        </div>
        <Button variant="ghost" size="icon">
          <Bell className="w-5 h-5" />
        </Button>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        <GoogleMapView
          center={currentLocation}
          zoom={15}
          markers={mapMarkers}
          className="h-full"
        />

        {/* Active Ride Overlay */}
        {activeRide && (
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <ActiveRideCard
              rideId={activeRide.id}
              status={activeRide.status}
              captain={activeRide.captain}
              otp={activeRide.otp}
              onCancel={handleCancelRide}
              onSOS={handleSOS}
            />
          </div>
        )}
      </div>

      {/* Location Input Panel */}
      {!activeRide && (
        <div className="absolute bottom-24 left-4 right-4 z-10">
          <div className="bg-card rounded-2xl p-4 shadow-lg border border-border space-y-3">
            <LocationSearch
              placeholder="Pickup location"
              onSelect={setPickup}
              icon="pickup"
            />
            <LocationSearch
              placeholder="Where to?"
              onSelect={(loc) => {
                setDrop(loc);
                if (pickup) setIsBookingOpen(true);
              }}
              icon="drop"
            />
            {pickup && drop && (
              <Button
                onClick={() => setIsBookingOpen(true)}
                className="w-full"
              >
                Find Rides
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Booking Sheet */}
      <RideBookingSheet
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        pickup={pickup}
        drop={drop}
        onRideBooked={handleRideBooked}
      />
    </div>
  );
};

export default RiderHome;

import { useState, useEffect, useMemo } from 'react';
import { Menu, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GoogleMapView from '@/components/maps/GoogleMapView';
import LocationSearch from '@/components/rider/LocationSearch';
import RideBookingSheet from '@/components/rider/RideBookingSheet';
import ActiveRideCard from '@/components/rider/ActiveRideCard';
import CancellationDialog from '@/components/rider/CancellationDialog';
import RideRatingDialog from '@/components/rider/RideRatingDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRideNotifications } from '@/hooks/useRideNotifications';
import { useCaptainTracking } from '@/hooks/useCaptainTracking';
import { useDirections } from '@/hooks/useDirections';
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
  captainId: string | null;
  matchedAt: string | null;
  captain: {
    id: string;
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
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [completedRideId, setCompletedRideId] = useState<string | null>(null);
  const [completedCaptainName, setCompletedCaptainName] = useState<string | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Directions hook for route polyline
  const { routeInfo, fetchDirections, clearRoute } = useDirections();

  // Real-time ride notifications
  useRideNotifications({
    userId: user?.id,
    role: 'rider',
    onStatusChange: (status, rideId) => {
      console.log('Ride status changed:', status);
      if (status === 'pending') {
        setIsSearching(true);
      } else if (status === 'completed') {
        // Show rating dialog when ride completes
        setCompletedRideId(rideId);
        setCompletedCaptainName(activeRide?.captain?.name);
        setShowRatingDialog(true);
        setActiveRide(null);
        setIsSearching(false);
      } else {
        setIsSearching(false);
      }
    },
  });

  // Track captain location during active ride
  const shouldTrackCaptain = activeRide?.status && 
    ['matched', 'captain_arriving', 'waiting_for_rider', 'in_progress'].includes(activeRide.status);
  
  const { captainLocation, isTracking } = useCaptainTracking({
    captainId: activeRide?.captainId || null,
    enabled: !!shouldTrackCaptain,
  });

  // Fetch route when pickup and drop are set
  useEffect(() => {
    if (pickup && drop) {
      fetchDirections(
        { lat: pickup.lat, lng: pickup.lng },
        { lat: drop.lat, lng: drop.lng }
      );
    } else {
      clearRoute();
    }
  }, [pickup, drop, fetchDirections, clearRoute]);

  // Also fetch route for active rides
  useEffect(() => {
    if (activeRide) {
      fetchDirections(
        { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng },
        { lat: activeRide.drop.lat, lng: activeRide.drop.lng }
      );
    }
  }, [activeRide?.id]);

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
          drop_lat, drop_lng, drop_address, captain_id, matched_at,
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

        if (ride.status === 'pending') {
          setIsSearching(true);
        } else {
          setIsSearching(false);
        }

        if (ride.captains) {
          const { data: captainProfile } = await supabase
            .from('profiles')
            .select('name, phone, avatar_url')
            .eq('user_id', (ride.captains as any).user_id)
            .single();

          captainData = {
            id: (ride.captains as any).id,
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
          captainId: (ride.captains as any)?.id || null,
          matchedAt: ride.matched_at,
          captain: captainData,
          pickup: { lat: ride.pickup_lat, lng: ride.pickup_lng, address: ride.pickup_address },
          drop: { lat: ride.drop_lat, lng: ride.drop_lng, address: ride.drop_address },
        });
      } else {
        setActiveRide(null);
        setIsSearching(false);
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
        async (payload) => {
          const updatedRide = payload.new as any;
          
          // Auto-retry matching when ride goes back to pending after captain decline/cancel
          if (updatedRide?.status === 'pending' && updatedRide?.excluded_captain_ids?.length > 0) {
            console.log('[RiderHome] Ride reset to pending, auto-triggering re-match...');
            toast({
              title: 'Finding another captain...',
              description: 'Previous captain unavailable. Searching for a new one.',
            });
            
            // Auto-trigger re-matching
            const { error } = await supabase.functions.invoke('match-captain-v2', {
              body: {
                ride_id: updatedRide.id,
                pickup_lat: updatedRide.pickup_lat,
                pickup_lng: updatedRide.pickup_lng,
                vehicle_type: updatedRide.vehicle_type,
                estimated_fare: updatedRide.final_fare,
                estimated_distance_km: updatedRide.estimated_distance_km,
                estimated_duration_mins: updatedRide.estimated_duration_mins,
              },
            });
            
            if (error) {
              console.error('[RiderHome] Re-match error:', error);
            }
          }
          
          fetchActiveRide();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleRideBooked = async (rideId: string) => {
    setIsSearching(true);
    
    // Try to match with a captain using v2 matching engine
    const { data, error } = await supabase.functions.invoke('match-captain-v2', {
      body: {
        ride_id: rideId,
        pickup_lat: pickup?.lat,
        pickup_lng: pickup?.lng,
        vehicle_type: 'bike',
        estimated_fare: 50,
        estimated_distance_km: routeInfo?.distance?.value ? routeInfo.distance.value / 1000 : 5,
        estimated_duration_mins: routeInfo?.duration?.value ? Math.round(routeInfo.duration.value / 60) : 15,
      },
    });

    if (error) {
      console.error('Matching error:', error);
      toast({
        variant: 'destructive',
        title: 'Error finding captain',
        description: 'Please try again.',
      });
      setIsSearching(false);
      return;
    }

    if (data?.matched) {
      toast({
        title: 'Captain found!',
        description: `${data.captain.name} is on the way.`,
      });
    } else if (data?.retry) {
      toast({
        title: 'Searching for captains...',
        description: 'Expanding search radius.',
      });
      // The frontend will handle retry via realtime subscription
    } else {
      toast({
        title: 'No captains available',
        description: data?.message || 'Please try again later.',
      });
      setIsSearching(false);
    }
  };

  const handleCancelRide = async (fee?: number) => {
    if (!activeRide) return;

    try {
      const { data, error } = await supabase.functions.invoke('handle-cancellation', {
        body: {
          ride_id: activeRide.id,
          cancelled_by: 'rider',
          user_id: user?.id,
          reason: 'Cancelled by rider',
        },
      });

      if (error) throw error;

      setActiveRide(null);
      setShowCancelDialog(false);
      setIsSearching(false);

      if (data?.cancellation_fee > 0) {
        toast({ 
          title: 'Ride cancelled', 
          description: `Cancellation fee: ₹${data.cancellation_fee}` 
        });
      } else {
        toast({ title: 'Ride cancelled' });
      }
    } catch (error) {
      console.error('Cancel error:', error);
      toast({ variant: 'destructive', title: 'Failed to cancel ride' });
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

  // Build map markers with captain location
  const mapMarkers = useMemo(() => {
    const markers = [];
    
    if (activeRide) {
      // Show pickup and drop for active ride
      markers.push({ 
        lat: activeRide.pickup.lat, 
        lng: activeRide.pickup.lng, 
        title: 'Pickup', 
        icon: 'pickup' as const 
      });
      markers.push({ 
        lat: activeRide.drop.lat, 
        lng: activeRide.drop.lng, 
        title: 'Drop-off', 
        icon: 'drop' as const 
      });
      
      // Show live captain location
      if (captainLocation && shouldTrackCaptain) {
        markers.push({
          lat: captainLocation.lat,
          lng: captainLocation.lng,
          title: 'Captain',
          icon: 'captain' as const,
        });
      }
    } else {
      // Show selected pickup and drop
      if (pickup) markers.push({ lat: pickup.lat, lng: pickup.lng, title: 'Pickup', icon: 'pickup' as const });
      if (drop) markers.push({ lat: drop.lat, lng: drop.lng, title: 'Drop', icon: 'drop' as const });
    }
    
    return markers;
  }, [activeRide, pickup, drop, captainLocation, shouldTrackCaptain]);

  // Center map on captain when tracking
  const mapCenter = useMemo(() => {
    if (captainLocation && shouldTrackCaptain) {
      return { lat: captainLocation.lat, lng: captainLocation.lng };
    }
    if (activeRide) {
      return { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng };
    }
    return currentLocation;
  }, [captainLocation, shouldTrackCaptain, activeRide, currentLocation]);

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
          center={mapCenter}
          zoom={15}
          markers={mapMarkers}
          polylinePath={routeInfo?.decodedPath}
          className="h-full"
        />

        {/* Route info banner */}
        {routeInfo && !activeRide && (
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="bg-card/95 backdrop-blur px-4 py-3 rounded-xl shadow-lg border border-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Distance</p>
                  <p className="font-bold">{routeInfo.distance.text}</p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-bold">{routeInfo.duration.text}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Searching indicator */}
        {isSearching && (
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="bg-primary/90 text-primary-foreground px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>Searching for nearby captains...</span>
            </div>
          </div>
        )}

        {/* Tracking indicator */}
        {isTracking && !isSearching && (
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-full text-sm font-medium flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Tracking captain's location live
            </div>
          </div>
        )}

        {/* Active Ride Overlay */}
        {activeRide && (
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <ActiveRideCard
              rideId={activeRide.id}
              status={activeRide.status}
              captain={activeRide.captain}
              otp={activeRide.otp}
              pickupLat={activeRide.pickup.lat}
              pickupLng={activeRide.pickup.lng}
              dropLat={activeRide.drop.lat}
              dropLng={activeRide.drop.lng}
              onCancel={() => setShowCancelDialog(true)}
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

      {/* Cancellation Dialog */}
      <CancellationDialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancelRide}
        rideStatus={activeRide?.status || 'pending'}
        matchedAt={activeRide?.matchedAt || null}
      />

      {/* Rating Dialog */}
      {completedRideId && (
        <RideRatingDialog
          isOpen={showRatingDialog}
          onClose={() => {
            setShowRatingDialog(false);
            setCompletedRideId(null);
          }}
          rideId={completedRideId}
          captainName={completedCaptainName}
          onRated={() => {
            toast({ title: 'Thanks!', description: 'Your rating helps improve the service.' });
          }}
        />
      )}
    </div>
  );
};

export default RiderHome;

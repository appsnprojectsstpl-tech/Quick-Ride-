import { useState, useEffect, useMemo, useCallback } from 'react';
import { Menu, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GoogleMapView from '@/components/maps/GoogleMapView';
import LocationPanel from '@/components/rider/LocationPanel';
import VehicleOptionsSheet from '@/components/rider/VehicleOptionsSheet';
import ConfirmRideSheet from '@/components/rider/ConfirmRideSheet';
import SearchingCaptainView from '@/components/rider/SearchingCaptainView';
import ActiveRideCard from '@/components/rider/ActiveRideCard';
import CancellationDialog from '@/components/rider/CancellationDialog';
import RideRatingDialog from '@/components/rider/RideRatingDialog';
import RideCompletionSheet from '@/components/rider/RideCompletionSheet';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRideNotifications } from '@/hooks/useRideNotifications';
import { useCaptainTracking } from '@/hooks/useCaptainTracking';
import { useDirections } from '@/hooks/useDirections';
import { useBooking, VehicleType } from '@/contexts/BookingContext';
import { useNearbyCaptains } from '@/hooks/useNearbyCaptains';
import { Database } from '@/integrations/supabase/types';

type RideStatus = Database['public']['Enums']['ride_status'];

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
  pickup: { lat: number; lng: number; address: string };
  drop: { lat: number; lng: number; address: string };
}

const RiderHome = () => {
  const { state, dispatch } = useBooking();
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [currentLocation, setCurrentLocation] = useState({ lat: 12.9716, lng: 77.5946 });
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [showCompletionSheet, setShowCompletionSheet] = useState(false);
  const [completedRideId, setCompletedRideId] = useState<string | null>(null);
  const [completedCaptainName, setCompletedCaptainName] = useState<string | undefined>(undefined);
  const [showVehicleOptions, setShowVehicleOptions] = useState(false);
  const [showConfirmRide, setShowConfirmRide] = useState(false);

  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { routeInfo, fetchDirections, clearRoute } = useDirections();

  // Real-time ride notifications
  useRideNotifications({
    userId: user?.id,
    role: 'rider',
    onStatusChange: (status, rideId) => {
      console.log('[RiderHome] Ride status changed:', status);
      if (status === 'pending') {
        dispatch({ type: 'SET_STATUS', payload: 'SEARCHING_CAPTAIN' });
      } else if (status === 'matched' || status === 'captain_arriving') {
        dispatch({ type: 'SET_STATUS', payload: 'ASSIGNED' });
      } else if (status === 'in_progress') {
        dispatch({ type: 'SET_STATUS', payload: 'IN_PROGRESS' });
      } else if (status === 'completed') {
        // Show completion sheet first
        setCompletedRideId(rideId);
        setCompletedCaptainName(activeRide?.captain?.name);
        setShowCompletionSheet(true);
      } else if (status === 'cancelled') {
        dispatch({ type: 'RESET' });
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


  // Fetch nearby captains when not in active ride
  const isSearching = state.status === 'SEARCHING_CAPTAIN';
  const hasActiveRide = activeRide && ['matched', 'captain_arriving', 'waiting_for_rider', 'in_progress'].includes(activeRide.status);
  const showNearbyCaptains = !isSearching && !hasActiveRide; // Show during vehicle selection too

  const { nearbyCaptains } = useNearbyCaptains({
    lat: currentLocation.lat,
    lng: currentLocation.lng,
    radiusKm: 5,
    vehicleType: state.vehicleType, // Filter by selected vehicle type
    enabled: showNearbyCaptains,
  });

  // Auto-show vehicle options when destination is selected
  useEffect(() => {
    if (state.status === 'DESTINATION_SELECTED' && state.pickupLocation && state.dropLocation) {
      setShowVehicleOptions(true);
    }
  }, [state.status, state.pickupLocation, state.dropLocation]);

  // Fetch route when pickup and drop are set
  useEffect(() => {
    if (state.pickupLocation && state.dropLocation) {
      fetchDirections(
        { lat: state.pickupLocation.lat, lng: state.pickupLocation.lng },
        { lat: state.dropLocation.lat, lng: state.dropLocation.lng }
      );
    } else {
      clearRoute();
    }
  }, [state.pickupLocation, state.dropLocation, fetchDirections, clearRoute]);

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

  // Check for active rides and subscribe to updates
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
          dispatch({ type: 'SET_STATUS', payload: 'SEARCHING_CAPTAIN' });
        } else if (['matched', 'captain_arriving', 'waiting_for_rider'].includes(ride.status)) {
          dispatch({ type: 'SET_STATUS', payload: 'ASSIGNED' });
        } else if (ride.status === 'in_progress') {
          dispatch({ type: 'SET_STATUS', payload: 'IN_PROGRESS' });
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

            const res = await fetch('http://localhost:3001/api/match-captain-v2', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ride_id: updatedRide.id,
                pickup_lat: updatedRide.pickup_lat,
                pickup_lng: updatedRide.pickup_lng,
                vehicle_type: updatedRide.vehicle_type,
                estimated_fare: updatedRide.final_fare,
                estimated_distance_km: updatedRide.estimated_distance_km,
                estimated_duration_mins: updatedRide.estimated_duration_mins,
              })
            });
            const error = !res.ok ? await res.json() : null;

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
    dispatch({ type: 'SET_RIDE_ID', payload: rideId });
    dispatch({ type: 'SET_STATUS', payload: 'SEARCHING_CAPTAIN' });

    // Start captain matching
    const res = await fetch('http://localhost:3001/api/match-captain-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ride_id: rideId,
        pickup_lat: state.pickupLocation?.lat,
        pickup_lng: state.pickupLocation?.lng,
        vehicle_type: state.vehicleType,
        estimated_fare: state.fare?.final_fare || 50,
        estimated_distance_km: state.fare?.distance_km || 5,
        estimated_duration_mins: state.fare?.duration_mins || 15,
      })
    });
    const data = await res.json();
    const error = !res.ok ? data : null;

    if (error) {
      console.error('Matching error:', error);
      toast({
        variant: 'destructive',
        title: 'Error finding captain',
        description: 'Please try again.',
      });
      dispatch({ type: 'RESET' });
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
    } else {
      toast({
        title: 'No captains available',
        description: data?.message || 'Please try again later.',
      });
    }
  };

  const handleCancelSearch = async () => {
    if (state.rideId) {
      try {
        const res = await fetch('http://localhost:3001/api/handle-cancellation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ride_id: state.rideId,
            cancelled_by: 'rider',
            user_id: user?.id,
            reason: 'Cancelled during search',
          })
        });
        const error = !res.ok ? await res.json() : null;

        if (error) throw error;
      } catch (error) {
        console.error('Cancel error:', error);
      }
    }
    dispatch({ type: 'RESET' });
    toast({ title: 'Search cancelled' });
  };

  const handleCancelRide = async (fee?: number) => {
    if (!activeRide) return;

    try {
      const res = await fetch('http://localhost:3001/api/handle-cancellation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ride_id: activeRide.id,
          cancelled_by: 'rider',
          user_id: user?.id,
          reason: 'Cancelled by rider',
        })
      });
      const data = await res.json();
      const error = !res.ok ? data : null;

      if (error) throw error;

      setActiveRide(null);
      setShowCancelDialog(false);
      dispatch({ type: 'RESET' });

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

  const handleVehicleSelect = (type: VehicleType) => {
    setShowVehicleOptions(false);
    setShowConfirmRide(true);
  };

  // Build map markers with captain location and nearby captains
  const mapMarkers = useMemo(() => {
    const markers = [];

    if (activeRide) {
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

      if (captainLocation && shouldTrackCaptain) {
        markers.push({
          lat: captainLocation.lat,
          lng: captainLocation.lng,
          title: 'Captain',
          icon: 'captain' as const,
        });
      }
    } else {
      if (state.pickupLocation) {
        markers.push({
          lat: state.pickupLocation.lat,
          lng: state.pickupLocation.lng,
          title: 'Pickup',
          icon: 'pickup' as const
        });
      }
      if (state.dropLocation) {
        markers.push({
          lat: state.dropLocation.lat,
          lng: state.dropLocation.lng,
          title: 'Drop',
          icon: 'drop' as const
        });
      }

      // Add nearby captain markers when not in active ride
      if (showNearbyCaptains && nearbyCaptains.length > 0) {
        nearbyCaptains.forEach((captain) => {
          markers.push({
            lat: captain.lat,
            lng: captain.lng,
            title: `${captain.vehicle_type} - ${captain.distance_km}km away`,
            icon: captain.vehicle_type as 'bike' | 'auto' | 'cab',
          });
        });
      }
    }

    return markers;
  }, [activeRide, state.pickupLocation, state.dropLocation, captainLocation, shouldTrackCaptain, showNearbyCaptains, nearbyCaptains]);

  // Center map
  const mapCenter = useMemo(() => {
    if (captainLocation && shouldTrackCaptain) {
      return { lat: captainLocation.lat, lng: captainLocation.lng };
    }
    if (activeRide) {
      return { lat: activeRide.pickup.lat, lng: activeRide.pickup.lng };
    }
    if (state.pickupLocation) {
      return { lat: state.pickupLocation.lat, lng: state.pickupLocation.lng };
    }
    return currentLocation;
  }, [captainLocation, shouldTrackCaptain, activeRide, state.pickupLocation, currentLocation]);

  // showLocationPanel uses the already-declared isSearching and hasActiveRide
  const showLocationPanel = !isSearching && !hasActiveRide;

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
        {routeInfo && !hasActiveRide && !isSearching && (
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

        {/* Tracking indicator */}
        {isTracking && !isSearching && (
          <div className="absolute top-4 left-4 right-4 z-10">
            <div className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-full text-sm font-medium flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Tracking captain's location live
            </div>
          </div>
        )}

        {/* Searching Captain View */}
        {isSearching && (
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <SearchingCaptainView onCancel={handleCancelSearch} />
          </div>
        )}

        {/* Active Ride Overlay */}
        {hasActiveRide && (
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
      {showLocationPanel && (
        <div className="absolute bottom-24 left-4 right-4 z-10">
          <LocationPanel />
        </div>
      )}

      {/* Vehicle Options Sheet */}
      <VehicleOptionsSheet
        isOpen={showVehicleOptions}
        onClose={() => setShowVehicleOptions(false)}
        onVehicleSelect={handleVehicleSelect}
      />

      {/* Confirm Ride Sheet */}
      <ConfirmRideSheet
        isOpen={showConfirmRide}
        onClose={() => setShowConfirmRide(false)}
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

      {/* Ride Completion Sheet */}
      {completedRideId && (
        <RideCompletionSheet
          isOpen={showCompletionSheet}
          onClose={() => setShowCompletionSheet(false)}
          rideId={completedRideId}
          onPaymentConfirmed={() => {
            setShowCompletionSheet(false);
            setShowRatingDialog(true);
            setActiveRide(null);
            dispatch({ type: 'RESET' });
          }}
        />
      )}

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

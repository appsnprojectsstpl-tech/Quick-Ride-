import { useState, useEffect } from 'react';
import { Phone, Navigation, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDirections } from '@/hooks/useDirections';
import NavigationInstructions from './NavigationInstructions';

interface Rider {
  name: string;
  phone: string;
  avatar_url: string | null;
}

interface ActiveRideViewProps {
  rideId: string;
  status: string;
  rider: Rider | null;
  otp: string | null;
  pickupAddress: string;
  dropAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  fare: number;
  captainLocation: { lat: number; lng: number } | null;
  onStatusUpdate: (status: string) => void;
  onRouteUpdate?: (decodedPath: Array<{ lat: number; lng: number }>) => void;
}

const statusFlow = [
  { status: 'matched', label: 'Navigate to Pickup', nextStatus: 'captain_arriving' },
  { status: 'captain_arriving', label: 'Arrived at Pickup', nextStatus: 'waiting_for_rider' },
  { status: 'waiting_for_rider', label: 'Start Ride', nextStatus: 'in_progress', requiresOtp: true },
  { status: 'in_progress', label: 'Complete Ride', nextStatus: 'completed' },
];

const ActiveRideView = ({
  rideId,
  status,
  rider,
  otp,
  pickupAddress,
  dropAddress,
  pickupLat,
  pickupLng,
  dropLat,
  dropLng,
  fare,
  captainLocation,
  onStatusUpdate,
  onRouteUpdate,
}: ActiveRideViewProps) => {
  const [enteredOtp, setEnteredOtp] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const { routeInfo, fetchDirections, lastUpdated } = useDirections({ 
    autoRefreshInterval: 30000, // Refresh every 30 seconds
    enabled: true 
  });

  const currentStep = statusFlow.find((s) => s.status === status);

  // Determine navigation destination based on status
  const isGoingToPickup = status === 'matched' || status === 'captain_arriving' || status === 'waiting_for_rider';
  const destination = isGoingToPickup 
    ? { lat: pickupLat, lng: pickupLng, address: pickupAddress }
    : { lat: dropLat, lng: dropLng, address: dropAddress };

  // Fetch directions when status changes or captain moves significantly
  useEffect(() => {
    if (!captainLocation) return;

    const fetchRoute = async () => {
      await fetchDirections(captainLocation, { lat: destination.lat, lng: destination.lng });
    };

    fetchRoute();
  }, [status, captainLocation?.lat, captainLocation?.lng, destination.lat, destination.lng]);

  // Notify parent of route updates for map display
  useEffect(() => {
    if (routeInfo?.decodedPath && onRouteUpdate) {
      onRouteUpdate(routeInfo.decodedPath);
    }
  }, [routeInfo?.decodedPath, onRouteUpdate]);

  const handleUpdateStatus = async () => {
    if (!currentStep) return;

    if (currentStep.requiresOtp && enteredOtp !== otp) {
      toast({
        variant: 'destructive',
        title: 'Invalid OTP',
        description: 'Please enter the correct OTP from the rider.',
      });
      return;
    }

    setIsUpdating(true);

    try {
      const updates: any = { status: currentStep.nextStatus };

      if (currentStep.nextStatus === 'captain_arriving') {
        updates.captain_arrived_at = new Date().toISOString();
      } else if (currentStep.nextStatus === 'in_progress') {
        updates.started_at = new Date().toISOString();
      } else if (currentStep.nextStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('rides')
        .update(updates)
        .eq('id', rideId);

      if (error) throw error;

      onStatusUpdate(currentStep.nextStatus);

      if (currentStep.nextStatus === 'completed') {
        toast({
          title: 'Ride Completed! 🎉',
          description: `You earned ₹${Math.round(fare * 0.8)} from this ride.`,
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error.message,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCall = () => {
    if (rider?.phone) {
      window.open(`tel:${rider.phone}`, '_self');
    }
  };

  const openNavigation = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
  };

  return (
    <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
      {/* Navigation Instructions */}
      {routeInfo && routeInfo.steps.length > 0 && (
        <div className="mb-2">
          <NavigationInstructions
            steps={routeInfo.steps}
            totalDistance={routeInfo.distance.text}
            totalDuration={routeInfo.duration.text}
            durationInTraffic={routeInfo.durationInTraffic?.text}
            eta={routeInfo.eta}
            destination={isGoingToPickup ? 'Pickup' : 'Drop-off'}
            lastUpdated={lastUpdated}
          />
        </div>
      )}

      {/* Status Header */}
      <div className="px-4 py-3 bg-primary text-primary-foreground">
        <p className="font-semibold text-center">
          {status === 'matched' && 'Navigate to Pickup'}
          {status === 'captain_arriving' && 'Going to Pickup'}
          {status === 'waiting_for_rider' && 'Waiting for Rider'}
          {status === 'in_progress' && 'Ride in Progress'}
        </p>
      </div>

      {/* Rider Info */}
      {rider && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={rider.avatar_url || undefined} />
                <AvatarFallback className="bg-secondary text-secondary-foreground">
                  {rider.name?.charAt(0) || 'R'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{rider.name}</p>
                <p className="text-sm text-muted-foreground">Rider</p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={handleCall}>
              <Phone className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Route */}
      <div className="p-4 space-y-3">
        <button
          onClick={() => openNavigation(pickupAddress)}
          className="w-full flex items-start gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
        >
          <div className="w-3 h-3 rounded-full bg-success mt-1" />
          <div className="flex-1 text-left">
            <p className="text-xs text-muted-foreground">Pickup</p>
            <p className="text-sm font-medium">{pickupAddress}</p>
          </div>
          <Navigation className="w-5 h-5 text-primary" />
        </button>

        <button
          onClick={() => openNavigation(dropAddress)}
          className="w-full flex items-start gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
        >
          <div className="w-3 h-3 rounded-full bg-destructive mt-1" />
          <div className="flex-1 text-left">
            <p className="text-xs text-muted-foreground">Drop</p>
            <p className="text-sm font-medium">{dropAddress}</p>
          </div>
          <Navigation className="w-5 h-5 text-primary" />
        </button>
      </div>

      {/* OTP Entry (when waiting for rider) */}
      {status === 'waiting_for_rider' && (
        <div className="px-4 pb-4">
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
            <p className="text-sm font-medium mb-2">Enter OTP from rider to start</p>
            <Input
              value={enteredOtp}
              onChange={(e) => setEnteredOtp(e.target.value)}
              placeholder="Enter 4-digit OTP"
              maxLength={4}
              className="text-center text-2xl tracking-widest font-bold"
            />
          </div>
        </div>
      )}

      {/* Fare */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
          <span className="text-muted-foreground">Ride Fare</span>
          <span className="text-xl font-bold">₹{fare}</span>
        </div>
      </div>

      {/* Action Button */}
      {currentStep && (
        <div className="p-4 border-t border-border">
          <Button
            onClick={handleUpdateStatus}
            disabled={isUpdating}
            className="w-full h-14 text-lg font-bold"
          >
            {isUpdating ? 'Updating...' : currentStep.label}
          </Button>
        </div>
      )}

      {/* SOS */}
      <div className="px-4 pb-4">
        <Button
          variant="outline"
          className="w-full sos-button"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          SOS Emergency
        </Button>
      </div>
    </div>
  );
};

export default ActiveRideView;

import { useState } from 'react';
import { Navigation, Clock, IndianRupee, Tag, Loader2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBooking, VehicleType } from '@/contexts/BookingContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface ConfirmRideSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onRideBooked: (rideId: string) => void;
}

const vehicleLabels: Record<VehicleType, string> = {
  bike: 'Bike',
  auto: 'Auto',
  cab: 'Cab',
};

const ConfirmRideSheet = ({ isOpen, onClose, onRideBooked }: ConfirmRideSheetProps) => {
  const { state, dispatch } = useBooking();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [promoCode, setPromoCode] = useState('');
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [showFareDetails, setShowFareDetails] = useState(false);

  const fare = state.fare;

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !state.pickupLocation || !state.dropLocation) return;
    
    setIsApplyingPromo(true);
    setPromoError(null);

    try {
      const { data, error } = await supabase.functions.invoke('calculate-fare', {
        body: {
          pickup_lat: state.pickupLocation.lat,
          pickup_lng: state.pickupLocation.lng,
          drop_lat: state.dropLocation.lat,
          drop_lng: state.dropLocation.lng,
          vehicle_type: state.vehicleType,
          promo_code: promoCode,
        },
      });

      if (error) throw error;

      if (data?.promo_error) {
        setPromoError(data.promo_error);
        toast({
          variant: 'destructive',
          title: 'Invalid promo code',
          description: data.promo_error,
        });
      } else if (data?.promo_applied) {
        dispatch({ type: 'SET_FARE', payload: data });
        dispatch({ type: 'SET_PROMO', payload: data.promo_applied.code });
        toast({
          title: 'Promo applied!',
          description: `You saved ₹${data.discount}`,
        });
      }
    } catch (err) {
      setPromoError('Failed to apply promo code');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemovePromo = async () => {
    dispatch({ type: 'SET_PROMO', payload: null });
    setPromoCode('');
    setPromoError(null);

    // Refetch fare without promo
    if (state.pickupLocation && state.dropLocation) {
      const { data } = await supabase.functions.invoke('calculate-fare', {
        body: {
          pickup_lat: state.pickupLocation.lat,
          pickup_lng: state.pickupLocation.lng,
          drop_lat: state.dropLocation.lat,
          drop_lng: state.dropLocation.lng,
          vehicle_type: state.vehicleType,
        },
      });
      if (data) {
        dispatch({ type: 'SET_FARE', payload: data });
      }
    }
  };

  const handleBookRide = async () => {
    // Check if user is logged in
    if (!user) {
      toast({
        title: 'Please log in',
        description: 'You need to be logged in to book a ride.',
      });
      navigate('/auth');
      return;
    }

    if (!state.pickupLocation || !state.dropLocation || !fare) {
      toast({
        variant: 'destructive',
        title: 'Missing information',
        description: 'Please select pickup and drop locations.',
      });
      return;
    }

    setIsBooking(true);

    try {
      const { data: ride, error } = await supabase
        .from('rides')
        .insert({
          rider_id: user.id,
          vehicle_type: state.vehicleType,
          pickup_lat: state.pickupLocation.lat,
          pickup_lng: state.pickupLocation.lng,
          pickup_address: state.pickupLocation.address,
          drop_lat: state.dropLocation.lat,
          drop_lng: state.dropLocation.lng,
          drop_address: state.dropLocation.address,
          estimated_distance_km: fare.distance_km,
          estimated_duration_mins: fare.duration_mins,
          base_fare: fare.base_fare,
          distance_fare: fare.distance_fare,
          time_fare: fare.time_fare,
          surge_multiplier: fare.surge_multiplier,
          total_fare: fare.total_fare,
          discount: fare.discount,
          final_fare: fare.final_fare,
          promo_code: state.promoCode || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      dispatch({ type: 'SET_RIDE_ID', payload: ride.id });
      dispatch({ type: 'SET_STATUS', payload: 'SEARCHING_CAPTAIN' });

      toast({
        title: 'Finding your captain...',
        description: 'Please wait while we match you with a nearby captain.',
      });

      onRideBooked(ride.id);
      onClose();
    } catch (error: any) {
      console.error('Booking error:', error);
      toast({
        variant: 'destructive',
        title: 'Booking failed',
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-3xl overflow-y-auto">
        <div className="bottom-sheet-handle" />
        <SheetHeader>
          <SheetTitle>Confirm Your Ride</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 py-4">
          {/* Route Summary */}
          <div className="space-y-3 p-3 bg-muted/30 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Pickup</p>
                <p className="text-sm font-medium line-clamp-2">{state.pickupLocation?.address}</p>
              </div>
            </div>
            <div className="ml-1.5 border-l-2 border-dashed border-muted-foreground/30 h-3" />
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Drop</p>
                <p className="text-sm font-medium line-clamp-2">{state.dropLocation?.address}</p>
              </div>
            </div>
          </div>

          {/* Selected Vehicle & Fare */}
          {fare && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-lg">{vehicleLabels[state.vehicleType]}</p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Navigation className="w-3 h-3" />
                      {fare.distance_km} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {fare.duration_mins} mins
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  {fare.discount > 0 && (
                    <p className="text-sm text-muted-foreground line-through">₹{fare.total_fare}</p>
                  )}
                  <p className="text-2xl font-bold text-primary">₹{fare.final_fare}</p>
                </div>
              </div>

              {/* Expandable fare details */}
              <button
                onClick={() => setShowFareDetails(!showFareDetails)}
                className="flex items-center gap-1 text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors"
              >
                {showFareDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showFareDetails ? 'Hide' : 'View'} fare breakdown
              </button>

              {showFareDetails && (
                <div className="mt-3 pt-3 border-t border-border space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Fare</span>
                    <span>₹{fare.base_fare}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distance ({fare.distance_km} km)</span>
                    <span>₹{fare.distance_fare}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time ({fare.duration_mins} mins)</span>
                    <span>₹{fare.time_fare}</span>
                  </div>
                  {fare.surge_multiplier > 1 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Surge ({fare.surge_multiplier}x)</span>
                      <span>Applied</span>
                    </div>
                  )}
                  {fare.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Promo Discount</span>
                      <span>-₹{fare.discount}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Promo Code */}
          <div className="space-y-2">
            {state.promoCode ? (
              <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-600">{state.promoCode}</span>
                  <span className="text-sm text-muted-foreground">applied</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleRemovePromo} className="h-8 w-8 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase());
                      setPromoError(null);
                    }}
                    placeholder="Enter promo code"
                    className={`pl-9 ${promoError ? 'border-destructive' : ''}`}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleApplyPromo}
                  disabled={!promoCode.trim() || isApplyingPromo}
                >
                  {isApplyingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                </Button>
              </div>
            )}
            {promoError && <p className="text-xs text-destructive">{promoError}</p>}
          </div>

          {/* Payment Method */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-3">
              <IndianRupee className="w-5 h-5" />
              <span className="font-medium">Cash</span>
            </div>
            <span className="text-xs text-muted-foreground">Only cash payments for now</span>
          </div>

          {/* Book Button */}
          <Button
            onClick={handleBookRide}
            disabled={!fare || isBooking}
            className="w-full h-14 text-lg font-bold"
          >
            {isBooking ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Booking...
              </>
            ) : (
              `Book ${vehicleLabels[state.vehicleType]} • ₹${fare?.final_fare || '--'}`
            )}
          </Button>

          {!user && (
            <p className="text-xs text-center text-muted-foreground">
              You'll be asked to log in before confirming
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ConfirmRideSheet;

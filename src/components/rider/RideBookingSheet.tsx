import { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock, IndianRupee, Tag, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import VehicleSelector from './VehicleSelector';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Location {
  lat: number;
  lng: number;
  address: string;
}

interface FareEstimate {
  distance_km: number;
  duration_mins: number;
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  surge_multiplier: number;
  total_fare: number;
  discount: number;
  final_fare: number;
  promo_applied?: { code: string; discount_type: string; discount_value: number } | null;
  promo_error?: string | null;
}

interface RideBookingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  pickup: Location | null;
  drop: Location | null;
  onRideBooked: (rideId: string) => void;
}

type VehicleType = 'bike' | 'auto' | 'cab';

const RideBookingSheet = ({ isOpen, onClose, pickup, drop, onRideBooked }: RideBookingSheetProps) => {
  const [vehicleType, setVehicleType] = useState<VehicleType>('bike');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [allFares, setAllFares] = useState<{ bike?: number; auto?: number; cab?: number }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const { toast } = useToast();

  const fetchFareEstimate = async (type: VehicleType, promo?: string) => {
    if (!pickup || !drop) return null;

    const { data, error } = await supabase.functions.invoke('calculate-fare', {
      body: {
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        drop_lat: drop.lat,
        drop_lng: drop.lng,
        vehicle_type: type,
        promo_code: promo || undefined,
      },
    });

    if (error) {
      console.error('Error fetching fare:', error);
      return null;
    }
    return data;
  };

  const fetchAllFares = async () => {
    if (!pickup || !drop) return;
    setIsLoading(true);

    try {
      const types: VehicleType[] = ['bike', 'auto', 'cab'];
      const estimates: { bike?: number; auto?: number; cab?: number } = {};

      const results = await Promise.all(
        types.map(type => fetchFareEstimate(type, appliedPromo || undefined))
      );

      results.forEach((data, index) => {
        if (data) {
          estimates[types[index]] = data.final_fare;
          if (types[index] === vehicleType) {
            setFareEstimate(data);
          }
        }
      });

      setAllFares(estimates);
    } catch (error) {
      console.error('Error fetching fares:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVehicleSelect = async (type: VehicleType) => {
    setVehicleType(type);
    const data = await fetchFareEstimate(type, appliedPromo || undefined);
    if (data) setFareEstimate(data);
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !pickup || !drop) return;
    setIsApplyingPromo(true);
    setPromoError(null);

    const data = await fetchFareEstimate(vehicleType, promoCode);
    
    if (data?.promo_error) {
      setPromoError(data.promo_error);
      setAppliedPromo(null);
      toast({
        variant: 'destructive',
        title: 'Invalid promo code',
        description: data.promo_error,
      });
    } else if (data?.promo_applied) {
      setAppliedPromo(data.promo_applied.code);
      setFareEstimate(data);
      setPromoError(null);
      
      // Update all fares with promo
      const types: VehicleType[] = ['bike', 'auto', 'cab'];
      const estimates: { bike?: number; auto?: number; cab?: number } = {};
      const results = await Promise.all(
        types.map(type => fetchFareEstimate(type, promoCode))
      );
      results.forEach((d, index) => {
        if (d) estimates[types[index]] = d.final_fare;
      });
      setAllFares(estimates);

      toast({
        title: 'Promo applied!',
        description: `You saved ₹${data.discount}`,
      });
    }

    setIsApplyingPromo(false);
  };

  const handleRemovePromo = async () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError(null);
    
    // Refetch fares without promo
    const data = await fetchFareEstimate(vehicleType);
    if (data) setFareEstimate(data);
    
    const types: VehicleType[] = ['bike', 'auto', 'cab'];
    const estimates: { bike?: number; auto?: number; cab?: number } = {};
    const results = await Promise.all(types.map(type => fetchFareEstimate(type)));
    results.forEach((d, index) => {
      if (d) estimates[types[index]] = d.final_fare;
    });
    setAllFares(estimates);
  };

  const handleBookRide = async () => {
    if (!pickup || !drop || !fareEstimate) return;
    setIsBooking(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please login to book a ride');

      const { data: ride, error } = await supabase
        .from('rides')
        .insert({
          rider_id: user.id,
          vehicle_type: vehicleType,
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          pickup_address: pickup.address,
          drop_lat: drop.lat,
          drop_lng: drop.lng,
          drop_address: drop.address,
          estimated_distance_km: fareEstimate.distance_km,
          estimated_duration_mins: fareEstimate.duration_mins,
          base_fare: fareEstimate.base_fare,
          distance_fare: fareEstimate.distance_fare,
          time_fare: fareEstimate.time_fare,
          surge_multiplier: fareEstimate.surge_multiplier,
          total_fare: fareEstimate.total_fare,
          discount: fareEstimate.discount,
          final_fare: fareEstimate.final_fare,
          promo_code: appliedPromo || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Finding your captain...',
        description: 'Please wait while we match you with a nearby captain.',
      });

      onRideBooked(ride.id);
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Booking failed',
        description: error.message,
      });
    } finally {
      setIsBooking(false);
    }
  };

  useEffect(() => {
    if (isOpen && pickup && drop) {
      fetchAllFares();
    }
  }, [isOpen, pickup?.lat, drop?.lat]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <div className="bottom-sheet-handle" />
        <SheetHeader>
          <SheetTitle>Confirm Your Ride</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-4">
          {/* Route Summary */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-success mt-1.5" />
              <div>
                <p className="text-xs text-muted-foreground">Pickup</p>
                <p className="text-sm font-medium line-clamp-2">{pickup?.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-destructive mt-1.5" />
              <div>
                <p className="text-xs text-muted-foreground">Drop</p>
                <p className="text-sm font-medium line-clamp-2">{drop?.address}</p>
              </div>
            </div>
          </div>

          {/* Vehicle Selection */}
          <VehicleSelector
            selected={vehicleType}
            onSelect={handleVehicleSelect}
            fareEstimates={allFares}
          />

          {/* Fare Breakdown */}
          {fareEstimate && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Navigation className="w-4 h-4" />
                  <span>{fareEstimate.distance_km} km</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{fareEstimate.duration_mins} mins</span>
                </div>
              </div>
              <div className="border-t border-border pt-2 mt-2">
                <div className="flex justify-between text-sm">
                  <span>Base Fare</span>
                  <span>₹{fareEstimate.base_fare}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Distance ({fareEstimate.distance_km} km)</span>
                  <span>₹{fareEstimate.distance_fare}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Time ({fareEstimate.duration_mins} mins)</span>
                  <span>₹{fareEstimate.time_fare}</span>
                </div>
                {fareEstimate.surge_multiplier > 1 && (
                  <div className="flex justify-between text-sm text-warning">
                    <span>Surge ({fareEstimate.surge_multiplier}x)</span>
                    <span>Applied</span>
                  </div>
                )}
                {fareEstimate.discount > 0 && (
                  <div className="flex justify-between text-sm text-success">
                    <span>Promo Discount</span>
                    <span>-₹{fareEstimate.discount}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-border">
                  <span>Total</span>
                  <div className="flex items-center gap-2">
                    {fareEstimate.discount > 0 && (
                      <span className="text-sm text-muted-foreground line-through">
                        ₹{fareEstimate.total_fare}
                      </span>
                    )}
                    <span className="text-primary">₹{fareEstimate.final_fare}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Promo Code */}
          <div className="space-y-2">
            {appliedPromo ? (
              <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success" />
                  <span className="font-medium text-success">{appliedPromo}</span>
                  <span className="text-sm text-muted-foreground">applied</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleRemovePromo}
                  className="h-8 w-8 p-0"
                >
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
            {promoError && (
              <p className="text-xs text-destructive">{promoError}</p>
            )}
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
            disabled={!fareEstimate || isBooking}
            className="w-full h-14 text-lg font-bold"
          >
            {isBooking ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Booking...
              </>
            ) : (
              `Book ${vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1)} • ₹${fareEstimate?.final_fare || '--'}`
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RideBookingSheet;
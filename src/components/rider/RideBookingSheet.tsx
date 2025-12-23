import { useState } from 'react';
import { MapPin, Navigation, Clock, IndianRupee, Tag, Loader2 } from 'lucide-react';
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
  final_fare: number;
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
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [allFares, setAllFares] = useState<{ bike?: number; auto?: number; cab?: number }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const { toast } = useToast();

  const fetchFareEstimates = async () => {
    if (!pickup || !drop) return;
    setIsLoading(true);

    try {
      const types: VehicleType[] = ['bike', 'auto', 'cab'];
      const estimates: { bike?: number; auto?: number; cab?: number } = {};

      for (const type of types) {
        const { data, error } = await supabase.functions.invoke('calculate-fare', {
          body: {
            pickup_lat: pickup.lat,
            pickup_lng: pickup.lng,
            drop_lat: drop.lat,
            drop_lng: drop.lng,
            vehicle_type: type,
          },
        });

        if (!error && data) {
          estimates[type] = data.final_fare;
          if (type === vehicleType) {
            setFareEstimate(data);
          }
        }
      }

      setAllFares(estimates);
    } catch (error) {
      console.error('Error fetching fares:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVehicleSelect = async (type: VehicleType) => {
    setVehicleType(type);
    if (pickup && drop) {
      const { data } = await supabase.functions.invoke('calculate-fare', {
        body: {
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          drop_lat: drop.lat,
          drop_lng: drop.lng,
          vehicle_type: type,
        },
      });
      if (data) setFareEstimate(data);
    }
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
          final_fare: fareEstimate.final_fare,
          promo_code: promoCode || null,
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

  // Fetch fares when sheet opens with both locations
  useState(() => {
    if (isOpen && pickup && drop) {
      fetchFareEstimates();
    }
  });

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
                <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-primary">₹{fareEstimate.final_fare}</span>
                </div>
              </div>
            </div>
          )}

          {/* Promo Code */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Promo code"
                className="pl-9"
              />
            </div>
            <Button variant="outline">Apply</Button>
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

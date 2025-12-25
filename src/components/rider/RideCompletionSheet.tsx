import { useState, useEffect } from 'react';
import { CheckCircle, MapPin, Clock, Route, CreditCard, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RideCompletionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  onPaymentConfirmed: () => void;
}

interface RideDetails {
  pickup_address: string;
  drop_address: string;
  base_fare: number;
  distance_fare: number;
  time_fare: number;
  surge_multiplier: number;
  total_fare: number;
  discount: number;
  final_fare: number;
  actual_distance_km: number;
  actual_duration_mins: number;
  payment_method: string;
}

const RideCompletionSheet = ({
  isOpen,
  onClose,
  rideId,
  onPaymentConfirmed,
}: RideCompletionSheetProps) => {
  const [rideDetails, setRideDetails] = useState<RideDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && rideId) {
      fetchRideDetails();
    }
  }, [isOpen, rideId]);

  const fetchRideDetails = async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .single();

    if (!error && data) {
      setRideDetails({
        pickup_address: data.pickup_address,
        drop_address: data.drop_address,
        base_fare: data.base_fare || 0,
        distance_fare: data.distance_fare || 0,
        time_fare: data.time_fare || 0,
        surge_multiplier: data.surge_multiplier || 1,
        total_fare: data.total_fare || 0,
        discount: data.discount || 0,
        final_fare: data.final_fare || 0,
        actual_distance_km: data.actual_distance_km || data.estimated_distance_km || 0,
        actual_duration_mins: data.actual_duration_mins || data.estimated_duration_mins || 0,
        payment_method: data.payment_method || 'cash',
      });
    }

    setIsLoading(false);
  };

  const handleConfirmPayment = async () => {
    setIsConfirming(true);

    try {
      // For cash payments, just confirm and close
      toast({
        title: 'Payment Confirmed',
        description: 'Thank you for riding with us!',
      });

      onPaymentConfirmed();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsConfirming(false);
    }
  };

  if (isLoading) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="bottom" className="rounded-t-3xl h-[70vh]">
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl h-[80vh] overflow-y-auto">
        <SheetHeader className="text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>
          <SheetTitle className="text-xl">Ride Completed!</SheetTitle>
          <p className="text-muted-foreground">
            Thank you for riding with us
          </p>
        </SheetHeader>

        {rideDetails && (
          <div className="space-y-6">
            {/* Route Summary */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <div className="w-0.5 h-8 bg-border" />
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Pickup</p>
                    <p className="text-sm font-medium line-clamp-1">{rideDetails.pickup_address}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Drop-off</p>
                    <p className="text-sm font-medium line-clamp-1">{rideDetails.drop_address}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trip Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <Route className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-lg font-bold">{rideDetails.actual_distance_km.toFixed(1)} km</p>
                <p className="text-xs text-muted-foreground">Distance</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <Clock className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-lg font-bold">{Math.round(rideDetails.actual_duration_mins)} min</p>
                <p className="text-xs text-muted-foreground">Duration</p>
              </div>
            </div>

            {/* Fare Breakdown */}
            <div className="space-y-3">
              <h3 className="font-semibold">Fare Breakdown</h3>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Fare</span>
                  <span>₹{rideDetails.base_fare.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Distance Fare</span>
                  <span>₹{rideDetails.distance_fare.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Time Fare</span>
                  <span>₹{rideDetails.time_fare.toFixed(2)}</span>
                </div>
                {rideDetails.surge_multiplier > 1 && (
                  <div className="flex justify-between text-sm text-warning">
                    <span>Surge ({rideDetails.surge_multiplier}x)</span>
                    <span>Applied</span>
                  </div>
                )}
                {rideDetails.discount > 0 && (
                  <div className="flex justify-between text-sm text-success">
                    <span>Discount</span>
                    <span>-₹{rideDetails.discount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="font-semibold text-lg">Total</span>
                <span className="font-bold text-2xl text-primary">
                  ₹{rideDetails.final_fare.toFixed(0)}
                </span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                {rideDetails.payment_method === 'cash' ? (
                  <Banknote className="w-6 h-6 text-success" />
                ) : (
                  <CreditCard className="w-6 h-6 text-primary" />
                )}
                <div>
                  <p className="font-medium capitalize">{rideDetails.payment_method} Payment</p>
                  <p className="text-sm text-muted-foreground">
                    {rideDetails.payment_method === 'cash' 
                      ? 'Please pay the captain directly'
                      : 'Payment will be processed automatically'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Confirm Button */}
            <Button
              onClick={handleConfirmPayment}
              className="w-full"
              size="lg"
              disabled={isConfirming}
            >
              {isConfirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Confirming...
                </>
              ) : rideDetails.payment_method === 'cash' ? (
                <>
                  <Banknote className="w-4 h-4 mr-2" />
                  Confirm Cash Paid (₹{rideDetails.final_fare.toFixed(0)})
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Done
                </>
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default RideCompletionSheet;

import { useEffect } from 'react';
import { Bike, Car, Clock, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useBooking, VehicleType, generateMockFare, calculateDistance } from '@/contexts/BookingContext';
import { supabase } from '@/integrations/supabase/client';

interface VehicleOptionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onVehicleSelect: (type: VehicleType) => void;
}

const vehicles = [
  {
    type: 'bike' as const,
    label: 'Bike',
    icon: Bike,
    description: 'Quick & affordable',
    seats: 1,
    etaBonus: 0,
  },
  {
    type: 'auto' as const,
    label: 'Auto',
    icon: Car,
    description: 'Comfortable ride',
    seats: 3,
    etaBonus: 2,
  },
  {
    type: 'cab' as const,
    label: 'Cab',
    icon: Car,
    description: 'Premium comfort',
    seats: 4,
    etaBonus: 5,
  },
];

const VehicleOptionsSheet = ({ isOpen, onClose, onVehicleSelect }: VehicleOptionsSheetProps) => {
  const { state, dispatch } = useBooking();

  // Fetch fares when sheet opens
  useEffect(() => {
    if (isOpen && state.pickupLocation && state.dropLocation) {
      fetchAllFares();
    }
  }, [isOpen, state.pickupLocation?.lat, state.dropLocation?.lat]);

  const fetchAllFares = async () => {
    if (!state.pickupLocation || !state.dropLocation) return;
    
    dispatch({ type: 'SET_FARES_LOADING', payload: true });

    try {
      const types: VehicleType[] = ['bike', 'auto', 'cab'];
      
      // Try to fetch real fares
      const results = await Promise.all(
        types.map(async (type) => {
          try {
            const { data, error } = await supabase.functions.invoke('calculate-fare', {
              body: {
                pickup_lat: state.pickupLocation!.lat,
                pickup_lng: state.pickupLocation!.lng,
                drop_lat: state.dropLocation!.lat,
                drop_lng: state.dropLocation!.lng,
                vehicle_type: type,
              },
            });
            
            if (error) throw error;
            return { type, fare: data };
          } catch (err) {
            console.warn(`Failed to fetch ${type} fare, using mock:`, err);
            return null;
          }
        })
      );

      // Check if any fares came back
      const validResults = results.filter((r) => r !== null);
      
      if (validResults.length > 0) {
        // Use real fares
        const allFares = {
          bike: results.find((r) => r?.type === 'bike')?.fare || null,
          auto: results.find((r) => r?.type === 'auto')?.fare || null,
          cab: results.find((r) => r?.type === 'cab')?.fare || null,
        };
        dispatch({ type: 'SET_ALL_FARES', payload: allFares });
      } else {
        // Fall back to mock fares
        generateAndSetMockFares();
      }
    } catch (error) {
      console.error('Error fetching fares:', error);
      generateAndSetMockFares();
    }
  };

  const generateAndSetMockFares = () => {
    if (!state.pickupLocation || !state.dropLocation) return;
    
    const { distance, duration } = calculateDistance(state.pickupLocation, state.dropLocation);
    
    const mockFares = {
      bike: generateMockFare(distance, duration, 'bike'),
      auto: generateMockFare(distance, duration, 'auto'),
      cab: generateMockFare(distance, duration, 'cab'),
    };
    
    dispatch({ type: 'SET_ALL_FARES', payload: mockFares });
  };

  const handleSelect = (type: VehicleType) => {
    dispatch({ type: 'SET_VEHICLE_TYPE', payload: type });
    onVehicleSelect(type);
  };

  const getFare = (type: VehicleType) => state.allFares[type]?.final_fare;
  const getEta = (type: VehicleType) => {
    const baseDuration = state.allFares[type]?.duration_mins || state.eta || 15;
    const vehicle = vehicles.find((v) => v.type === type);
    return Math.round(baseDuration + (vehicle?.etaBonus || 0));
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-auto max-h-[60vh] rounded-t-3xl">
        <div className="bottom-sheet-handle" />
        <SheetHeader>
          <SheetTitle>Choose your ride</SheetTitle>
        </SheetHeader>

        <div className="py-4 space-y-4">
          {/* Loading State */}
          {state.isLoadingFares && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Finding best fares...</span>
            </div>
          )}

          {/* Vehicle Options */}
          {!state.isLoadingFares && (
            <div className="space-y-3">
              {vehicles.map((vehicle) => {
                const fare = getFare(vehicle.type);
                const eta = getEta(vehicle.type);
                const isSelected = state.vehicleType === vehicle.type;

                return (
                  <button
                    key={vehicle.type}
                    onClick={() => handleSelect(vehicle.type)}
                    className={cn(
                      'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/50'
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        'w-14 h-14 rounded-full flex items-center justify-center shrink-0',
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      )}
                    >
                      <vehicle.icon className="w-7 h-7" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-lg">{vehicle.label}</p>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {vehicle.seats} seat{vehicle.seats > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{vehicle.description}</p>
                      {eta && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{eta} mins away</span>
                        </div>
                      )}
                    </div>

                    {/* Fare */}
                    <div className="text-right shrink-0">
                      {fare ? (
                        <p className="text-xl font-bold text-primary">₹{fare}</p>
                      ) : (
                        <div className="w-16 h-6 bg-muted animate-pulse rounded" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Route Info */}
          {state.allFares.bike && (
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground pt-2 border-t border-border">
              <span>{state.allFares.bike.distance_km} km</span>
              <span>•</span>
              <span>~{state.allFares.bike.duration_mins} mins</span>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default VehicleOptionsSheet;

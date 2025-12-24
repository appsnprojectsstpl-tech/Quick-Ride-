import { useState, useEffect } from 'react';
import { Loader2, X, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBooking } from '@/contexts/BookingContext';

interface SearchingCaptainViewProps {
  onCancel: () => void;
}

const SearchingCaptainView = ({ onCancel }: SearchingCaptainViewProps) => {
  const { state } = useBooking();
  const [searchTime, setSearchTime] = useState(0);
  const [dots, setDots] = useState('');

  // Timer for search duration
  useEffect(() => {
    const timer = setInterval(() => {
      setSearchTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Animated dots
  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(dotTimer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getSearchMessage = () => {
    if (searchTime < 15) return 'Looking for nearby captains';
    if (searchTime < 30) return 'Expanding search area';
    if (searchTime < 60) return 'Checking more captains';
    return 'Still searching, please wait';
  };

  return (
    <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-lg">Finding your captain</h3>
        <Button variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Animated Search Indicator */}
      <div className="flex flex-col items-center py-8">
        <div className="relative">
          {/* Pulsing rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 animate-ping" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 animate-pulse" />
          </div>
          
          {/* Center icon */}
          <div className="relative w-16 h-16 rounded-full bg-primary flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary-foreground animate-spin" />
          </div>
        </div>

        <p className="mt-8 text-lg font-medium">
          {getSearchMessage()}{dots}
        </p>
        
        <p className="text-sm text-muted-foreground mt-2">
          Searching for {formatTime(searchTime)}
        </p>
      </div>

      {/* Ride Summary */}
      <div className="bg-muted/30 rounded-xl p-4 space-y-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1.5" />
          <p className="text-sm line-clamp-1">{state.pickupLocation?.address}</p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1.5" />
          <p className="text-sm line-clamp-1">{state.dropLocation?.address}</p>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">
            {state.vehicleType.charAt(0).toUpperCase() + state.vehicleType.slice(1)} • {state.fare?.distance_km} km
          </span>
          <span className="font-bold text-primary">₹{state.fare?.final_fare}</span>
        </div>
      </div>

      {/* Cancel Button */}
      <Button variant="outline" className="w-full" onClick={onCancel}>
        Cancel Search
      </Button>

      {/* Help text */}
      {searchTime > 45 && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Taking longer than usual. All nearby captains may be busy. You can continue waiting or try again later.
          </p>
        </div>
      )}
    </div>
  );
};

export default SearchingCaptainView;

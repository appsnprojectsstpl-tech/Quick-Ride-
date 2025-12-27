import { useState, useEffect, useRef } from 'react';
import { MapPin, Clock, IndianRupee, Check, X, Navigation, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface RideOffer {
  id: string;
  ride_id: string;
  expires_at: string;
  distance_to_pickup_km: number;
  eta_minutes: number;
  estimated_earnings: number;
  ride: {
    id: string;
    pickup_address: string;
    drop_address: string;
    estimated_distance_km: number;
    estimated_duration_mins: number;
    final_fare: number;
    vehicle_type: string;
    pickup_lat: number;
    pickup_lng: number;
    drop_lat: number;
    drop_lng: number;
  };
}

interface RideOfferPopupProps {
  offer: RideOffer;
  captainId: string;
  onAccepted: (rideDetails: any) => void;
  onDeclined: () => void;
}

const DECLINE_REASONS = [
  { id: 'too_far', label: 'Too far' },
  { id: 'wrong_direction', label: 'Wrong direction' },
  { id: 'low_fare', label: 'Fare too low' },
  { id: 'personal', label: 'Personal reason' },
  { id: 'other', label: 'Other' },
];

const RideOfferPopup = ({ offer, captainId, onAccepted, onDeclined }: RideOfferPopupProps) => {
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [isResponding, setIsResponding] = useState(false);
  const [showDeclineReasons, setShowDeclineReasons] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play notification sound on mount
  useEffect(() => {
    try {
      // Create a simple beep sound using AudioContext
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 200);

      // Play again after 500ms
      setTimeout(() => {
        const audioContext2 = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator2 = audioContext2.createOscillator();
        const gainNode2 = audioContext2.createGain();

        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext2.destination);

        oscillator2.frequency.value = 1000;
        oscillator2.type = 'sine';
        gainNode2.gain.value = 0.3;

        oscillator2.start();
        setTimeout(() => {
          oscillator2.stop();
          audioContext2.close();
        }, 200);
      }, 300);
    } catch (e) {
      console.log('Audio not supported');
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    const expiresAt = new Date(offer.expires_at).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onDeclined();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [offer.expires_at, onDeclined]);

  const handleAccept = async () => {
    setIsResponding(true);
    try {
      const res = await fetch('http://localhost:3001/api/respond-to-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_id: offer.id,
          captain_id: captainId,
          response: 'accept',
        })
      });
      const data = await res.json();
      const error = !res.ok ? data : null;

      if (error) throw error;

      if (data?.success) {
        onAccepted(data.ride);
      } else {
        console.error('Accept failed:', data?.error);
        onDeclined();
      }
    } catch (error) {
      console.error('Error accepting offer:', error);
      onDeclined();
    } finally {
      setIsResponding(false);
    }
  };

  const handleDecline = async (reason: string) => {
    setIsResponding(true);
    try {
      await fetch('http://localhost:3001/api/respond-to-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offer_id: offer.id,
          captain_id: captainId,
          response: 'decline',
          decline_reason: reason,
        })
      });
    } catch (error) {
      console.error('Error declining offer:', error);
    } finally {
      setIsResponding(false);
      onDeclined();
    }
  };

  const ride = offer.ride;
  const timerPercentage = (timeRemaining / 15) * 100;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 100, opacity: 0, scale: 0.95 }}
      className="fixed bottom-24 left-4 right-4 z-50"
    >
      <div className="bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Timer Bar */}
        <div className="h-2 bg-muted relative overflow-hidden">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: `${timerPercentage}%` }}
            className={`h-full transition-all ${timeRemaining <= 5 ? 'bg-destructive' : 'bg-primary'
              }`}
          />
        </div>

        {/* Header with countdown */}
        <div className="p-4 bg-primary/10 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${timeRemaining <= 5 ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
                }`}>
                {timeRemaining}
              </div>
              <div>
                <p className="font-semibold">New Ride Request</p>
                <p className="text-xs text-muted-foreground">Respond quickly!</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">₹{offer.estimated_earnings}</p>
              <p className="text-xs text-muted-foreground">Your earning</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Distance & Time to Pickup */}
          <div className="flex items-center gap-4 text-sm bg-muted/50 rounded-lg p-2">
            <div className="flex items-center gap-1 flex-1">
              <MapPin className="w-4 h-4 text-primary" />
              <span className="font-medium">{offer.distance_to_pickup_km?.toFixed(1) || '?'} km</span>
              <span className="text-muted-foreground">to pickup</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-primary" />
              <span className="font-medium">~{offer.eta_minutes || '?'} min</span>
            </div>
          </div>

          {/* Route */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-success" />
                <div className="w-0.5 h-8 bg-border" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Pickup</p>
                <p className="text-sm font-medium truncate">{ride.pickup_address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Drop-off</p>
                <p className="text-sm font-medium truncate">{ride.drop_address}</p>
              </div>
            </div>
          </div>

          {/* Trip Details */}
          <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-3">
            <div className="text-center flex-1">
              <p className="text-muted-foreground text-xs">Distance</p>
              <p className="font-semibold">{ride.estimated_distance_km?.toFixed(1) || '?'} km</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center flex-1">
              <p className="text-muted-foreground text-xs">Duration</p>
              <p className="font-semibold">{ride.estimated_duration_mins || '?'} min</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center flex-1">
              <p className="text-muted-foreground text-xs">Type</p>
              <p className="font-semibold capitalize">{ride.vehicle_type}</p>
            </div>
          </div>
        </div>

        {/* Decline Reasons Popup */}
        <AnimatePresence>
          {showDeclineReasons && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border overflow-hidden"
            >
              <div className="p-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Why are you declining?</p>
                <div className="grid grid-cols-2 gap-2">
                  {DECLINE_REASONS.map((reason) => (
                    <Button
                      key={reason.id}
                      variant="outline"
                      size="sm"
                      onClick={() => handleDecline(reason.label)}
                      disabled={isResponding}
                      className="text-xs"
                    >
                      {reason.label}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeclineReasons(false)}
                  className="w-full mt-2"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        {!showDeclineReasons && (
          <div className="flex border-t border-border">
            <Button
              variant="ghost"
              className="flex-1 rounded-none h-14 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDeclineReasons(true)}
              disabled={isResponding}
            >
              <X className="w-5 h-5 mr-2" />
              Decline
            </Button>
            <div className="w-px bg-border" />
            <Button
              className="flex-1 rounded-none h-14 bg-success hover:bg-success/90 text-success-foreground"
              onClick={handleAccept}
              disabled={isResponding}
            >
              {isResponding ? (
                <span className="animate-pulse">Accepting...</span>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Accept
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default RideOfferPopup;

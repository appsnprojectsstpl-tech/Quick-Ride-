import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

interface CancellationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (fee?: number) => void;
  rideStatus: string;
  matchedAt: string | null;
}

const CancellationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  rideStatus,
  matchedAt,
}: CancellationDialogProps) => {
  const [cancellationFee, setCancellationFee] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const calculateFee = async () => {
      setIsLoading(true);
      try {
        // Calculate time since match
        const matchedTime = matchedAt ? new Date(matchedAt) : null;
        const now = new Date();
        const secondsSinceMatch = matchedTime 
          ? Math.floor((now.getTime() - matchedTime.getTime()) / 1000) 
          : 0;

        // Get penalty configuration
        const { data: penalties } = await supabase
          .from('cancellation_penalties')
          .select('*')
          .eq('cancelled_by', 'rider')
          .eq('ride_status', rideStatus)
          .eq('is_active', true);

        // Find matching penalty
        let fee = 0;
        for (const penalty of penalties || []) {
          const minTime = penalty.min_time_after_match_seconds || 0;
          const maxTime = penalty.max_time_after_match_seconds;

          if (secondsSinceMatch >= minTime && (maxTime === null || secondsSinceMatch <= maxTime)) {
            fee = penalty.penalty_amount || 0;
            break;
          }
        }

        setCancellationFee(fee);
      } catch (error) {
        console.error('Error calculating fee:', error);
        setCancellationFee(0);
      } finally {
        setIsLoading(false);
      }
    };

    calculateFee();
  }, [isOpen, rideStatus, matchedAt]);

  const handleConfirm = () => {
    onConfirm(cancellationFee);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Cancel Ride?
          </DialogTitle>
          <DialogDescription>
            {isLoading ? (
              <span className="animate-pulse">Calculating cancellation fee...</span>
            ) : cancellationFee > 0 ? (
              <>
                A cancellation fee of <span className="font-bold text-destructive">₹{cancellationFee}</span> will be charged.
              </>
            ) : (
              'Are you sure you want to cancel this ride? No fee will be charged.'
            )}
          </DialogDescription>
        </DialogHeader>

        {!isLoading && cancellationFee > 0 && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cancellation Fee</span>
              <span className="text-lg font-bold text-destructive">₹{cancellationFee}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {rideStatus === 'captain_arriving' || rideStatus === 'waiting_for_rider'
                ? 'Captain is already on the way. Cancellation fee applies.'
                : 'You waited more than 2 minutes after captain was assigned.'}
            </p>
          </div>
        )}

        {rideStatus === 'pending' && (
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              We're still looking for a captain. You can cancel without any fee.
            </p>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Keep Ride
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? 'Loading...' : cancellationFee > 0 ? `Cancel & Pay ₹${cancellationFee}` : 'Cancel Ride'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CancellationDialog;

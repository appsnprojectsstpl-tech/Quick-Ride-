import { useState } from 'react';
import { Shield, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OTPVerificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  expectedOTP: string;
  captainName?: string;
  onVerified: () => void;
}

const OTPVerificationSheet = ({
  isOpen,
  onClose,
  rideId,
  expectedOTP,
  captainName,
  onVerified,
}: OTPVerificationSheetProps) => {
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleVerify = async () => {
    if (otp.length !== 4) {
      setError('Please enter the 4-digit OTP');
      return;
    }

    setError('');
    setIsVerifying(true);

    try {
      // Verify OTP matches
      if (otp !== expectedOTP) {
        setError('Incorrect OTP. Please check with your captain.');
        setIsVerifying(false);
        return;
      }

      // Update ride status to in_progress
      const { error: updateError } = await supabase
        .from('rides')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', rideId);

      if (updateError) throw updateError;

      toast({
        title: 'OTP Verified!',
        description: 'Your ride has started. Have a safe journey!',
      });

      onVerified();
      onClose();
    } catch (err: any) {
      console.error('OTP verification error:', err);
      toast({
        variant: 'destructive',
        title: 'Verification failed',
        description: err.message,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <SheetTitle>Verify Your Ride</SheetTitle>
          <SheetDescription>
            Ask {captainName || 'your captain'} for the 4-digit OTP to start your ride
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={4}
              value={otp}
              onChange={(value) => {
                setOtp(value);
                setError('');
              }}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="w-14 h-14 text-xl" />
                <InputOTPSlot index={1} className="w-14 h-14 text-xl" />
                <InputOTPSlot index={2} className="w-14 h-14 text-xl" />
                <InputOTPSlot index={3} className="w-14 h-14 text-xl" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}

          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground text-center">
              For your safety, only enter the OTP when you're inside the vehicle 
              and have verified the captain and vehicle details.
            </p>
          </div>

          <Button 
            onClick={handleVerify} 
            className="w-full" 
            size="lg"
            disabled={isVerifying || otp.length !== 4}
          >
            {isVerifying ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Verify & Start Ride
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default OTPVerificationSheet;

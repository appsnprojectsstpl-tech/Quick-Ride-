import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OTPVerificationDialogProps {
    rideId: string;
    onVerified: () => void;
    onCancel: () => void;
    open: boolean;
}

export const OTPVerificationDialog = ({
    rideId,
    onVerified,
    onCancel,
    open,
}: OTPVerificationDialogProps) => {
    const [otp, setOtp] = useState(['', '', '', '']);
    const [attempts, setAttempts] = useState(0);
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const { toast } = useToast();

    const handleOtpChange = (index: number, value: string) => {
        if (value.length > 1) {
            value = value[0];
        }

        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        setError('');

        // Auto-focus next input
        if (value && index < 3) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            prevInput?.focus();
        }
    };

    const handleVerify = async () => {
        const enteredOtp = otp.join('');

        if (enteredOtp.length !== 4) {
            setError('Please enter complete 4-digit OTP');
            return;
        }

        setIsVerifying(true);
        setError('');

        try {
            // Fetch ride OTP from database
            const { data: ride, error: fetchError } = await supabase
                .from('rides')
                .select('otp')
                .eq('id', rideId)
                .single();

            if (fetchError) throw fetchError;

            if (ride.otp === enteredOtp) {
                toast({
                    title: 'OTP Verified!',
                    description: 'Starting ride...',
                });
                onVerified();
            } else {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);

                if (newAttempts >= 3) {
                    setError('Too many failed attempts. Please contact support.');
                    toast({
                        variant: 'destructive',
                        title: 'Verification Failed',
                        description: 'Too many incorrect attempts. Contact support.',
                    });
                } else {
                    setError(`Incorrect OTP. ${3 - newAttempts} attempts remaining.`);
                    setOtp(['', '', '', '']);
                    document.getElementById('otp-0')?.focus();
                }
            }
        } catch (err) {
            console.error('OTP verification error:', err);
            setError('Failed to verify OTP. Please try again.');
        } finally {
            setIsVerifying(false);
        }
    };

    const handlePaste = (e: React.ClipboardPaste<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').slice(0, 4);
        if (!/^\d+$/.test(pastedData)) return;

        const newOtp = pastedData.split('').concat(['', '', '', '']).slice(0, 4);
        setOtp(newOtp);

        if (pastedData.length === 4) {
            document.getElementById('otp-3')?.focus();
        }
    };

    return (
        <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Enter OTP</DialogTitle>
                    <DialogDescription>
                        Ask your rider for the 4-digit verification code
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex gap-3 justify-center">
                        {otp.map((digit, index) => (
                            <Input
                                key={index}
                                id={`otp-${index}`}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={handlePaste}
                                className="w-14 h-14 text-center text-2xl font-bold"
                                disabled={isVerifying || attempts >= 3}
                                autoFocus={index === 0}
                            />
                        ))}
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-destructive text-sm">
                            <AlertCircle className="w-4 h-4" />
                            <span>{error}</span>
                        </div>
                    )}

                    <p className="text-sm text-muted-foreground text-center">
                        The rider will share this code with you at pickup
                    </p>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        disabled={isVerifying}
                        className="w-full sm:w-auto"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleVerify}
                        disabled={isVerifying || otp.join('').length !== 4 || attempts >= 3}
                        className="w-full sm:w-auto"
                    >
                        {isVerifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Verify & Start Ride
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

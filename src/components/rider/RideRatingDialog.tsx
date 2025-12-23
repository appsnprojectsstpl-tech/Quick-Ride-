import { useState } from 'react';
import { Star, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RideRatingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  captainName?: string;
  onRated: () => void;
}

const ratingTags = [
  'Polite',
  'Safe Driver',
  'On Time',
  'Clean Vehicle',
  'Good Navigation',
  'Followed Route',
];

const RideRatingDialog = ({
  isOpen,
  onClose,
  rideId,
  captainName,
  onRated,
}: RideRatingDialogProps) => {
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get ride details to find captain
      const { data: ride } = await supabase
        .from('rides')
        .select('captain_id, captains(user_id)')
        .eq('id', rideId)
        .single();

      const captainUserId = (ride?.captains as any)?.user_id;

      const { error } = await supabase.from('ratings').insert({
        ride_id: rideId,
        from_user_id: user.id,
        to_user_id: captainUserId,
        rating,
        tags: selectedTags,
        feedback: feedback || null,
        tip_amount: tipAmount ? parseFloat(tipAmount) : 0,
      });

      if (error) throw error;

      toast({
        title: 'Thanks for your feedback!',
        description: 'Your rating has been submitted.',
      });

      onRated();
      onClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            Rate your ride{captainName ? ` with ${captainName}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 ${
                    star <= (hoveredRating || rating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-muted-foreground'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Tags */}
          <div>
            <Label className="text-sm text-muted-foreground">
              What went well?
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ratingTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Feedback */}
          <div>
            <Label htmlFor="feedback">Additional feedback (optional)</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us more about your experience..."
              rows={3}
            />
          </div>

          {/* Tip */}
          <div>
            <Label htmlFor="tip">Add a tip (optional)</Label>
            <div className="flex gap-2 mt-2">
              {['20', '50', '100'].map((amount) => (
                <Button
                  key={amount}
                  variant={tipAmount === amount ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTipAmount(amount)}
                >
                  ₹{amount}
                </Button>
              ))}
              <Input
                id="tip"
                type="number"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="Custom"
                className="w-24"
              />
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Submitting...' : 'Submit Rating'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RideRatingDialog;

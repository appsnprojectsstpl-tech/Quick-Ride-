import { useState, useEffect } from 'react';
import { Phone, MessageCircle, Navigation, AlertTriangle, Share2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Captain {
  name: string;
  phone: string;
  avatar_url: string | null;
  rating: number;
  vehicle: {
    make: string;
    model: string;
    registration_number: string;
  };
  eta_mins: number;
}

interface ActiveRideCardProps {
  rideId: string;
  status: string;
  captain: Captain | null;
  otp: string | null;
  onCancel: () => void;
  onSOS: () => void;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Finding Captain', color: 'bg-warning text-warning-foreground' },
  matched: { label: 'Captain Assigned', color: 'bg-info text-info-foreground' },
  captain_arriving: { label: 'Captain Arriving', color: 'bg-info text-info-foreground' },
  waiting_for_rider: { label: 'Captain Waiting', color: 'bg-warning text-warning-foreground' },
  in_progress: { label: 'On Trip', color: 'bg-success text-success-foreground' },
};

const ActiveRideCard = ({ rideId, status, captain, otp, onCancel, onSOS }: ActiveRideCardProps) => {
  const [eta, setEta] = useState(captain?.eta_mins || 0);
  const { toast } = useToast();

  useEffect(() => {
    if (status === 'captain_arriving' && eta > 0) {
      const interval = setInterval(() => {
        setEta((prev) => Math.max(0, prev - 1));
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [status, eta]);

  const handleCall = () => {
    if (captain?.phone) {
      window.open(`tel:${captain.phone}`, '_self');
    }
  };

  const handleShare = async () => {
    try {
      const shareUrl = `${window.location.origin}/track/${rideId}`;
      if (navigator.share) {
        await navigator.share({
          title: 'Track my ride',
          text: 'Follow my live location',
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: 'Link copied!', description: 'Share this link to track your ride' });
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  return (
    <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
      {/* Status Header */}
      <div className={`px-4 py-3 ${statusLabels[status]?.color || 'bg-muted'}`}>
        <div className="flex items-center justify-between">
          <span className="font-semibold">{statusLabels[status]?.label || status}</span>
          {status === 'captain_arriving' && eta > 0 && (
            <span className="text-sm">ETA: {eta} mins</span>
          )}
        </div>
      </div>

      {/* OTP Display */}
      {otp && status !== 'in_progress' && (
        <div className="px-4 py-3 bg-primary/10 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Share OTP with captain</span>
            <span className="text-2xl font-bold tracking-wider">{otp}</span>
          </div>
        </div>
      )}

      {/* Captain Info */}
      {captain && (
        <div className="p-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={captain.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {captain.name?.charAt(0) || 'C'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-lg">{captain.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>⭐ {captain.rating?.toFixed(1)}</span>
                <span>•</span>
                <span>{captain.vehicle.make} {captain.vehicle.model}</span>
              </div>
              <Badge variant="outline" className="mt-1">
                {captain.vehicle.registration_number}
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleCall}>
              <Phone className="w-4 h-4 mr-2" />
              Call
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" />
              Share Trip
            </Button>
          </div>
        </div>
      )}

      {/* Pending State */}
      {status === 'pending' && !captain && (
        <div className="p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-muted-foreground">Looking for captains nearby...</p>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex border-t border-border">
        {status !== 'in_progress' && (
          <Button
            variant="ghost"
            className="flex-1 rounded-none h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onCancel}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel Ride
          </Button>
        )}
        <Button
          variant="ghost"
          className="flex-1 rounded-none h-12 sos-button"
          onClick={onSOS}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          SOS
        </Button>
      </div>
    </div>
  );
};

export default ActiveRideCard;

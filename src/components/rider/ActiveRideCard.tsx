import { useState, useEffect } from 'react';
import { Phone, Share2, X, AlertTriangle, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCaptainTracking } from '@/hooks/useCaptainTracking';
import { useDirections } from '@/hooks/useDirections';

interface Captain {
  id: string;
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
  pickupLat?: number;
  pickupLng?: number;
  dropLat?: number;
  dropLng?: number;
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

const ActiveRideCard = ({
  rideId,
  status,
  captain,
  otp,
  pickupLat,
  pickupLng,
  dropLat,
  dropLng,
  onCancel,
  onSOS
}: ActiveRideCardProps) => {
  const { toast } = useToast();

  // Track captain's real-time location
  const { captainLocation } = useCaptainTracking({
    captainId: captain?.id || '',
    enabled: !!captain?.id && ['matched', 'captain_arriving', 'in_progress'].includes(status),
  });

  // Get real-time directions with traffic
  const { routeInfo, fetchDirections, lastUpdated } = useDirections({
    autoRefreshInterval: 30000, // Refresh every 30 seconds
    enabled: !!captainLocation && ['matched', 'captain_arriving', 'in_progress'].includes(status),
  });

  // Fetch directions when captain location updates
  useEffect(() => {
    if (!captainLocation) return;

    // Determine destination based on status
    const isGoingToPickup = ['matched', 'captain_arriving', 'waiting_for_rider'].includes(status);
    const destination = isGoingToPickup
      ? { lat: pickupLat || 0, lng: pickupLng || 0 }
      : { lat: dropLat || 0, lng: dropLng || 0 };

    if (destination.lat && destination.lng) {
      fetchDirections(
        { lat: captainLocation.lat, lng: captainLocation.lng },
        destination
      );
    }
  }, [captainLocation?.lat, captainLocation?.lng, status, pickupLat, pickupLng, dropLat, dropLng]);

  // Format ETA time
  const formatEta = (etaString?: string) => {
    if (!etaString) return null;
    const etaDate = new Date(etaString);
    return etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const liveEta = routeInfo?.eta ? formatEta(routeInfo.eta) : null;
  const liveDuration = routeInfo?.durationInTraffic?.text || routeInfo?.duration?.text;

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
    <>
      <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
        {/* Status Header */}
        <div className={`px-4 py-3 ${statusLabels[status]?.color || 'bg-muted'}`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold">{statusLabels[status]?.label || status}</span>
            {liveEta && ['captain_arriving', 'in_progress'].includes(status) && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                <span className="text-sm font-medium">ETA: {liveEta}</span>
              </div>
            )}
          </div>
        </div>

        {/* Live ETA Banner */}
        {liveDuration && ['captain_arriving', 'in_progress'].includes(status) && (
          <div className="bg-success/10 border-b border-success/20 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-success" />
                <span className="text-sm text-success font-medium">Live Traffic Update</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="font-bold">{liveDuration}</span>
                  {routeInfo?.distance && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({routeInfo.distance.text})
                    </span>
                  )}
                </div>
                {lastUpdated && (
                  <span className="text-xs text-muted-foreground">
                    {Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* OTP Display - Always visible for rider to share with captain */}
        {otp && status !== 'in_progress' && status !== 'completed' && (
          <div className="px-4 py-4 bg-gradient-to-br from-primary/20 to-primary/5 border-y border-primary/20">
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2">Your Ride OTP</p>
              <p className="text-4xl font-bold tracking-[0.5em] mb-2">{otp}</p>
              <p className="text-xs text-muted-foreground">
                {status === 'waiting_for_rider'
                  ? 'Share this code with your captain now'
                  : 'Share this code with your captain at pickup'}
              </p>
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
    </>
  );
};

export default ActiveRideCard;

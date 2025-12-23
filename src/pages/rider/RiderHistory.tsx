import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface Ride {
  id: string;
  status: string;
  pickup_address: string;
  drop_address: string;
  final_fare: number;
  requested_at: string;
  completed_at: string | null;
  vehicle_type: string;
}

const statusColors: Record<string, string> = {
  completed: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
  pending: 'bg-warning/10 text-warning',
  in_progress: 'bg-info/10 text-info',
};

const RiderHistory = () => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchRides = async () => {
      const { data, error } = await supabase
        .from('rides')
        .select('id, status, pickup_address, drop_address, final_fare, requested_at, completed_at, vehicle_type')
        .eq('rider_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setRides(data);
      }
      setIsLoading(false);
    };

    fetchRides();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="mobile-header">
        <Button variant="ghost" size="icon" onClick={() => navigate('/rider')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-display font-bold text-lg">Ride History</h1>
        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="ride-card animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No rides yet</p>
            <Button onClick={() => navigate('/rider')} className="mt-4">
              Book Your First Ride
            </Button>
          </div>
        ) : (
          rides.map((ride) => (
            <div key={ride.id} className="ride-card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(ride.requested_at), 'MMM d, yyyy • h:mm a')}
                  </p>
                  <Badge className={statusColors[ride.status] || 'bg-muted'}>
                    {ride.status.replace('_', ' ')}
                  </Badge>
                </div>
                {ride.final_fare && (
                  <p className="font-bold text-lg">₹{ride.final_fare}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-success mt-1.5" />
                  <p className="text-sm line-clamp-1">{ride.pickup_address}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-destructive mt-1.5" />
                  <p className="text-sm line-clamp-1">{ride.drop_address}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground capitalize">
                  {ride.vehicle_type}
                </span>
                {ride.status === 'completed' && (
                  <Button variant="ghost" size="sm" className="text-xs">
                    <Star className="w-3 h-3 mr-1" />
                    Rate Ride
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RiderHistory;

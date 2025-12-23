import { useState, useEffect } from 'react';
import { Search, Filter, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Ride {
  id: string;
  status: string;
  vehicle_type: string;
  pickup_address: string;
  drop_address: string;
  final_fare: number;
  estimated_distance_km: number;
  estimated_duration_mins: number;
  requested_at: string;
  completed_at: string | null;
  rider_id: string;
  captain_id: string | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  matched: 'bg-info/10 text-info',
  captain_arriving: 'bg-info/10 text-info',
  waiting_for_rider: 'bg-warning/10 text-warning',
  in_progress: 'bg-primary/10 text-primary',
  completed: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
};

const AdminRides = () => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

  useEffect(() => {
    fetchRides();
  }, [statusFilter, vehicleFilter]);

  const fetchRides = async () => {
    setIsLoading(true);

    let query = supabase
      .from('rides')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(100);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as any);
    }

    if (vehicleFilter !== 'all') {
      query = query.eq('vehicle_type', vehicleFilter as any);
    }

    const { data, error } = await query;

    if (!error) {
      setRides(data || []);
    }

    setIsLoading(false);
  };

  const stats = {
    total: rides.length,
    completed: rides.filter((r) => r.status === 'completed').length,
    cancelled: rides.filter((r) => r.status === 'cancelled').length,
    active: rides.filter((r) => ['pending', 'matched', 'captain_arriving', 'waiting_for_rider', 'in_progress'].includes(r.status)).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold">Rides</h1>
        <p className="text-muted-foreground">View and manage all rides</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Rides</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-info">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-success">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Cancelled</p>
            <p className="text-2xl font-bold text-destructive">{stats.cancelled}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by pickup or drop..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Vehicle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vehicles</SelectItem>
            <SelectItem value="bike">Bike</SelectItem>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="cab">Cab</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ride ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Drop</TableHead>
                <TableHead>Fare</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : rides.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No rides found
                  </TableCell>
                </TableRow>
              ) : (
                rides.map((ride) => (
                  <TableRow key={ride.id}>
                    <TableCell className="font-mono text-xs">
                      {ride.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[ride.status] || 'bg-muted'}>
                        {ride.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{ride.vehicle_type}</TableCell>
                    <TableCell className="max-w-32 truncate">{ride.pickup_address}</TableCell>
                    <TableCell className="max-w-32 truncate">{ride.drop_address}</TableCell>
                    <TableCell>₹{ride.final_fare || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(ride.requested_at), 'MMM d, h:mm a')}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setSelectedRide(ride)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Ride Details Dialog */}
      <Dialog open={!!selectedRide} onOpenChange={() => setSelectedRide(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ride Details</DialogTitle>
          </DialogHeader>
          {selectedRide && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Ride ID</p>
                  <p className="font-mono text-sm">{selectedRide.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusColors[selectedRide.status]}>
                    {selectedRide.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vehicle Type</p>
                  <p className="capitalize">{selectedRide.vehicle_type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fare</p>
                  <p className="font-bold">₹{selectedRide.final_fare || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pickup</p>
                <p>{selectedRide.pickup_address}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Drop</p>
                <p>{selectedRide.drop_address}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Distance</p>
                  <p>{selectedRide.estimated_distance_km || '-'} km</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p>{selectedRide.estimated_duration_mins || '-'} mins</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Requested</p>
                  <p>{format(new Date(selectedRide.requested_at), 'PPpp')}</p>
                </div>
                {selectedRide.completed_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p>{format(new Date(selectedRide.completed_at), 'PPpp')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRides;

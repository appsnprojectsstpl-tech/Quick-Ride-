import { useState, useEffect } from 'react';
import { Search, MoreVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Rider {
  user_id: string;
  created_at: string;
  profile?: {
    name: string;
    phone: string;
    email: string;
    avatar_url: string;
  };
  rideCount: number;
  totalSpent: number;
}

const AdminRiders = () => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRiders();
  }, []);

  const fetchRiders = async () => {
    setIsLoading(true);

    // Get all riders
    const { data: riderRoles, error } = await supabase
      .from('user_roles')
      .select('user_id, created_at')
      .eq('role', 'rider')
      .order('created_at', { ascending: false });

    if (!error && riderRoles) {
      const userIds = riderRoles.map((r) => r.user_id);

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, phone, email, avatar_url')
        .in('user_id', userIds);

      // Get ride stats
      const { data: rides } = await supabase
        .from('rides')
        .select('rider_id, final_fare, status')
        .in('rider_id', userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      const riderStats = new Map<string, { count: number; spent: number }>();
      (rides || []).forEach((ride) => {
        if (!ride.rider_id) return;
        const current = riderStats.get(ride.rider_id) || { count: 0, spent: 0 };
        current.count++;
        if (ride.status === 'completed') {
          current.spent += ride.final_fare || 0;
        }
        riderStats.set(ride.rider_id, current);
      });

      const ridersWithData = riderRoles.map((rider) => ({
        user_id: rider.user_id,
        created_at: rider.created_at,
        profile: profileMap.get(rider.user_id),
        rideCount: riderStats.get(rider.user_id)?.count || 0,
        totalSpent: riderStats.get(rider.user_id)?.spent || 0,
      }));

      setRiders(ridersWithData);
    }

    setIsLoading(false);
  };

  const filteredRiders = riders.filter((rider) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      rider.profile?.name?.toLowerCase().includes(query) ||
      rider.profile?.phone?.includes(query) ||
      rider.profile?.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold">Riders</h1>
        <p className="text-muted-foreground">Manage all rider accounts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Riders</p>
            <p className="text-2xl font-bold">{riders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Rides</p>
            <p className="text-2xl font-bold">
              {riders.reduce((sum, r) => sum + r.rideCount, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold text-success">
              ₹{riders.reduce((sum, r) => sum + r.totalSpent, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rider</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rides</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredRiders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No riders found
                  </TableCell>
                </TableRow>
              ) : (
                filteredRiders.map((rider) => (
                  <TableRow key={rider.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={rider.profile?.avatar_url} />
                          <AvatarFallback>
                            {rider.profile?.name?.charAt(0) || 'R'}
                          </AvatarFallback>
                        </Avatar>
                        <p className="font-medium">{rider.profile?.name || 'Unknown'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{rider.profile?.phone || '-'}</TableCell>
                    <TableCell>{rider.profile?.email || '-'}</TableCell>
                    <TableCell>{rider.rideCount}</TableCell>
                    <TableCell>₹{rider.totalSpent}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(rider.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>View Rides</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Block User</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRiders;

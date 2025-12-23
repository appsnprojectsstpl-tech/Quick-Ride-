import { useState, useEffect } from 'react';
import { Search, Filter, MoreVertical, Star, Phone, Mail, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface Captain {
  id: string;
  user_id: string;
  status: string;
  kyc_status: string;
  is_verified: boolean;
  rating: number;
  total_rides: number;
  total_earnings: number;
  wallet_balance: number;
  created_at: string;
  profile?: {
    name: string;
    phone: string;
    email: string;
    avatar_url: string;
  };
}

const AdminCaptains = () => {
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCaptains();
  }, []);

  const fetchCaptains = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from('captains')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const userIds = data.map((c) => c.user_id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, phone, email, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      const captainsWithProfiles = data.map((captain) => ({
        ...captain,
        profile: profileMap.get(captain.user_id),
      }));

      setCaptains(captainsWithProfiles);
    }

    setIsLoading(false);
  };

  const filteredCaptains = captains.filter((captain) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      captain.profile?.name?.toLowerCase().includes(query) ||
      captain.profile?.phone?.includes(query) ||
      captain.profile?.email?.toLowerCase().includes(query)
    );
  });

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      online: 'bg-success/10 text-success',
      offline: 'bg-muted text-muted-foreground',
      on_ride: 'bg-info/10 text-info',
    };
    return <Badge className={styles[status] || 'bg-muted'}>{status}</Badge>;
  };

  const kycBadge = (status: string, verified: boolean) => {
    if (verified) return <Badge className="bg-success/10 text-success">Verified</Badge>;
    const styles: Record<string, string> = {
      pending: 'bg-warning/10 text-warning',
      under_review: 'bg-info/10 text-info',
      rejected: 'bg-destructive/10 text-destructive',
    };
    return <Badge className={styles[status] || 'bg-muted'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Captains</h1>
          <p className="text-muted-foreground">Manage all captain accounts</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Captains</p>
            <p className="text-2xl font-bold">{captains.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Online Now</p>
            <p className="text-2xl font-bold text-success">
              {captains.filter((c) => c.status === 'online').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Verified</p>
            <p className="text-2xl font-bold">
              {captains.filter((c) => c.is_verified).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending KYC</p>
            <p className="text-2xl font-bold text-warning">
              {captains.filter((c) => c.kyc_status === 'pending').length}
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
                <TableHead>Captain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>KYC</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Rides</TableHead>
                <TableHead>Earnings</TableHead>
                <TableHead>Joined</TableHead>
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
              ) : filteredCaptains.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No captains found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCaptains.map((captain) => (
                  <TableRow key={captain.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={captain.profile?.avatar_url} />
                          <AvatarFallback>
                            {captain.profile?.name?.charAt(0) || 'C'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{captain.profile?.name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{captain.profile?.phone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(captain.status)}</TableCell>
                    <TableCell>{kycBadge(captain.kyc_status, captain.is_verified)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-primary fill-primary" />
                        {captain.rating?.toFixed(1) || '5.0'}
                      </div>
                    </TableCell>
                    <TableCell>{captain.total_rides || 0}</TableCell>
                    <TableCell>₹{captain.total_earnings || 0}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(captain.created_at), 'MMM d, yyyy')}
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
                          <DropdownMenuItem>View Documents</DropdownMenuItem>
                          <DropdownMenuItem>View Rides</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Block Captain</DropdownMenuItem>
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

export default AdminCaptains;

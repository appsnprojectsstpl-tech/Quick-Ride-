import { useState, useEffect } from 'react';
import { 
  Navigation, 
  Users, 
  Bike, 
  IndianRupee, 
  TrendingUp, 
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import GoogleMapView from '@/components/maps/GoogleMapView';

interface Stats {
  activeRides: number;
  onlineCaptains: number;
  totalRiders: number;
  todayRevenue: number;
  completedToday: number;
  cancelledToday: number;
  pendingKYC: number;
  openIncidents: number;
}

interface LiveRide {
  id: string;
  status: string;
  pickup_address: string;
  drop_address: string;
  pickup_lat: number;
  pickup_lng: number;
}

const AdminOverview = () => {
  const [stats, setStats] = useState<Stats>({
    activeRides: 0,
    onlineCaptains: 0,
    totalRiders: 0,
    todayRevenue: 0,
    completedToday: 0,
    cancelledToday: 0,
    pendingKYC: 0,
    openIncidents: 0,
  });
  const [liveRides, setLiveRides] = useState<LiveRide[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchLiveRides();

    // Subscribe to real-time updates
    const ridesChannel = supabase
      .channel('admin-rides')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => {
        fetchStats();
        fetchLiveRides();
      })
      .subscribe();

    const captainsChannel = supabase
      .channel('admin-captains')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'captains' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ridesChannel);
      supabase.removeChannel(captainsChannel);
    };
  }, []);

  const fetchStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      activeRidesRes,
      onlineCaptainsRes,
      totalRidersRes,
      todayRidesRes,
      pendingKYCRes,
      incidentsRes,
    ] = await Promise.all([
      supabase.from('rides').select('id', { count: 'exact' }).in('status', ['pending', 'matched', 'captain_arriving', 'waiting_for_rider', 'in_progress']),
      supabase.from('captains').select('id', { count: 'exact' }).eq('status', 'online'),
      supabase.from('user_roles').select('id', { count: 'exact' }).eq('role', 'rider'),
      supabase.from('rides').select('status, final_fare').gte('requested_at', today.toISOString()),
      supabase.from('captain_documents').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('incidents').select('id', { count: 'exact' }).eq('status', 'open'),
    ]);

    const completedToday = (todayRidesRes.data || []).filter(r => r.status === 'completed');
    const cancelledToday = (todayRidesRes.data || []).filter(r => r.status === 'cancelled');
    const revenue = completedToday.reduce((sum, r) => sum + (r.final_fare || 0), 0);

    setStats({
      activeRides: activeRidesRes.count || 0,
      onlineCaptains: onlineCaptainsRes.count || 0,
      totalRiders: totalRidersRes.count || 0,
      todayRevenue: revenue,
      completedToday: completedToday.length,
      cancelledToday: cancelledToday.length,
      pendingKYC: pendingKYCRes.count || 0,
      openIncidents: incidentsRes.count || 0,
    });

    setIsLoading(false);
  };

  const fetchLiveRides = async () => {
    const { data } = await supabase
      .from('rides')
      .select('id, status, pickup_address, drop_address, pickup_lat, pickup_lng')
      .in('status', ['pending', 'matched', 'captain_arriving', 'waiting_for_rider', 'in_progress'])
      .limit(50);

    setLiveRides(data || []);
  };

  const statCards = [
    { label: 'Active Rides', value: stats.activeRides, icon: Navigation, color: 'text-info' },
    { label: 'Online Captains', value: stats.onlineCaptains, icon: Bike, color: 'text-success' },
    { label: 'Total Riders', value: stats.totalRiders, icon: Users, color: 'text-primary' },
    { label: "Today's Revenue", value: `₹${stats.todayRevenue}`, icon: IndianRupee, color: 'text-success' },
  ];

  const mapMarkers = liveRides.map(ride => ({
    lat: ride.pickup_lat,
    lng: ride.pickup_lng,
    title: ride.status,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold">Operations Overview</h1>
        <p className="text-muted-foreground">Real-time monitoring of all rides and captains</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-full bg-muted flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <CheckCircle className="w-8 h-8 text-success" />
            <div>
              <p className="text-2xl font-bold">{stats.completedToday}</p>
              <p className="text-xs text-muted-foreground">Completed Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <XCircle className="w-8 h-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{stats.cancelledToday}</p>
              <p className="text-xs text-muted-foreground">Cancelled Today</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Clock className="w-8 h-8 text-warning" />
            <div>
              <p className="text-2xl font-bold">{stats.pendingKYC}</p>
              <p className="text-xs text-muted-foreground">Pending KYC</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{stats.openIncidents}</p>
              <p className="text-xs text-muted-foreground">Open Incidents</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Map & Recent Rides */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Map */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Live Rides Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] rounded-lg overflow-hidden">
              <GoogleMapView
                center={{ lat: 12.9716, lng: 77.5946 }}
                zoom={11}
                markers={mapMarkers}
              />
            </div>
          </CardContent>
        </Card>

        {/* Recent Rides */}
        <Card>
          <CardHeader>
            <CardTitle>Active Rides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-auto">
              {liveRides.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active rides</p>
              ) : (
                liveRides.slice(0, 10).map((ride) => (
                  <div key={ride.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ride.pickup_address}</p>
                      <p className="text-xs text-muted-foreground truncate">→ {ride.drop_address}</p>
                    </div>
                    <Badge variant="outline" className="ml-2 capitalize">
                      {ride.status.replace('_', ' ')}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;

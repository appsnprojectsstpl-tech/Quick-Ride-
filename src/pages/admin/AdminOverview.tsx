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
  AlertTriangle,
  Activity,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import GoogleMapView from '@/components/maps/GoogleMapView';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface Stats {
  activeRides: number;
  onlineCaptains: number;
  totalRiders: number;
  totalCaptains: number;
  todayRevenue: number;
  yesterdayRevenue: number;
  completedToday: number;
  cancelledToday: number;
  pendingKYC: number;
  openIncidents: number;
  totalRides: number;
  avgRating: number;
}

interface LiveRide {
  id: string;
  status: string;
  pickup_address: string;
  drop_address: string;
  pickup_lat: number;
  pickup_lng: number;
  vehicle_type: string;
  requested_at: string;
}

interface DailyStats {
  date: string;
  rides: number;
  revenue: number;
  completed: number;
  cancelled: number;
}

interface VehicleTypeStats {
  name: string;
  value: number;
  color: string;
}

interface HourlyStats {
  hour: string;
  rides: number;
}

const AdminOverview = () => {
  const [stats, setStats] = useState<Stats>({
    activeRides: 0,
    onlineCaptains: 0,
    totalRiders: 0,
    totalCaptains: 0,
    todayRevenue: 0,
    yesterdayRevenue: 0,
    completedToday: 0,
    cancelledToday: 0,
    pendingKYC: 0,
    openIncidents: 0,
    totalRides: 0,
    avgRating: 0,
  });
  const [liveRides, setLiveRides] = useState<LiveRide[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [vehicleStats, setVehicleStats] = useState<VehicleTypeStats[]>([]);
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAllData();

    // Subscribe to real-time updates
    const ridesChannel = supabase
      .channel('admin-rides-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => {
        fetchAllData();
      })
      .subscribe();

    const captainsChannel = supabase
      .channel('admin-captains-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'captains' }, () => {
        fetchStats();
      })
      .subscribe();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchAllData, 30000);

    return () => {
      supabase.removeChannel(ridesChannel);
      supabase.removeChannel(captainsChannel);
      clearInterval(interval);
    };
  }, []);

  const fetchAllData = async () => {
    await Promise.all([
      fetchStats(),
      fetchLiveRides(),
      fetchDailyStats(),
      fetchVehicleStats(),
      fetchHourlyStats(),
    ]);
    setIsLoading(false);
  };

  const fetchStats = async () => {
    const today = startOfDay(new Date());
    const yesterday = startOfDay(subDays(new Date(), 1));
    const yesterdayEnd = endOfDay(subDays(new Date(), 1));

    const [
      activeRidesRes,
      onlineCaptainsRes,
      totalRidersRes,
      totalCaptainsRes,
      todayRidesRes,
      yesterdayRidesRes,
      pendingKYCRes,
      incidentsRes,
      totalRidesRes,
      ratingsRes,
    ] = await Promise.all([
      supabase.from('rides').select('id', { count: 'exact' }).in('status', ['pending', 'matched', 'captain_arriving', 'waiting_for_rider', 'in_progress']),
      supabase.from('captains').select('id', { count: 'exact' }).eq('status', 'online'),
      supabase.from('user_roles').select('id', { count: 'exact' }).eq('role', 'rider'),
      supabase.from('captains').select('id', { count: 'exact' }),
      supabase.from('rides').select('status, final_fare').gte('requested_at', today.toISOString()),
      supabase.from('rides').select('status, final_fare').gte('requested_at', yesterday.toISOString()).lte('requested_at', yesterdayEnd.toISOString()),
      supabase.from('captain_documents').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('incidents').select('id', { count: 'exact' }).eq('status', 'open'),
      supabase.from('rides').select('id', { count: 'exact' }),
      supabase.from('ratings').select('rating'),
    ]);

    const completedToday = (todayRidesRes.data || []).filter(r => r.status === 'completed');
    const cancelledToday = (todayRidesRes.data || []).filter(r => r.status === 'cancelled');
    const todayRevenue = completedToday.reduce((sum, r) => sum + (r.final_fare || 0), 0);
    
    const completedYesterday = (yesterdayRidesRes.data || []).filter(r => r.status === 'completed');
    const yesterdayRevenue = completedYesterday.reduce((sum, r) => sum + (r.final_fare || 0), 0);

    const ratings = ratingsRes.data || [];
    const avgRating = ratings.length > 0 
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
      : 0;

    setStats({
      activeRides: activeRidesRes.count || 0,
      onlineCaptains: onlineCaptainsRes.count || 0,
      totalRiders: totalRidersRes.count || 0,
      totalCaptains: totalCaptainsRes.count || 0,
      todayRevenue,
      yesterdayRevenue,
      completedToday: completedToday.length,
      cancelledToday: cancelledToday.length,
      pendingKYC: pendingKYCRes.count || 0,
      openIncidents: incidentsRes.count || 0,
      totalRides: totalRidesRes.count || 0,
      avgRating: parseFloat(avgRating.toFixed(1)),
    });
  };

  const fetchLiveRides = async () => {
    const { data } = await supabase
      .from('rides')
      .select('id, status, pickup_address, drop_address, pickup_lat, pickup_lng, vehicle_type, requested_at')
      .in('status', ['pending', 'matched', 'captain_arriving', 'waiting_for_rider', 'in_progress'])
      .order('requested_at', { ascending: false })
      .limit(50);

    setLiveRides(data || []);
  };

  const fetchDailyStats = async () => {
    const days = 7;
    const stats: DailyStats[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const start = startOfDay(date);
      const end = endOfDay(date);
      
      const { data } = await supabase
        .from('rides')
        .select('status, final_fare')
        .gte('requested_at', start.toISOString())
        .lte('requested_at', end.toISOString());

      const completed = (data || []).filter(r => r.status === 'completed');
      const cancelled = (data || []).filter(r => r.status === 'cancelled');
      const revenue = completed.reduce((sum, r) => sum + (r.final_fare || 0), 0);

      stats.push({
        date: format(date, 'EEE'),
        rides: data?.length || 0,
        revenue: Math.round(revenue),
        completed: completed.length,
        cancelled: cancelled.length,
      });
    }
    
    setDailyStats(stats);
  };

  const fetchVehicleStats = async () => {
    const { data } = await supabase
      .from('rides')
      .select('vehicle_type')
      .eq('status', 'completed');

    const counts: Record<string, number> = {};
    (data || []).forEach(r => {
      counts[r.vehicle_type] = (counts[r.vehicle_type] || 0) + 1;
    });

    const colors: Record<string, string> = {
      bike: 'hsl(45, 100%, 51%)',
      auto: 'hsl(152, 69%, 45%)',
      cab: 'hsl(217, 91%, 60%)',
    };

    setVehicleStats(
      Object.entries(counts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: colors[name] || 'hsl(215, 16%, 47%)',
      }))
    );
  };

  const fetchHourlyStats = async () => {
    const today = startOfDay(new Date());
    
    const { data } = await supabase
      .from('rides')
      .select('requested_at')
      .gte('requested_at', today.toISOString());

    const hourCounts: Record<number, number> = {};
    (data || []).forEach(r => {
      const hour = new Date(r.requested_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const stats: HourlyStats[] = [];
    for (let h = 0; h < 24; h++) {
      stats.push({
        hour: `${h.toString().padStart(2, '0')}:00`,
        rides: hourCounts[h] || 0,
      });
    }
    
    setHourlyStats(stats);
  };

  const revenueChange = stats.yesterdayRevenue > 0 
    ? ((stats.todayRevenue - stats.yesterdayRevenue) / stats.yesterdayRevenue * 100).toFixed(1)
    : 0;
  const isRevenueUp = Number(revenueChange) >= 0;

  const statCards = [
    { 
      label: 'Active Rides', 
      value: stats.activeRides, 
      icon: Navigation, 
      color: 'bg-info/10 text-info',
      description: 'Currently in progress'
    },
    { 
      label: 'Online Captains', 
      value: stats.onlineCaptains, 
      icon: Bike, 
      color: 'bg-success/10 text-success',
      description: `of ${stats.totalCaptains} total`
    },
    { 
      label: 'Total Riders', 
      value: stats.totalRiders.toLocaleString(), 
      icon: Users, 
      color: 'bg-primary/10 text-primary',
      description: 'Registered users'
    },
    { 
      label: "Today's Revenue", 
      value: `₹${stats.todayRevenue.toLocaleString()}`, 
      icon: IndianRupee, 
      color: 'bg-success/10 text-success',
      change: revenueChange,
      isUp: isRevenueUp,
      description: 'vs yesterday'
    },
  ];

  const mapMarkers = liveRides.map(ride => ({
    lat: ride.pickup_lat,
    lng: ride.pickup_lng,
    title: ride.status,
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning/10 text-warning border-warning/20';
      case 'matched': return 'bg-info/10 text-info border-info/20';
      case 'captain_arriving': return 'bg-primary/10 text-primary border-primary/20';
      case 'waiting_for_rider': return 'bg-warning/10 text-warning border-warning/20';
      case 'in_progress': return 'bg-success/10 text-success border-success/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Operations Dashboard</h1>
          <p className="text-muted-foreground">Real-time monitoring and analytics</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="w-4 h-4 text-success animate-pulse" />
          <span>Live updates active</span>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-bold">{stat.value}</p>
                    {stat.change !== undefined && (
                      <span className={`flex items-center text-xs font-medium ${stat.isUp ? 'text-success' : 'text-destructive'}`}>
                        {stat.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(Number(stat.change))}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-success/5 to-transparent border-success/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completedToday}</p>
              <p className="text-xs text-muted-foreground">Completed Today</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-destructive/5 to-transparent border-destructive/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.cancelledToday}</p>
              <p className="text-xs text-muted-foreground">Cancelled Today</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-warning/5 to-transparent border-warning/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pendingKYC}</p>
              <p className="text-xs text-muted-foreground">Pending KYC</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-destructive/5 to-transparent border-destructive/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.openIncidents}</p>
              <p className="text-xs text-muted-foreground">Open Incidents</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue & Rides Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Trends</CardTitle>
            <CardDescription>Rides and revenue over the past 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(152, 69%, 45%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(152, 69%, 45%)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRides" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(45, 100%, 51%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(45, 100%, 51%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="rides" 
                    stroke="hsl(45, 100%, 51%)" 
                    fillOpacity={1} 
                    fill="url(#colorRides)" 
                    name="Rides"
                  />
                  <Area 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(152, 69%, 45%)" 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                    name="Revenue (₹)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Hourly Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Ride Distribution</CardTitle>
            <CardDescription>Rides by hour of the day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="hour" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={10}
                    interval={2}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="rides" 
                    fill="hsl(45, 100%, 51%)" 
                    radius={[4, 4, 0, 0]}
                    name="Rides"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Rides by Vehicle Type</CardTitle>
            <CardDescription>Distribution of completed rides</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vehicleStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {vehicleStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {vehicleStats.map((stat) => (
                <div key={stat.name} className="text-center">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Live Map */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Live Rides Map
            </CardTitle>
            <CardDescription>{liveRides.length} active rides</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] rounded-lg overflow-hidden">
              <GoogleMapView
                center={{ lat: 12.9716, lng: 77.5946 }}
                zoom={11}
                markers={mapMarkers}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Rides List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Rides</CardTitle>
          <CardDescription>Real-time ride status updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[400px] overflow-auto">
            {liveRides.length === 0 ? (
              <div className="text-center py-12">
                <Navigation className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No active rides at the moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {liveRides.slice(0, 10).map((ride) => (
                  <div key={ride.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50 hover:border-primary/30 transition-colors">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`capitalize text-xs ${getStatusColor(ride.status)}`}>
                          {ride.status.replace(/_/g, ' ')}
                        </Badge>
                        <Badge variant="secondary" className="capitalize text-xs">
                          {ride.vehicle_type}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{ride.pickup_address}</p>
                      <p className="text-xs text-muted-foreground truncate">→ {ride.drop_address}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground ml-4">
                      {format(new Date(ride.requested_at), 'HH:mm')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOverview;
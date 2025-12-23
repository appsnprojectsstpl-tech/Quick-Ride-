import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, TrendingUp, Wallet, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';

interface CaptainEarningsProps {
  captain: any;
}

interface Transaction {
  id: string;
  amount: number;
  transaction_type: string;
  description: string;
  created_at: string;
  ride_id: string | null;
}

const CaptainEarnings = ({ captain }: CaptainEarningsProps) => {
  const [period, setPeriod] = useState('today');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState({ earnings: 0, rides: 0, hours: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (captain?.id) {
      fetchEarnings();
    }
  }, [captain?.id, period]);

  const fetchEarnings = async () => {
    setIsLoading(true);
    
    let startDate: Date;
    let endDate = new Date();

    switch (period) {
      case 'today':
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
        endDate = endOfWeek(new Date(), { weekStartsOn: 1 });
        break;
      case 'month':
        startDate = startOfMonth(new Date());
        endDate = endOfMonth(new Date());
        break;
      default:
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
    }

    // Fetch transactions
    const { data: txns } = await supabase
      .from('captain_transactions')
      .select('*')
      .eq('captain_id', captain.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    setTransactions(txns || []);

    // Calculate stats
    const earnings = (txns || [])
      .filter((t) => t.transaction_type === 'ride_earning')
      .reduce((sum, t) => sum + t.amount, 0);

    const ridesCount = (txns || []).filter((t) => t.transaction_type === 'ride_earning').length;

    setStats({
      earnings,
      rides: ridesCount,
      hours: Math.round(ridesCount * 0.5), // Rough estimate
    });

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="mobile-header">
        <Button variant="ghost" size="icon" onClick={() => navigate('/captain')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-display font-bold text-lg">Earnings</h1>
        <div className="w-10" />
      </header>

      {/* Period Tabs */}
      <div className="px-4 pt-4">
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Cards */}
      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm opacity-80">Total Earnings</span>
            <Wallet className="w-6 h-6" />
          </div>
          <p className="text-4xl font-bold mb-1">₹{stats.earnings}</p>
          <div className="flex items-center gap-1 text-sm opacity-80">
            <TrendingUp className="w-4 h-4" />
            <span>{stats.rides} rides completed</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Rides</p>
            <p className="text-2xl font-bold">{stats.rides}</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-sm text-muted-foreground mb-1">Hours Online</p>
            <p className="text-2xl font-bold">{stats.hours}h</p>
          </div>
        </div>
      </div>

      {/* Wallet Balance */}
      <div className="px-4 mb-4">
        <div className="bg-muted/50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Wallet Balance</p>
            <p className="text-xl font-bold">₹{captain?.wallet_balance || 0}</p>
          </div>
          <Button variant="outline" size="sm">
            Withdraw
          </Button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="px-4">
        <h3 className="font-semibold mb-3">Transaction History</h3>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transactions for this period
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((txn) => (
              <div key={txn.id} className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium capitalize">
                    {txn.transaction_type.replace('_', ' ')}
                  </p>
                  <p className={`font-bold ${txn.amount > 0 ? 'text-success' : 'text-destructive'}`}>
                    {txn.amount > 0 ? '+' : ''}₹{Math.abs(txn.amount)}
                  </p>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <p>{txn.description || 'Ride earning'}</p>
                  <p>{format(new Date(txn.created_at), 'MMM d, h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaptainEarnings;

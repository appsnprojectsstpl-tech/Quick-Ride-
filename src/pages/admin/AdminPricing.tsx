import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, IndianRupee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PricingConfig {
  id: string;
  city: string;
  vehicle_type: string;
  base_fare: number;
  per_km_rate: number;
  per_min_rate: number;
  min_fare: number;
  max_surge_multiplier: number;
  is_active: boolean;
}

const AdminPricing = () => {
  const [configs, setConfigs] = useState<PricingConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PricingConfig | null>(null);
  const [formData, setFormData] = useState({
    city: '',
    vehicle_type: 'bike',
    base_fare: 0,
    per_km_rate: 0,
    per_min_rate: 0,
    min_fare: 0,
    max_surge_multiplier: 3,
    is_active: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    const { data, error } = await supabase
      .from('pricing_config')
      .select('*')
      .order('city', { ascending: true });

    if (!error) {
      setConfigs(data || []);
    }
    setIsLoading(false);
  };

  const handleOpenDialog = (config?: PricingConfig) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        city: config.city,
        vehicle_type: config.vehicle_type,
        base_fare: config.base_fare,
        per_km_rate: config.per_km_rate,
        per_min_rate: config.per_min_rate,
        min_fare: config.min_fare,
        max_surge_multiplier: config.max_surge_multiplier,
        is_active: config.is_active,
      });
    } else {
      setEditingConfig(null);
      setFormData({
        city: '',
        vehicle_type: 'bike',
        base_fare: 15,
        per_km_rate: 8,
        per_min_rate: 1,
        min_fare: 25,
        max_surge_multiplier: 3,
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const dataToSave = {
        ...formData,
        vehicle_type: formData.vehicle_type as 'bike' | 'auto' | 'cab',
      };
      
      if (editingConfig) {
        const { error } = await supabase
          .from('pricing_config')
          .update(dataToSave)
          .eq('id', editingConfig.id);

        if (error) throw error;
        toast({ title: 'Pricing updated' });
      } else {
        const { error } = await supabase
          .from('pricing_config')
          .insert(dataToSave);

        if (error) throw error;
        toast({ title: 'Pricing created' });
      }

      setIsDialogOpen(false);
      fetchConfigs();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pricing_config')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Pricing deleted' });
      fetchConfigs();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const vehicleTypes = ['bike', 'auto', 'cab'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Pricing Configuration</h1>
          <p className="text-muted-foreground">Manage fare rates by city and vehicle type</p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Add Pricing
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>City</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Base Fare</TableHead>
                <TableHead>Per Km</TableHead>
                <TableHead>Per Min</TableHead>
                <TableHead>Min Fare</TableHead>
                <TableHead>Max Surge</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : configs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No pricing configurations found
                  </TableCell>
                </TableRow>
              ) : (
                configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="capitalize">{config.city}</TableCell>
                    <TableCell className="capitalize">{config.vehicle_type}</TableCell>
                    <TableCell>₹{config.base_fare}</TableCell>
                    <TableCell>₹{config.per_km_rate}</TableCell>
                    <TableCell>₹{config.per_min_rate}</TableCell>
                    <TableCell>₹{config.min_fare}</TableCell>
                    <TableCell>{config.max_surge_multiplier}x</TableCell>
                    <TableCell>
                      <Badge className={config.is_active ? 'bg-success/10 text-success' : 'bg-muted'}>
                        {config.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(config)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(config.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConfig ? 'Edit Pricing' : 'Add Pricing'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value.toLowerCase() })}
                  placeholder="e.g., bangalore"
                />
              </div>
              <div>
                <Label>Vehicle Type</Label>
                <Select
                  value={formData.vehicle_type}
                  onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleTypes.map((type) => (
                      <SelectItem key={type} value={type} className="capitalize">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Base Fare (₹)</Label>
                <Input
                  type="number"
                  value={formData.base_fare}
                  onChange={(e) => setFormData({ ...formData, base_fare: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Per Km Rate (₹)</Label>
                <Input
                  type="number"
                  value={formData.per_km_rate}
                  onChange={(e) => setFormData({ ...formData, per_km_rate: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Per Minute Rate (₹)</Label>
                <Input
                  type="number"
                  value={formData.per_min_rate}
                  onChange={(e) => setFormData({ ...formData, per_min_rate: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Minimum Fare (₹)</Label>
                <Input
                  type="number"
                  value={formData.min_fare}
                  onChange={(e) => setFormData({ ...formData, min_fare: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Max Surge Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.max_surge_multiplier}
                  onChange={(e) => setFormData({ ...formData, max_surge_multiplier: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPricing;

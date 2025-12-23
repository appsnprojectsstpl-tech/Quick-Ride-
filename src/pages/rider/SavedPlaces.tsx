import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, MapPin, Home, Briefcase, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface SavedLocation {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
}

const labelIcons: Record<string, any> = {
  Home: Home,
  Work: Briefcase,
  Favorite: Star,
};

const SavedPlaces = () => {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    fetchLocations();
  }, [user]);

  const fetchLocations = async () => {
    const { data, error } = await supabase
      .from('saved_locations')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setLocations(data);
    }
    setIsLoading(false);
  };

  const handleAddLocation = async () => {
    if (!newLabel || !newAddress) {
      toast({ variant: 'destructive', title: 'Please fill in all required fields' });
      return;
    }

    setIsSaving(true);
    
    // For demo, using default coordinates - in production would use geocoding
    const { error } = await supabase.from('saved_locations').insert({
      user_id: user!.id,
      label: newLabel,
      address: newAddress,
      lat: 12.9716 + Math.random() * 0.1,
      lng: 77.5946 + Math.random() * 0.1,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to add location', description: error.message });
    } else {
      toast({ title: 'Location saved!' });
      setNewLabel('');
      setNewAddress('');
      setIsDialogOpen(false);
      fetchLocations();
    }
    setIsSaving(false);
  };

  const handleDeleteLocation = async (id: string) => {
    const { error } = await supabase.from('saved_locations').delete().eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to delete location' });
    } else {
      toast({ title: 'Location removed' });
      fetchLocations();
    }
  };

  const getLabelIcon = (label: string) => {
    const Icon = labelIcons[label] || MapPin;
    return Icon;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="mobile-header">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-display font-bold text-lg">Saved Places</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Plus className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Saved Place</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="label">Label *</Label>
                <div className="flex gap-2 mt-2">
                  {['Home', 'Work', 'Favorite'].map((label) => (
                    <Button
                      key={label}
                      variant={newLabel === label ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setNewLabel(label)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <Input
                  id="label"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Or enter custom label"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Enter full address"
                />
              </div>
              <Button onClick={handleAddLocation} disabled={isSaving} className="w-full">
                {isSaving ? 'Saving...' : 'Save Place'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Locations List */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse">
                <div className="h-4 bg-muted rounded w-1/4 mb-2" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No saved places yet</p>
            <Button onClick={() => setIsDialogOpen(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Add Place
            </Button>
          </div>
        ) : (
          locations.map((location) => {
            const Icon = getLabelIcon(location.label);
            return (
              <div
                key={location.id}
                className="bg-card rounded-xl p-4 border border-border flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{location.label}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {location.address}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteLocation(location.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SavedPlaces;

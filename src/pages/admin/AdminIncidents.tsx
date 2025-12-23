import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Incident {
  id: string;
  incident_type: string;
  status: string;
  description: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  ride_id: string | null;
  reported_by: string | null;
  reporter?: {
    name: string;
    phone: string;
  };
}

const incidentTypeLabels: Record<string, string> = {
  sos: 'SOS Emergency',
  complaint: 'Complaint',
  dispute: 'Dispute',
  safety_concern: 'Safety Concern',
};

const statusColors: Record<string, string> = {
  open: 'bg-destructive/10 text-destructive',
  investigating: 'bg-warning/10 text-warning',
  resolved: 'bg-success/10 text-success',
  closed: 'bg-muted text-muted-foreground',
};

const AdminIncidents = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState('open');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchIncidents();
  }, [filter]);

  const fetchIncidents = async () => {
    setIsLoading(true);

    let query = supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter as any);
    }

    const { data, error } = await query;

    if (!error && data) {
      // Fetch reporter profiles
      const reporterIds = [...new Set(data.map((i) => i.reported_by).filter(Boolean))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, phone')
        .in('user_id', reporterIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      const incidentsWithReporters = data.map((incident) => ({
        ...incident,
        reporter: incident.reported_by ? profileMap.get(incident.reported_by) : null,
      }));

      setIncidents(incidentsWithReporters);
    }

    setIsLoading(false);
  };

  const handleUpdateStatus = async () => {
    if (!selectedIncident || !newStatus) return;

    try {
      const updates: any = {
        status: newStatus,
        resolution_notes: resolutionNotes || null,
      };

      if (newStatus === 'resolved' || newStatus === 'closed') {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('incidents')
        .update(updates)
        .eq('id', selectedIncident.id);

      if (error) throw error;

      toast({ title: 'Incident updated' });
      setSelectedIncident(null);
      setResolutionNotes('');
      setNewStatus('');
      fetchIncidents();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const openIncident = (incident: Incident) => {
    setSelectedIncident(incident);
    setNewStatus(incident.status);
    setResolutionNotes(incident.resolution_notes || '');
  };

  const stats = {
    open: incidents.filter((i) => i.status === 'open').length,
    investigating: incidents.filter((i) => i.status === 'investigating').length,
    resolved: incidents.filter((i) => i.status === 'resolved').length,
    sos: incidents.filter((i) => i.incident_type === 'sos' && i.status === 'open').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold">Incidents</h1>
        <p className="text-muted-foreground">Manage safety incidents and complaints</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-destructive/50">
          <CardContent className="p-4 flex items-center gap-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold text-destructive">{stats.sos}</p>
              <p className="text-xs text-muted-foreground">Active SOS</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Clock className="w-8 h-8 text-warning" />
            <div>
              <p className="text-2xl font-bold">{stats.open}</p>
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <MessageSquare className="w-8 h-8 text-info" />
            <div>
              <p className="text-2xl font-bold">{stats.investigating}</p>
              <p className="text-xs text-muted-foreground">Investigating</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <CheckCircle className="w-8 h-8 text-success" />
            <div>
              <p className="text-2xl font-bold">{stats.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="investigating">Investigating</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Incidents List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : incidents.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No incidents found
            </CardContent>
          </Card>
        ) : (
          incidents.map((incident) => (
            <Card
              key={incident.id}
              className={`cursor-pointer hover:border-primary transition-colors ${
                incident.incident_type === 'sos' && incident.status === 'open'
                  ? 'border-destructive bg-destructive/5'
                  : ''
              }`}
              onClick={() => openIncident(incident)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      incident.incident_type === 'sos' ? 'bg-destructive/10' : 'bg-muted'
                    }`}>
                      <AlertTriangle className={`w-5 h-5 ${
                        incident.incident_type === 'sos' ? 'text-destructive' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold">
                          {incidentTypeLabels[incident.incident_type] || incident.incident_type}
                        </p>
                        <Badge className={statusColors[incident.status]}>
                          {incident.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {incident.description || 'No description provided'}
                      </p>
                      {incident.reporter && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Reported by: {incident.reporter.name} ({incident.reporter.phone})
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(incident.created_at), 'MMM d, h:mm a')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Incident Detail Dialog */}
      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Incident Details</DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">
                    {incidentTypeLabels[selectedIncident.incident_type]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reported</p>
                  <p>{format(new Date(selectedIncident.created_at), 'PPpp')}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p>{selectedIncident.description || 'No description'}</p>
              </div>

              {selectedIncident.reporter && (
                <div>
                  <p className="text-sm text-muted-foreground">Reporter</p>
                  <p>{selectedIncident.reporter.name} - {selectedIncident.reporter.phone}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">Update Status</p>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Resolution Notes</p>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add notes about the resolution..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedIncident(null)}>Cancel</Button>
            <Button onClick={handleUpdateStatus}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminIncidents;

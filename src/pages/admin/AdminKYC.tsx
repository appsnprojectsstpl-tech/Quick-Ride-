import { useState, useEffect } from 'react';
import { FileCheck, CheckCircle, XCircle, Eye, User, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Document {
  id: string;
  captain_id: string;
  document_type: string;
  document_url: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  captain?: {
    id: string;
    user_id: string;
    profiles?: {
      name: string;
      phone: string;
    };
  };
}

const documentLabels: Record<string, string> = {
  driving_license: 'Driving License',
  vehicle_rc: 'Vehicle RC',
  insurance: 'Insurance',
  id_proof: 'ID Proof',
  selfie: 'Selfie',
};

const AdminKYC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filter, setFilter] = useState('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDocuments();
  }, [filter]);

  const fetchDocuments = async () => {
    setIsLoading(true);

    let query = supabase
      .from('captain_documents')
      .select(`
        *,
        captain:captains (
          id,
          user_id
        )
      `)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter as any);
    }

    const { data, error } = await query;

    if (!error && data) {
      // Fetch captain profiles
      const captainUserIds = [...new Set(data.map((d: any) => d.captain?.user_id).filter(Boolean))];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, phone')
        .in('user_id', captainUserIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      const docsWithProfiles = data.map((doc: any) => ({
        ...doc,
        captain: {
          ...doc.captain,
          profiles: doc.captain?.user_id ? profileMap.get(doc.captain.user_id) : null,
        },
      }));

      setDocuments(docsWithProfiles);
    }

    setIsLoading(false);
  };

  const handleApprove = async (doc: Document) => {
    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from('captain_documents')
        .update({
          status: 'approved',
          verified_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (error) throw error;

      // Check if all documents are approved for this captain
      const { data: allDocs } = await supabase
        .from('captain_documents')
        .select('status')
        .eq('captain_id', doc.captain_id);

      const allApproved = (allDocs || []).every(d => d.status === 'approved');

      if (allApproved && allDocs && allDocs.length >= 5) {
        await supabase
          .from('captains')
          .update({ is_verified: true, kyc_status: 'approved' })
          .eq('id', doc.captain_id);
      }

      toast({ title: 'Document approved successfully' });
      fetchDocuments();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsProcessing(false);
      setSelectedDoc(null);
    }
  };

  const handleReject = async () => {
    if (!selectedDoc || !rejectReason.trim()) {
      toast({ variant: 'destructive', title: 'Please provide a rejection reason' });
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from('captain_documents')
        .update({
          status: 'rejected',
          rejection_reason: rejectReason,
        })
        .eq('id', selectedDoc.id);

      if (error) throw error;

      await supabase
        .from('captains')
        .update({ kyc_status: 'rejected' })
        .eq('id', selectedDoc.captain_id);

      toast({ title: 'Document rejected' });
      fetchDocuments();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsProcessing(false);
      setSelectedDoc(null);
      setRejectReason('');
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-warning/10 text-warning',
      under_review: 'bg-info/10 text-info',
      approved: 'bg-success/10 text-success',
      rejected: 'bg-destructive/10 text-destructive',
    };
    return <Badge className={styles[status] || 'bg-muted'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold">KYC Verification</h1>
        <p className="text-muted-foreground">Review and verify captain documents</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {['pending', 'under_review', 'approved', 'rejected'].map((status) => (
          <Card key={status} className="cursor-pointer hover:border-primary transition-colors" onClick={() => setFilter(status)}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground capitalize">{status.replace('_', ' ')}</p>
              <p className="text-2xl font-bold">
                {documents.filter(d => d.status === status).length}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="under_review">Under Review</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Documents List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No documents found
            </div>
          ) : (
            <div className="divide-y divide-border">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{doc.captain?.profiles?.name || 'Unknown Captain'}</p>
                      <p className="text-sm text-muted-foreground">
                        {documentLabels[doc.document_type] || doc.document_type}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(doc.created_at), 'MMM d, yyyy')}
                    </p>
                    {statusBadge(doc.status)}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(doc.document_url, '_blank')}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>

                      {doc.status === 'pending' && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(doc)}
                            disabled={isProcessing}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setSelectedDoc(doc)}
                            disabled={isProcessing}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Please provide a reason for rejection. This will be shown to the captain.
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Document is blurry, expired, or doesn't match the name"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDoc(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={isProcessing}>
              Reject Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminKYC;

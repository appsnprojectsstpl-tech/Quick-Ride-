import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DocumentUploadCard from '@/components/captain/DocumentUploadCard';

const requiredDocuments = [
  { type: 'driving_license', label: 'Driving License', description: 'Upload front and back of your DL' },
  { type: 'vehicle_rc', label: 'Vehicle RC', description: 'Registration Certificate of your vehicle' },
  { type: 'insurance', label: 'Vehicle Insurance', description: 'Valid insurance document' },
  { type: 'id_proof', label: 'ID Proof', description: 'Aadhaar or PAN card' },
  { type: 'selfie', label: 'Live Selfie', description: 'A clear photo of yourself' },
];

const CaptainKYC = () => {
  const [captain, setCaptain] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchData = async () => {
    if (!user) return;

    const { data: captainData } = await supabase
      .from('captains')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (captainData) {
      setCaptain(captainData);

      const { data: docs } = await supabase
        .from('captain_documents')
        .select('*')
        .eq('captain_id', captainData.id);

      setDocuments(docs || []);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const getDocumentByType = (type: string) => {
    return documents.find((d) => d.document_type === type);
  };

  const approvedCount = documents.filter((d) => d.status === 'approved').length;
  const progress = (approvedCount / requiredDocuments.length) * 100;

  const allApproved = approvedCount === requiredDocuments.length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="mobile-header">
        <Button variant="ghost" size="icon" onClick={() => navigate('/captain')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="font-display font-bold text-lg">Verification</h1>
        <div className="w-10" />
      </header>

      <div className="p-4 space-y-6">
        {/* Status Card */}
        <div className={`rounded-xl p-4 ${
          allApproved 
            ? 'bg-success/10 border border-success/30' 
            : captain?.kyc_status === 'rejected'
            ? 'bg-destructive/10 border border-destructive/30'
            : 'bg-warning/10 border border-warning/30'
        }`}>
          <div className="flex items-center gap-3 mb-3">
            {allApproved ? (
              <CheckCircle className="w-6 h-6 text-success" />
            ) : captain?.kyc_status === 'rejected' ? (
              <AlertCircle className="w-6 h-6 text-destructive" />
            ) : (
              <Clock className="w-6 h-6 text-warning" />
            )}
            <div>
              <h2 className="font-semibold">
                {allApproved 
                  ? 'Verification Complete!' 
                  : captain?.kyc_status === 'rejected'
                  ? 'Verification Failed'
                  : 'Verification in Progress'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {allApproved 
                  ? 'You can now start accepting rides' 
                  : `${approvedCount} of ${requiredDocuments.length} documents verified`}
              </p>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Documents */}
        <div className="space-y-4">
          <h3 className="font-semibold">Required Documents</h3>
          {requiredDocuments.map((doc) => (
            <DocumentUploadCard
              key={doc.type}
              captainId={captain?.id}
              userId={user?.id || ''}
              documentType={doc.type}
              label={doc.label}
              description={doc.description}
              existingDocument={getDocumentByType(doc.type)}
              onUploadComplete={fetchData}
            />
          ))}
        </div>

        {allApproved && (
          <Button onClick={() => navigate('/captain')} className="w-full">
            Start Accepting Rides
          </Button>
        )}
      </div>
    </div>
  );
};

export default CaptainKYC;

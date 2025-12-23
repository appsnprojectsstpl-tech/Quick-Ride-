import { useState, useRef } from 'react';
import { Upload, FileText, Camera, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DocumentUploadCardProps {
  captainId: string;
  userId: string;
  documentType: string;
  label: string;
  description: string;
  existingDocument?: {
    id: string;
    document_url: string;
    status: string;
    rejection_reason?: string;
  };
  onUploadComplete: () => void;
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-warning', bg: 'bg-warning/10', label: 'Pending Review' },
  under_review: { icon: Clock, color: 'text-info', bg: 'bg-info/10', label: 'Under Review' },
  approved: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Rejected' },
};

const DocumentUploadCard = ({
  captainId,
  userId,
  documentType,
  label,
  description,
  existingDocument,
  onUploadComplete,
}: DocumentUploadCardProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const status = existingDocument?.status as keyof typeof statusConfig;
  const config = status ? statusConfig[status] : null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Please upload a file smaller than 5MB.',
      });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload a JPG, PNG, WebP, or PDF file.',
      });
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${documentType}_${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('captain-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('captain-documents')
        .getPublicUrl(fileName);

      // Create or update document record
      if (existingDocument) {
        await supabase
          .from('captain_documents')
          .update({
            document_url: publicUrl,
            status: 'pending',
            rejection_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingDocument.id);
      } else {
        await supabase
          .from('captain_documents')
          .insert({
            captain_id: captainId,
            document_type: documentType,
            document_url: publicUrl,
            status: 'pending',
          });
      }

      toast({
        title: 'Document uploaded',
        description: 'Your document has been submitted for verification.',
      });

      onUploadComplete();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold">{label}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {config && (
          <div className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-xs', config.bg, config.color)}>
            <config.icon className="w-3 h-3" />
            {config.label}
          </div>
        )}
      </div>

      {existingDocument?.status === 'rejected' && existingDocument.rejection_reason && (
        <div className="mb-3 p-2 bg-destructive/10 border border-destructive/30 rounded-lg">
          <p className="text-xs text-destructive">
            <strong>Reason:</strong> {existingDocument.rejection_reason}
          </p>
        </div>
      )}

      {existingDocument?.document_url && status !== 'rejected' && (
        <div className="mb-3">
          <a
            href={existingDocument.document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <FileText className="w-4 h-4" />
            View uploaded document
          </a>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {(!existingDocument || status === 'rejected') && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              {existingDocument ? 'Re-upload Document' : 'Upload Document'}
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default DocumentUploadCard;

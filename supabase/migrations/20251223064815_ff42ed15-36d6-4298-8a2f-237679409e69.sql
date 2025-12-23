-- Create storage bucket for captain documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('captain-documents', 'captain-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for captain documents bucket
CREATE POLICY "Captains can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'captain-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Captains can view their own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'captain-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all captain documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'captain-documents'
  AND public.has_role(auth.uid(), 'admin')
);
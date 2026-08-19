-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies just in case to prevent errors
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;

-- Allow public uploads for testing
CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'kyc-documents' );

-- Allow public reads for testing
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
USING ( bucket_id = 'kyc-documents' );

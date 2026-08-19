import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

async function createBucket() {
  const sql = postgres(process.env.DIRECT_URL as string);

  try {
    console.log('Creating kyc-documents bucket...');
    await sql`
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('kyc-documents', 'kyc-documents', true)
      ON CONFLICT (id) DO NOTHING;
    `;

    console.log('Dropping old policies (if any)...');
    await sql`DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;`;
    await sql`DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;`;

    console.log('Creating new policies...');
    await sql`
      CREATE POLICY "Allow public uploads"
      ON storage.objects FOR INSERT
      WITH CHECK ( bucket_id = 'kyc-documents' );
    `;
    
    await sql`
      CREATE POLICY "Allow public reads"
      ON storage.objects FOR SELECT
      USING ( bucket_id = 'kyc-documents' );
    `;

    console.log('✅ Bucket kyc-documents and policies created successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await sql.end();
  }
}

createBucket();

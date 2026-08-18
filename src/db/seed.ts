import { db } from './index';
import { users } from './schema';

async function seed() {
  console.log('Seeding minimal data...');
  
  // Seed a dummy admin user for database verification purposes.
  // Note: In a real environment, this user would first be created in Supabase Auth.
  const adminId = '00000000-0000-0000-0000-000000000000';
  
  await db.insert(users).values({
    id: adminId,
    email: 'admin@ezfinanz.dev',
    phone: '+919999999999',
    role: 'ADMIN',
  }).onConflictDoNothing();
  
  console.log('Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed', err);
  process.exit(1);
});

import { db } from '../src/db/index';
import { users, applications, bankDetails, declarations, selfieVerifications, auditLogs } from '../src/db/schema';
import { inArray } from 'drizzle-orm';
import crypto from 'crypto';

const createdUserIds: string[] = [];

export async function clearDatabase() {
  if (createdUserIds.length === 0) return;
  const apps = await db.select({ id: applications.id }).from(applications).where(inArray(applications.userId, createdUserIds));
  const appIds = apps.map(a => a.id);
  
  if (appIds.length > 0) {
    await db.delete(bankDetails).where(inArray(bankDetails.applicationId, appIds));
    await db.delete(declarations).where(inArray(declarations.applicationId, appIds));
    await db.delete(selfieVerifications).where(inArray(selfieVerifications.applicationId, appIds));
    await db.delete(auditLogs).where(inArray(auditLogs.applicationId, appIds));
    await db.delete(applications).where(inArray(applications.userId, createdUserIds));
  }
  
  await db.delete(users).where(inArray(users.id, createdUserIds));
}

export async function getTestUser() {
  const testUserId = crypto.randomUUID();
  const [user] = await db.insert(users).values({
    id: testUserId,
    email: `test-${testUserId}@ezfinanz.test`,
    role: 'CUSTOMER',
  }).returning();
  
  createdUserIds.push(testUserId);
  return user;
}

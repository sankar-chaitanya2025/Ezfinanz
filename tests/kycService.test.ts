import { describe, it, expect, afterAll } from 'vitest';
import { KycService } from '../src/services/kycService';
import { ApplicationService } from '../src/services/applicationService';
import { db } from '../src/db/index';
import { users, applications, kycDetails, auditLogs } from '../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { hashIdNumber, maskIdNumber } from '../src/lib/pii';

dotenv.config({ path: '.env' });

const createdUserIds: string[] = [];

async function setupUser() {
  const testUserId = crypto.randomUUID();
  await db.insert(users).values({
    id: testUserId,
    email: `test-kyc-${testUserId}@ezfinanz.test`,
    role: 'CUSTOMER',
  });
  createdUserIds.push(testUserId);
  return testUserId;
}

describe('PII Masking and Hashing', () => {
  it('should hash ID properly', () => {
    const raw = '  ABCDE1234F  ';
    const hash = hashIdNumber(raw);
    expect(hash).not.toContain('ABCDE1234F');
    expect(hash.length).toBe(64); // SHA-256 hex
  });

  it('should mask Aadhar properly', () => {
    expect(maskIdNumber('123456789012', 'AADHAR')).toBe('XXXXXXXX9012');
  });

  it('should mask PAN properly', () => {
    expect(maskIdNumber('ABCDE1234F', 'PAN')).toBe('ABXXXXXX4F');
  });
});

describe('KycService', () => {
  afterAll(async () => {
    if (createdUserIds.length === 0) return;
    const apps = await db.select({ id: applications.id }).from(applications).where(inArray(applications.userId, createdUserIds));
    const appIds = apps.map(a => a.id);
    
    if (appIds.length > 0) {
      await db.delete(kycDetails).where(inArray(kycDetails.applicationId, appIds));
      await db.delete(auditLogs).where(inArray(auditLogs.applicationId, appIds));
    }
    
    // Attempting to delete loans in case another test created one
    const { loans } = await import('../src/db/schema');
    await db.delete(loans).where(inArray(loans.userId, createdUserIds));
    
    await db.delete(applications).where(inArray(applications.userId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  });

  it('should successfully verify a valid ID and transition state', async () => {
    const userId = await setupUser();
    const app = await ApplicationService.createApplication(userId);
    
    const result = await KycService.submitKyc(app.id, userId, 'PAN', 'VALID1234P');
    expect(result.status).toBe('VERIFIED');

    // Check DB
    const [kyc] = await db.select().from(kycDetails).where(eq(kycDetails.applicationId, app.id));
    expect(kyc).toBeDefined();
    expect(kyc.verificationStatus).toBe('VERIFIED');
    expect(kyc.idNumberMasked).toBe('VAXXXXXX4P');
    expect(kyc.idNumberHash).toBe(hashIdNumber('VALID1234P'));

    // Check Application State
    const [updatedApp] = await db.select().from(applications).where(eq(applications.id, app.id));
    expect(updatedApp.status).toBe('KYC_COMPLETED');
  }, 10000);

  it('should handle KYC failure, stay in KYC_PENDING, and allow retry', async () => {
    const userId = await setupUser();
    const app = await ApplicationService.createApplication(userId);
    
    // First attempt fails
    const result = await KycService.submitKyc(app.id, userId, 'AADHAR', 'FAIL12345678');
    expect(result.status).toBe('FAILED');

    // Check DB
    let [kyc] = await db.select().from(kycDetails).where(eq(kycDetails.applicationId, app.id));
    expect(kyc.verificationStatus).toBe('FAILED');

    // State should be KYC_PENDING
    let [updatedApp] = await db.select().from(applications).where(eq(applications.id, app.id));
    expect(updatedApp.status).toBe('KYC_PENDING');

    // Second attempt succeeds
    const retryResult = await KycService.submitKyc(app.id, userId, 'AADHAR', '987654321098');
    expect(retryResult.status).toBe('VERIFIED');

    kyc = (await db.select().from(kycDetails).where(eq(kycDetails.applicationId, app.id)))[0];
    expect(kyc.verificationStatus).toBe('VERIFIED'); // Row was upserted

    updatedApp = (await db.select().from(applications).where(eq(applications.id, app.id)))[0];
    expect(updatedApp.status).toBe('KYC_COMPLETED');
  }, 15000);

  it('should block unauthorized users from submitting KYC', async () => {
    const userId = await setupUser();
    const otherUserId = await setupUser();
    const app = await ApplicationService.createApplication(userId);
    
    await expect(KycService.submitKyc(app.id, otherUserId, 'PAN', 'VALID1234P'))
      .rejects.toThrow('Application not found or unauthorized');
  });

  it('should block cross-account identity duplication but allow same user reuse', async () => {
    const userA = await setupUser();
    const userB = await setupUser();
    
    // User A uses a specific ID
    const appA = await ApplicationService.createApplication(userA);
    await KycService.submitKyc(appA.id, userA, 'AADHAR', '111122223333');
    
    // User B tries to use the same ID -> blocked
    const appB = await ApplicationService.createApplication(userB);
    await expect(KycService.submitKyc(appB.id, userB, 'AADHAR', '111122223333'))
      .rejects.toThrow('Identity already verified by another user account');

    // User A creates a second application (e.g. after the first one is closed/rejected)
    // Manually reject the first one so User A can create a new app
    await ApplicationService.transitionState(appA.id, 'FINANCIALS_COMPLETED', userA);
    await ApplicationService.transitionState(appA.id, 'ELIGIBILITY_PENDING', userA);
    await ApplicationService.transitionState(appA.id, 'ELIGIBLE', userA);
    await ApplicationService.transitionState(appA.id, 'TERMS_SELECTED', userA);
    await ApplicationService.transitionState(appA.id, 'BANK_VERIFIED', userA);
    await ApplicationService.transitionState(appA.id, 'DECLARATION_ACCEPTED', userA);
    await ApplicationService.transitionState(appA.id, 'SELFIE_PENDING', userA);
    await ApplicationService.transitionState(appA.id, 'SUBMITTED', userA);
    await ApplicationService.transitionState(appA.id, 'UNDER_REVIEW', userA);
    await ApplicationService.transitionState(appA.id, 'REJECTED', userA);

    // User A creates a new app
    const appA2 = await ApplicationService.createApplication(userA);
    
    // User A should be able to use their own ID again
    const reuseResult = await KycService.submitKyc(appA2.id, userA, 'AADHAR', '111122223333');
    expect(reuseResult.status).toBe('VERIFIED');
  }, 60000);
});

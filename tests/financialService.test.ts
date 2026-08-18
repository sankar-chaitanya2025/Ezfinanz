import { describe, it, expect, afterAll } from 'vitest';
import { FinancialService } from '../src/services/financialService';
import { KycService } from '../src/services/kycService';
import { ApplicationService } from '../src/services/applicationService';
import { db } from '../src/db/index';
import { users, applications, kycDetails, auditLogs, financialDetails, externalCreditObligations, loans } from '../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const createdUserIds: string[] = [];

async function setupUser() {
  const testUserId = crypto.randomUUID();
  await db.insert(users).values({
    id: testUserId,
    email: `test-fin-${testUserId}@ezfinanz.test`,
    role: 'CUSTOMER',
  });
  createdUserIds.push(testUserId);
  return testUserId;
}

describe('FinancialService', () => {
  afterAll(async () => {
    if (createdUserIds.length === 0) return;
    const apps = await db.select({ id: applications.id }).from(applications).where(inArray(applications.userId, createdUserIds));
    const appIds = apps.map(a => a.id);
    
    if (appIds.length > 0) {
      await db.delete(financialDetails).where(inArray(financialDetails.applicationId, appIds));
      await db.delete(kycDetails).where(inArray(kycDetails.applicationId, appIds));
      await db.delete(auditLogs).where(inArray(auditLogs.applicationId, appIds));
    }
    
    await db.delete(externalCreditObligations).where(inArray(externalCreditObligations.userId, createdUserIds));
    await db.delete(loans).where(inArray(loans.userId, createdUserIds));
    await db.delete(applications).where(inArray(applications.userId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  });

  it('should successfully submit financials for a KYC_COMPLETED app', async () => {
    const userId = await setupUser();
    const app = await ApplicationService.createApplication(userId);
    await KycService.submitKyc(app.id, userId, 'PAN', 'ID0'); // Hash starts with 7 -> good score
    
    const result = await FinancialService.submitFinancials(app.id, userId, {
      employmentType: 'SALARIED',
      employerName: 'Tech Corp',
      designation: 'Engineer',
      monthlyIncome: 80000
    });

    expect(result.status).toBe('FINANCIALS_COMPLETED');

    // Check financial snapshot
    const [fin] = await db.select().from(financialDetails).where(eq(financialDetails.applicationId, app.id));
    expect(fin).toBeDefined();
    expect(fin.creditScore).toBe(780);
    // Good score mock has 1 CLOSED loan, so existingEmi should be 0
    expect(parseFloat(fin.existingEmiObligations)).toBe(0);

    // Check external obligations wiped and replaced
    const obs = await db.select().from(externalCreditObligations).where(eq(externalCreditObligations.userId, userId));
    expect(obs.length).toBe(1);
    expect(obs[0].status).toBe('CLOSED');
  }, 40000);

  it('should aggregate only ACTIVE/DEFAULTED EMI', async () => {
    const userId = await setupUser();
    const app = await ApplicationService.createApplication(userId);
    await KycService.submitKyc(app.id, userId, 'PAN', 'ID11'); // Hash starts with a -> active loans mock
    
    await FinancialService.submitFinancials(app.id, userId, {
      employmentType: 'SELF_EMPLOYED',
      employerName: 'Self',
      designation: 'Owner',
      monthlyIncome: 90000
    });

    const [fin] = await db.select().from(financialDetails).where(eq(financialDetails.applicationId, app.id));
    // Mock "A" has 2 active loans: EMI 12000 and 2000
    expect(parseFloat(fin.existingEmiObligations)).toBe(14000);

    const obs = await db.select().from(externalCreditObligations).where(eq(externalCreditObligations.userId, userId));
    expect(obs.length).toBe(2);
  }, 20000);

  it('should correctly handle NOT_ELIGIBLE -> FINANCIALS_COMPLETED correction loop', async () => {
    const userId = await setupUser();
    const app = await ApplicationService.createApplication(userId);
    await KycService.submitKyc(app.id, userId, 'PAN', 'TEST2_NEW'); // Use different ID to bypass stale test data
    
    await FinancialService.submitFinancials(app.id, userId, {
      employmentType: 'SALARIED',
      employerName: 'Tech Corp',
      designation: 'Engineer',
      monthlyIncome: 1000 // Very low income
    });

    // Manually push to NOT_ELIGIBLE (since EligibilityEngine is Phase 6)
    await ApplicationService.transitionState(app.id, 'ELIGIBILITY_PENDING', userId);
    await ApplicationService.transitionState(app.id, 'NOT_ELIGIBLE', userId);

    // Correction loop submission
    const retryResult = await FinancialService.submitFinancials(app.id, userId, {
      employmentType: 'SALARIED',
      employerName: 'Tech Corp',
      designation: 'Senior Engineer',
      monthlyIncome: 150000 // Corrected income
    });

    expect(retryResult.status).toBe('FINANCIALS_COMPLETED');

    const [fin] = await db.select().from(financialDetails).where(eq(financialDetails.applicationId, app.id));
    expect(parseFloat(fin.monthlyIncome)).toBe(150000); // Updated via upsert
  }, 40000);

  it('should block unauthorized users from submitting financials', async () => {
    const userId = await setupUser();
    const otherUserId = await setupUser();
    const app = await ApplicationService.createApplication(userId);
    await KycService.submitKyc(app.id, userId, 'PAN', 'TEST3_NEW');
    
    await expect(FinancialService.submitFinancials(app.id, otherUserId, {
      employmentType: 'SALARIED',
      employerName: 'Tech Corp',
      designation: 'Engineer',
      monthlyIncome: 80000
    })).rejects.toThrow('Application not found or unauthorized');
  }, 40000);

  it('should block invalid financial input', async () => {
    const userId = await setupUser();
    const app = await ApplicationService.createApplication(userId);
    await KycService.submitKyc(app.id, userId, 'PAN', 'TEST4_NEW');
    
    await expect(FinancialService.submitFinancials(app.id, userId, {
      employmentType: 'SALARIED',
      employerName: 'Tech Corp',
      designation: 'Engineer',
      monthlyIncome: -5000
    })).rejects.toThrow('Monthly income must be greater than zero');
  }, 20000);

  it('should block submission in invalid state', async () => {
    const userId = await setupUser();
    const app = await ApplicationService.createApplication(userId);
    // State is DRAFT
    
    await expect(FinancialService.submitFinancials(app.id, userId, {
      employmentType: 'SALARIED',
      employerName: 'Tech Corp',
      designation: 'Engineer',
      monthlyIncome: 50000
    })).rejects.toThrow('Cannot submit financials in state DRAFT');
  }, 20000);
});

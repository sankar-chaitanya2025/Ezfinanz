import { describe, it, expect, afterAll } from 'vitest';
import { EligibilityService } from '../src/services/eligibilityService';
import { ApplicationService } from '../src/services/applicationService';
import { db } from '../src/db/index';
import { users, applications, financialDetails, eligibilityResults, auditLogs, kycDetails } from '../src/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const createdUserIds: string[] = [];

async function setupUserAndApp(income: number, existingEmi: number, score: number, requestedAmount: number) {
  const testUserId = crypto.randomUUID();
  await db.insert(users).values({
    id: testUserId,
    email: `test-elig-${testUserId}@ezfinanz.test`,
    role: 'CUSTOMER',
  });
  createdUserIds.push(testUserId);
  
  const app = await ApplicationService.createApplication(testUserId);
  
  // Set requested amount
  await db.update(applications)
    .set({ requestedAmount: requestedAmount.toString(), status: 'FINANCIALS_COMPLETED' })
    .where(eq(applications.id, app.id));

  await db.insert(financialDetails).values({
    applicationId: app.id,
    employmentType: 'SALARIED',
    employerName: 'Test Corp',
    designation: 'Engineer',
    monthlyIncome: income.toString(),
    creditScore: score,
    existingEmiObligations: existingEmi.toString()
  });

  return { userId: testUserId, appId: app.id };
}

describe('EligibilityService', () => {
  afterAll(async () => {
    if (createdUserIds.length === 0) return;
    const apps = await db.select({ id: applications.id }).from(applications).where(inArray(applications.userId, createdUserIds));
    const appIds = apps.map(a => a.id);
    
    if (appIds.length > 0) {
      await db.delete(eligibilityResults).where(inArray(eligibilityResults.applicationId, appIds));
      await db.delete(financialDetails).where(inArray(financialDetails.applicationId, appIds));
      await db.delete(auditLogs).where(inArray(auditLogs.applicationId, appIds));
      await db.delete(applications).where(inArray(applications.userId, createdUserIds));
    }
    
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }, 20000);

  it('should successfully evaluate ELIGIBLE and transition state', async () => {
    const { userId, appId } = await setupUserAndApp(100000, 0, 750, 500000);
    
    const result = await EligibilityService.evaluateEligibility(appId, userId);
    
    expect(result.app.status).toBe('ELIGIBLE');
    expect(result.eligibility.decision).toBe('ELIGIBLE');
    expect(result.eligibility.maxEligibleAmount).toBe(500000); // Because it was capped to requested

    // Verify DB insertion
    const res = await db.select().from(eligibilityResults).where(eq(eligibilityResults.applicationId, appId));
    expect(res.length).toBe(1);
    expect(res[0].evaluationVersion).toBe(1);
    expect(res[0].decision).toBe('ELIGIBLE');

    // Verify Audit log shows transition from FINANCIALS_COMPLETED -> ELIGIBILITY_PENDING -> ELIGIBLE
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.applicationId, appId)).orderBy(desc(auditLogs.createdAt));
    expect(audits.find(a => a.newStatus === 'ELIGIBLE')).toBeDefined();
  }, 60000);

  it('should preserve immutable eligibility_results history on repeated evaluations', async () => {
    // 1. Initial Evaluation (Fail)
    const { userId, appId } = await setupUserAndApp(10000, 0, 750, 500000); // 10k income -> NOT_ELIGIBLE
    await EligibilityService.evaluateEligibility(appId, userId);

    const [firstEval] = await db.select().from(eligibilityResults).where(eq(eligibilityResults.applicationId, appId));
    expect(firstEval.evaluationVersion).toBe(1);
    expect(firstEval.decision).toBe('NOT_ELIGIBLE');

    // Manually push back to FINANCIALS_COMPLETED to simulate correction loop
    await ApplicationService.transitionState(appId, 'FINANCIALS_COMPLETED', userId);

    // Update income in financial details to be passing
    await db.update(financialDetails).set({ monthlyIncome: '100000' }).where(eq(financialDetails.applicationId, appId));

    // 2. Second Evaluation (Pass)
    await EligibilityService.evaluateEligibility(appId, userId);

    const evals = await db.select().from(eligibilityResults).where(eq(eligibilityResults.applicationId, appId)).orderBy(desc(eligibilityResults.evaluationVersion));
    
    expect(evals.length).toBe(2);
    expect(evals[0].evaluationVersion).toBe(2);
    expect(evals[0].decision).toBe('ELIGIBLE');
    
    // First evaluation must remain intact
    expect(evals[1].evaluationVersion).toBe(1);
    expect(evals[1].decision).toBe('NOT_ELIGIBLE');
  }, 60000);

  it('should block evaluating an application belonging to another user', async () => {
    const { userId, appId } = await setupUserAndApp(100000, 0, 750, 500000);
    const otherUserId = crypto.randomUUID();
    
    await expect(EligibilityService.evaluateEligibility(appId, otherUserId))
      .rejects.toThrow('Application not found or unauthorized');
  }, 60000);

  it('should block evaluating an application in an invalid state', async () => {
    const { userId, appId } = await setupUserAndApp(100000, 0, 750, 500000);
    
    // Manually push to SUBMITTED
    await ApplicationService.transitionState(appId, 'ELIGIBILITY_PENDING', userId);
    await ApplicationService.transitionState(appId, 'ELIGIBLE', userId);
    await ApplicationService.transitionState(appId, 'TERMS_SELECTED', userId);
    
    await expect(EligibilityService.evaluateEligibility(appId, userId))
      .rejects.toThrow('Cannot evaluate eligibility from state: TERMS_SELECTED');
  }, 60000);
});

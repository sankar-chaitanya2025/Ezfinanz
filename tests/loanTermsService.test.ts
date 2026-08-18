import { describe, it, expect, afterAll } from 'vitest';
import { LoanTermsService } from '../src/services/loanTermsService';
import { ApplicationService } from '../src/services/applicationService';
import { db } from '../src/db/index';
import { users, applications, eligibilityResults, loanTerms, auditLogs } from '../src/db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const createdUserIds: string[] = [];

async function setupUserAppAndEligibility(maxEligibleAmount: number, decision: 'ELIGIBLE' | 'PARTIALLY_ELIGIBLE' | 'NOT_ELIGIBLE') {
  const testUserId = crypto.randomUUID();
  await db.insert(users).values({
    id: testUserId,
    email: `test-terms-${testUserId}@ezfinanz.test`,
    role: 'CUSTOMER',
  });
  createdUserIds.push(testUserId);
  
  const app = await ApplicationService.createApplication(testUserId);
  
  await db.update(applications)
    .set({ requestedAmount: maxEligibleAmount.toString(), status: decision })
    .where(eq(applications.id, app.id));

  await db.insert(eligibilityResults).values({
    applicationId: app.id,
    evaluationVersion: 1,
    decision,
    maxEligibleAmount: maxEligibleAmount.toString(),
    calculatedDti: '40',
    reasons: []
  });

  return { userId: testUserId, appId: app.id };
}

describe('LoanTermsService', () => {
  afterAll(async () => {
    if (createdUserIds.length === 0) return;
    const apps = await db.select({ id: applications.id }).from(applications).where(inArray(applications.userId, createdUserIds));
    const appIds = apps.map(a => a.id);
    
    if (appIds.length > 0) {
      await db.delete(loanTerms).where(inArray(loanTerms.applicationId, appIds));
      await db.delete(eligibilityResults).where(inArray(eligibilityResults.applicationId, appIds));
      await db.delete(auditLogs).where(inArray(auditLogs.applicationId, appIds));
      await db.delete(applications).where(inArray(applications.userId, createdUserIds));
    }
    
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }, 60000);

  it('should successfully generate terms and transition state for ELIGIBLE app', async () => {
    const { userId, appId } = await setupUserAppAndEligibility(100000, 'ELIGIBLE');
    
    const result = await LoanTermsService.generateAndAcceptTerms(appId, userId, 100000, 12);
    
    expect(result.app.status).toBe('TERMS_SELECTED');
    expect(result.terms.finalAmount).toBe(100000);
    expect(result.terms.tenure).toBe(12);

    const [termDb] = await db.select().from(loanTerms).where(eq(loanTerms.applicationId, appId));
    expect(parseFloat(termDb.finalAmount)).toBe(100000);
    expect(termDb.tenure).toBe(12);
    
    // PF = 2000, GST = 360, net = 97640
    expect(parseFloat(termDb.netDisbursement)).toBe(97640);
  }, 60000);

  it('should block generating terms for NOT_ELIGIBLE app', async () => {
    const { userId, appId } = await setupUserAppAndEligibility(100000, 'NOT_ELIGIBLE');
    
    await expect(LoanTermsService.generateAndAcceptTerms(appId, userId, 50000, 12))
      .rejects.toThrow('Cannot generate terms from state: NOT_ELIGIBLE');
  }, 60000);

  it('should block generating terms exceeding max eligible amount', async () => {
    const { userId, appId } = await setupUserAppAndEligibility(50000, 'PARTIALLY_ELIGIBLE');
    
    await expect(LoanTermsService.generateAndAcceptTerms(appId, userId, 60000, 12))
      .rejects.toThrow('exceeds maximum eligible amount');
  }, 60000);

  it('should block generating terms for another user', async () => {
    const { userId, appId } = await setupUserAppAndEligibility(100000, 'ELIGIBLE');
    const otherUserId = crypto.randomUUID();
    
    await expect(LoanTermsService.generateAndAcceptTerms(appId, otherUserId, 100000, 12))
      .rejects.toThrow('Application not found or unauthorized');
  }, 60000);

  it('should correctly replace terms on regeneration', async () => {
    const { userId, appId } = await setupUserAppAndEligibility(100000, 'ELIGIBLE');
    
    // First generation
    await LoanTermsService.generateAndAcceptTerms(appId, userId, 100000, 12);
    
    // Simulate user regenerating terms before BANK_VERIFIED
    // (State remains TERMS_SELECTED or ELIGIBLE, we don't need to manually transition back)
    
    // Second generation with new terms
    await LoanTermsService.generateAndAcceptTerms(appId, userId, 50000, 24);
    
    // Verify it replaced, not errored (1-to-1)
    const terms = await db.select().from(loanTerms).where(eq(loanTerms.applicationId, appId));
    expect(terms.length).toBe(1);
    expect(parseFloat(terms[0].finalAmount)).toBe(50000);
    expect(terms[0].tenure).toBe(24);
  }, 60000);

  it('should use the latest eligibility version', async () => {
    const { userId, appId } = await setupUserAppAndEligibility(100000, 'ELIGIBLE'); // version 1
    
    // Add version 2 manually
    await db.insert(eligibilityResults).values({
      applicationId: appId,
      evaluationVersion: 2,
      decision: 'PARTIALLY_ELIGIBLE',
      maxEligibleAmount: '40000',
      calculatedDti: '45',
      reasons: []
    });

    // Should fail because latest version is 40,000 max
    await expect(LoanTermsService.generateAndAcceptTerms(appId, userId, 50000, 12))
      .rejects.toThrow('exceeds maximum eligible amount');
  }, 60000);
});

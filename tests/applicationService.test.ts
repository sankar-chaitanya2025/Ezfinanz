import { describe, it, expect, afterAll } from 'vitest';
import { ApplicationService } from '../src/services/applicationService';
import { isValidTransition } from '../src/lib/state-machine';
import { db } from '../src/db/index';
import { users, applications, loans, auditLogs } from '../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const createdUserIds: string[] = [];

async function setupUser() {
  const testUserId = crypto.randomUUID();
  await db.insert(users).values({
    id: testUserId,
    email: `test-${testUserId}@ezfinanz.test`,
    role: 'CUSTOMER',
  });
  createdUserIds.push(testUserId);
  return testUserId;
}

describe('ApplicationService', () => {
  afterAll(async () => {
    if (createdUserIds.length === 0) return;
    
    // Find all applications for these users
    const apps = await db.select({ id: applications.id }).from(applications).where(inArray(applications.userId, createdUserIds));
    const appIds = apps.map(a => a.id);
    
    if (appIds.length > 0) {
      await db.delete(auditLogs).where(inArray(auditLogs.applicationId, appIds));
    }
    
    await db.delete(loans).where(inArray(loans.userId, createdUserIds));
    await db.delete(applications).where(inArray(applications.userId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  });

  it('1. should allow creating a new application when user has no active applications', async () => {
    const testUserId = await setupUser();
    const app = await ApplicationService.createApplication(testUserId);
    expect(app).toBeDefined();
    expect(app.status).toBe('DRAFT');
    expect(app.userId).toBe(testUserId);
  }, 10000);

  it('2. should prevent duplicate in-progress applications', async () => {
    const testUserId = await setupUser();
    await ApplicationService.createApplication(testUserId);
    await expect(ApplicationService.createApplication(testUserId)).rejects.toThrow('User already has an active/in-progress application');
  }, 10000);

  it('3. should enforce user-scoped application retrieval', async () => {
    const testUserId = await setupUser();
    await ApplicationService.createApplication(testUserId);
    const apps = await ApplicationService.getUserApplications(testUserId);
    expect(apps.length).toBe(1);
    expect(apps[0].userId).toBe(testUserId);
  }, 10000);

  it('4. should prevent invalid state transitions', async () => {
    const testUserId = await setupUser();
    const app = await ApplicationService.createApplication(testUserId);
    await expect(ApplicationService.transitionState(app.id, 'APPROVED', testUserId))
      .rejects.toThrow('Invalid state transition');
  }, 10000);

  it('5. should allow valid state transitions and verify audit log creation', async () => {
    const testUserId = await setupUser();
    const app = await ApplicationService.createApplication(testUserId);
    
    const updatedApp = await ApplicationService.transitionState(app.id, 'KYC_PENDING', testUserId);
    expect(updatedApp.status).toBe('KYC_PENDING');

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.applicationId, app.id)).orderBy(auditLogs.createdAt);
    expect(logs.length).toBe(2);
    expect(logs[1].newStatus).toBe('KYC_PENDING');
  }, 15000);

  it('6. should allow the eligibility correction loop', async () => {
    const testUserId = await setupUser();
    const app = await ApplicationService.createApplication(testUserId);

    await ApplicationService.transitionState(app.id, 'KYC_PENDING', testUserId);
    await ApplicationService.transitionState(app.id, 'KYC_COMPLETED', testUserId);
    await ApplicationService.transitionState(app.id, 'FINANCIALS_COMPLETED', testUserId);
    await ApplicationService.transitionState(app.id, 'ELIGIBILITY_PENDING', testUserId);
    await ApplicationService.transitionState(app.id, 'NOT_ELIGIBLE', testUserId);

    // Loop back
    const loopApp = await ApplicationService.transitionState(app.id, 'FINANCIALS_COMPLETED', testUserId);
    expect(loopApp.status).toBe('FINANCIALS_COMPLETED');
    
    const pendingApp = await ApplicationService.transitionState(app.id, 'ELIGIBILITY_PENDING', testUserId);
    expect(pendingApp.status).toBe('ELIGIBILITY_PENDING');
  }, 30000);

  it('7. should allow new application while previous loan is active', async () => {
    const testUserId = await setupUser();
    const app = await ApplicationService.createApplication(testUserId);

    await db.update(applications).set({ status: 'APPROVED' }).where(eq(applications.id, app.id));
    // Simulate active loan
    await db.insert(loans).values({
      applicationId: app.id,
      userId: testUserId,
      status: 'ACTIVE',
      sanctionedAmount: '10000',
      disbursedAmount: '10000',
      outstandingBalance: '5000'
    });

    // Should now be able to create a NEW application
    const newApp = await ApplicationService.createApplication(testUserId, 5000, 12);
    expect(newApp.status).toBe('DRAFT');
  }, 15000);
});

describe('State Machine Matrix logic', () => {
  it('allows eligibility correction loop', () => {
    expect(isValidTransition('NOT_ELIGIBLE', 'FINANCIALS_COMPLETED')).toBe(true);
  });
  it('is forward only after SUBMITTED', () => {
    expect(isValidTransition('SUBMITTED', 'DRAFT')).toBe(false);
  });
});

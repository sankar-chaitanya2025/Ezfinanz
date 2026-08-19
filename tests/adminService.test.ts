import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { AdminService } from '@/services/adminService'
import { db } from '@/db'
import { users, applications, auditLogs } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'

describe('AdminService', () => {
  const customerId = randomUUID()
  const admin1Id = randomUUID()
  const admin2Id = randomUUID()
  let appId = ''

  const createdUserIds: string[] = []

  beforeAll(async () => {
    createdUserIds.push(customerId, admin1Id, admin2Id)
    await db.insert(users).values([
      { id: customerId, email: `cust-${Date.now()}@test.com`, role: 'CUSTOMER' },
      { id: admin1Id, email: `admin1-${Date.now()}@test.com`, role: 'ADMIN' },
      { id: admin2Id, email: `admin2-${Date.now()}@test.com`, role: 'ADMIN' }
    ])
  })

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db.delete(auditLogs).where(inArray(auditLogs.actionBy, createdUserIds))
      await db.delete(applications).where(inArray(applications.userId, createdUserIds))
      await db.delete(users).where(inArray(users.id, createdUserIds))
    }
  })

  beforeEach(async () => {
    // Clear state for just these users
    await db.delete(auditLogs).where(inArray(auditLogs.actionBy, createdUserIds))
    await db.delete(applications).where(inArray(applications.userId, createdUserIds))

    // Setup a SUBMITTED application
    const [app] = await db.insert(applications).values({
      userId: customerId,
      status: 'SUBMITTED',
      requestedAmount: '10000',
      requestedTenure: 12
    }).returning()
    appId = app.id
  })

  it('1. CUSTOMER cannot claim an application', async () => {
    await expect(AdminService.claimApplication(appId, customerId)).rejects.toThrow(/Unauthorized/)
  }, 60000)

  it('2. ADMIN can claim a SUBMITTED application, recording reviewer and transitioning to UNDER_REVIEW', async () => {
    const app = await AdminService.claimApplication(appId, admin1Id)
    
    expect(app.status).toBe('UNDER_REVIEW')
    expect(app.reviewerId).toBe(admin1Id)
    expect(app.reviewTimestamp).not.toBeNull()

    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.applicationId, appId))
    expect(log.newStatus).toBe('UNDER_REVIEW')
    expect(log.actionBy).toBe(admin1Id)
  }, 60000)

  it('3. ADMIN cannot claim an application not in SUBMITTED state', async () => {
    await db.update(applications).set({ status: 'APPROVED' }).where(eq(applications.id, appId))
    await expect(AdminService.claimApplication(appId, admin1Id)).rejects.toThrow(/Cannot claim application/)
  }, 60000)

  it('4. Assigned ADMIN can approve application', async () => {
    await AdminService.claimApplication(appId, admin1Id)
    const app = await AdminService.approveApplication(appId, admin1Id)
    
    expect(app.status).toBe('APPROVED')
    
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.applicationId, appId)).orderBy(auditLogs.createdAt)
    expect(logs[logs.length - 1].newStatus).toBe('APPROVED')
  }, 60000)

  it('5. Assigned ADMIN can reject application', async () => {
    await AdminService.claimApplication(appId, admin1Id)
    const app = await AdminService.rejectApplication(appId, admin1Id, 'Fraud suspected')
    
    expect(app.status).toBe('REJECTED')
    
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.applicationId, appId)).orderBy(auditLogs.createdAt)
    expect(logs[logs.length - 1].notes).toContain('Fraud suspected')
  }, 60000)

  it('6. Non-assigned ADMIN cannot approve/reject', async () => {
    await AdminService.claimApplication(appId, admin1Id) // admin1 claims
    
    await expect(AdminService.approveApplication(appId, admin2Id)).rejects.toThrow(/Only the assigned reviewer/)
    await expect(AdminService.rejectApplication(appId, admin2Id)).rejects.toThrow(/Only the assigned reviewer/)
  }, 60000)

  it('7. Cannot approve/reject from invalid state', async () => {
    // Attempting to approve SUBMITTED (must be UNDER_REVIEW first)
    await expect(AdminService.approveApplication(appId, admin1Id)).rejects.toThrow(/Cannot approve application/)
  }, 60000)
})

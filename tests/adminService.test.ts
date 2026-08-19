import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { AdminService } from '@/services/adminService'
import { db } from '@/db'
import { users, applications, auditLogs, loanTerms, loans } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'

describe('AdminService', () => {
  const customerId = randomUUID()
  const admin1Id = randomUUID()
  let appId = ''

  const createdUserIds: string[] = []

  beforeAll(async () => {
    createdUserIds.push(customerId, admin1Id)
    await db.insert(users).values([
      { id: customerId, email: `cust-${Date.now()}@test.com`, role: 'CUSTOMER' },
      { id: admin1Id, email: `admin1-${Date.now()}@test.com`, role: 'ADMIN' }
    ])
  })

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await db.delete(auditLogs).where(inArray(auditLogs.actionBy, createdUserIds))
      await db.delete(loans).where(inArray(loans.userId, createdUserIds))
      if (appId) await db.delete(loanTerms).where(eq(loanTerms.applicationId, appId))
      await db.delete(applications).where(inArray(applications.userId, createdUserIds))
      await db.delete(users).where(inArray(users.id, createdUserIds))
    }
  })

  beforeEach(async () => {
    // Clear state for just these users
    await db.delete(auditLogs).where(inArray(auditLogs.actionBy, createdUserIds))
    await db.delete(loans).where(inArray(loans.userId, createdUserIds))
    if (appId) await db.delete(loanTerms).where(eq(loanTerms.applicationId, appId))
    await db.delete(applications).where(inArray(applications.userId, createdUserIds))

    // Setup a SUBMITTED application
    const [app] = await db.insert(applications).values({
      userId: customerId,
      status: 'SUBMITTED',
      requestedAmount: '10000',
      requestedTenure: 12
    }).returning()
    appId = app.id

    // Insert dummy loan terms so it can be approved
    await db.insert(loanTerms).values({
      applicationId: appId,
      finalAmount: '10000',
      processingFee: '500',
      gst: '90',
      totalInterest: '1000',
      totalCharges: '590',
      netDisbursement: '9410',
      interestRate: '1.5',
      tenure: 12,
      emi: '916',
      totalRepayment: '11000',
      irr: '18.0'
    })
  })

  it('1. CUSTOMER cannot approve an application', async () => {
    await expect(AdminService.approveApplication(appId, customerId)).rejects.toThrow(/Unauthorized/)
  }, 60000)

  it('2. ADMIN can approve a SUBMITTED application, which transitions to APPROVED and creates a DISBURSEMENT_PENDING loan', async () => {
    const app = await AdminService.approveApplication(appId, admin1Id)
    
    expect(app.status).toBe('APPROVED')
    expect(app.reviewerId).toBe(admin1Id)
    expect(app.reviewTimestamp).not.toBeNull()

    const [log] = await db.select().from(auditLogs).where(eq(auditLogs.applicationId, appId))
    expect(log.newStatus).toBe('APPROVED')
    expect(log.actionBy).toBe(admin1Id)

    const [loan] = await db.select().from(loans).where(eq(loans.applicationId, appId))
    expect(loan).toBeDefined()
    expect(loan.status).toBe('DISBURSEMENT_PENDING')
    expect(loan.sanctionedAmount).toBe('10000') // Because principalAmount = finalAmount is usually 10000 in this dummy data
  }, 60000)

  it('3. ADMIN can reject an application', async () => {
    const app = await AdminService.rejectApplication(appId, admin1Id, 'Fraud suspected')
    
    expect(app.status).toBe('REJECTED')
    
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.applicationId, appId)).orderBy(auditLogs.createdAt)
    expect(logs[logs.length - 1].notes).toContain('Fraud suspected')
  }, 60000)

  it('4. ADMIN can confirm disbursement for an APPROVED app with a DISBURSEMENT_PENDING loan', async () => {
    // Approve it first to create the loan
    await AdminService.approveApplication(appId, admin1Id)

    // Confirm disbursement
    const loan = await AdminService.confirmDisbursement(appId, admin1Id)
    expect(loan.status).toBe('ACTIVE')
    expect(loan.disbursedAmount).toBe('9410') // Matches netDisbursement

    // Verify audit log
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.applicationId, appId)).orderBy(auditLogs.createdAt)
    const disburseLog = logs.find(l => l.action === 'LOAN_DISBURSED')
    expect(disburseLog).toBeDefined()
    expect(disburseLog?.actionBy).toBe(admin1Id)
  }, 60000)

  it('5. Cannot confirm disbursement if application is not APPROVED', async () => {
    await expect(AdminService.confirmDisbursement(appId, admin1Id)).rejects.toThrow(/not APPROVED/)
  }, 60000)
})

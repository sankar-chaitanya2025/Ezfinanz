import { db } from '@/db'
import { applications, users, kycDetails, financialDetails, eligibilityResults, loanTerms, bankDetails, selfieVerifications, declarations, loans, auditLogs } from '@/db/schema'
import { eq, inArray, desc } from 'drizzle-orm'
import { ApplicationService } from '@/services/applicationService'

export class AdminService {
  /**
   * Fetch applications that are in a reviewable or terminal state.
   */
  static async getReviewableApplications() {
    return await db.select({
      id: applications.id,
      status: applications.status,
      createdAt: applications.createdAt,
      requestedAmount: applications.requestedAmount,
      requestedTenure: applications.requestedTenure,
      reviewerId: applications.reviewerId,
      customerEmail: users.email,
    })
    .from(applications)
    .innerJoin(users, eq(applications.userId, users.id))
    .where(inArray(applications.status, ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']))
    .orderBy(desc(applications.createdAt))
  }

  /**
   * Fetch all snapshots and details for a specific application.
   */
  static async getApplicationDetails(applicationId: string) {
    const [app] = await db.select({
      id: applications.id,
      status: applications.status,
      createdAt: applications.createdAt,
      requestedAmount: applications.requestedAmount,
      requestedTenure: applications.requestedTenure,
      reviewerId: applications.reviewerId,
      customerEmail: users.email,
    })
    .from(applications)
    .innerJoin(users, eq(applications.userId, users.id))
    .where(eq(applications.id, applicationId))
    .limit(1)

    if (!app) return null;

    const [kyc] = await db.select().from(kycDetails).where(eq(kycDetails.applicationId, applicationId)).limit(1)
    const [financial] = await db.select().from(financialDetails).where(eq(financialDetails.applicationId, applicationId)).limit(1)
    
    // Eligibility history - get all to see if there were corrections
    const eligibility = await db.select().from(eligibilityResults)
      .where(eq(eligibilityResults.applicationId, applicationId))
      .orderBy(desc(eligibilityResults.evaluationVersion))
      
    const [terms] = await db.select().from(loanTerms).where(eq(loanTerms.applicationId, applicationId)).limit(1)
    const [bank] = await db.select().from(bankDetails).where(eq(bankDetails.applicationId, applicationId)).limit(1)
    const [selfie] = await db.select().from(selfieVerifications).where(eq(selfieVerifications.applicationId, applicationId)).limit(1)
    const [declaration] = await db.select().from(declarations).where(eq(declarations.applicationId, applicationId)).limit(1)
    const [loan] = await db.select().from(loans).where(eq(loans.applicationId, applicationId)).limit(1)

    return {
      application: app,
      kyc,
      financial,
      eligibility,
      terms,
      bank,
      selfie,
      declaration,
      loan
    }
  }

  /**
   * Admin approves an application. Transitions from SUBMITTED -> APPROVED.
   * Atomically creates the DISBURSEMENT_PENDING loan.
   */
  static async approveApplication(applicationId: string, adminUserId: string) {
    return await this.finalizeReview(applicationId, adminUserId, 'APPROVED')
  }

  /**
   * Admin rejects an application. Transitions from SUBMITTED -> REJECTED.
   */
  static async rejectApplication(applicationId: string, adminUserId: string, reason?: string) {
    return await this.finalizeReview(applicationId, adminUserId, 'REJECTED', reason)
  }

  private static async finalizeReview(applicationId: string, adminUserId: string, decision: 'APPROVED' | 'REJECTED', reason?: string) {
    const actionVerb = decision === 'APPROVED' ? 'approve' : 'reject'

    // 1. Verify admin role
    const [admin] = await db.select().from(users).where(eq(users.id, adminUserId)).limit(1)
    if (!admin || admin.role !== 'ADMIN') {
      throw new Error(`Unauthorized: Only ADMIN users can ${actionVerb} applications`)
    }

    return await db.transaction(async (tx) => {
      // 2. Lock the row / Verify current state
      const [app] = await tx.select()
        .from(applications)
        .where(eq(applications.id, applicationId))
        .limit(1)

      if (!app) {
        throw new Error('Application not found')
      }

      if (app.status !== 'SUBMITTED') {
        throw new Error(`Cannot ${actionVerb} application from state: ${app.status}`)
      }

      // 3. Set the reviewer who made the decision
      await tx.update(applications)
        .set({
          reviewerId: adminUserId,
          reviewTimestamp: new Date()
        })
        .where(eq(applications.id, applicationId))

      // 4. If APPROVED, create the DISBURSEMENT_PENDING loan atomically
      if (decision === 'APPROVED') {
        const [terms] = await tx.select().from(loanTerms).where(eq(loanTerms.applicationId, applicationId)).limit(1)
        if (!terms) {
          throw new Error('Cannot approve: No loan terms found for this application')
        }
        
        await tx.insert(loans).values({
          applicationId: app.id,
          userId: app.userId,
          status: 'DISBURSEMENT_PENDING',
          sanctionedAmount: terms.finalAmount,
          disbursedAmount: null,
          outstandingBalance: terms.finalAmount
        })
      }

      const notes = reason ? `${decision} - Reason: ${reason}` : `Application ${decision} by admin`

      // 5. Transition State
      return await ApplicationService.transitionState(
        applicationId,
        decision,
        adminUserId,
        notes,
        tx
      )
    })
  }

  /**
   * Admin confirms disbursement, transitioning the loan from DISBURSEMENT_PENDING to ACTIVE.
   */
  static async confirmDisbursement(applicationId: string, adminUserId: string) {
    // 1. Verify admin role
    const [admin] = await db.select().from(users).where(eq(users.id, adminUserId)).limit(1)
    if (!admin || admin.role !== 'ADMIN') {
      throw new Error(`Unauthorized: Only ADMIN users can confirm disbursement`)
    }

    return await db.transaction(async (tx) => {
      // 2. Fetch the application to ensure it's APPROVED
      const [app] = await tx.select().from(applications).where(eq(applications.id, applicationId)).limit(1)
      if (!app) {
        throw new Error('Application not found')
      }
      if (app.status !== 'APPROVED') {
        throw new Error(`Cannot disburse: Application is not APPROVED (status is ${app.status})`)
      }

      // 3. Fetch the loan record
      const [loan] = await tx.select().from(loans).where(eq(loans.applicationId, applicationId)).limit(1)
      if (!loan) {
        throw new Error('Cannot disburse: Loan record not found')
      }
      if (loan.status !== 'DISBURSEMENT_PENDING') {
        throw new Error(`Cannot disburse: Loan is not pending disbursement (status is ${loan.status})`)
      }

      // 4. Fetch terms for netDisbursement amount
      const [terms] = await tx.select().from(loanTerms).where(eq(loanTerms.applicationId, applicationId)).limit(1)

      // 5. Update loan status to ACTIVE
      const [updatedLoan] = await tx.update(loans)
        .set({
          status: 'ACTIVE',
          disbursedAmount: terms ? terms.netDisbursement : loan.sanctionedAmount, // Fallback if terms not found, though impossible
          disbursedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(loans.id, loan.id))
        .returning()

      // 6. Log the action
      await tx.insert(auditLogs).values({
        applicationId: applicationId,
        action: 'LOAN_DISBURSED',
        previousStatus: 'APPROVED',
        newStatus: 'APPROVED',
        actionBy: adminUserId,
        notes: 'Admin confirmed disbursement of funds'
      })

      return updatedLoan
    })
  }
}

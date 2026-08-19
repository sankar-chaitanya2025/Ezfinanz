import { db } from '@/db'
import { applications, users, kycDetails, financialDetails, eligibilityResults, loanTerms, bankDetails, selfieVerifications, declarations } from '@/db/schema'
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

    return {
      application: app,
      kyc,
      financial,
      eligibility,
      terms,
      bank,
      selfie,
      declaration
    }
  }

  /**
   * Admin claims an application for review. Transitions from SUBMITTED -> UNDER_REVIEW.
   */
  static async claimApplication(applicationId: string, adminUserId: string) {
    // 1. Verify admin role
    const [admin] = await db.select().from(users).where(eq(users.id, adminUserId)).limit(1)
    if (!admin || admin.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only ADMIN users can claim applications')
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
        throw new Error(`Cannot claim application from state: ${app.status}`)
      }

      // 3. Update reviewerId and timestamp
      await tx.update(applications)
        .set({
          reviewerId: adminUserId,
          reviewTimestamp: new Date()
        })
        .where(eq(applications.id, applicationId))

      // 4. Transition State
      return await ApplicationService.transitionState(
        applicationId,
        'UNDER_REVIEW',
        adminUserId,
        'Admin claimed application for review',
        tx
      )
    })
  }

  /**
   * Admin approves an application. Transitions from UNDER_REVIEW -> APPROVED.
   */
  static async approveApplication(applicationId: string, adminUserId: string) {
    return await this.finalizeReview(applicationId, adminUserId, 'APPROVED')
  }

  /**
   * Admin rejects an application. Transitions from UNDER_REVIEW -> REJECTED.
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
      // 2. Verify current state and ownership
      const [app] = await tx.select()
        .from(applications)
        .where(eq(applications.id, applicationId))
        .limit(1)

      if (!app) {
        throw new Error('Application not found')
      }

      if (app.status !== 'UNDER_REVIEW') {
        throw new Error(`Cannot ${actionVerb} application from state: ${app.status}`)
      }

      if (app.reviewerId !== adminUserId) {
        throw new Error(`Unauthorized: Only the assigned reviewer can ${actionVerb} this application`)
      }

      const notes = reason ? `${decision} - Reason: ${reason}` : `Application ${decision} by admin`

      // 3. Transition State
      return await ApplicationService.transitionState(
        applicationId,
        decision,
        adminUserId,
        notes,
        tx
      )
    })
  }
}

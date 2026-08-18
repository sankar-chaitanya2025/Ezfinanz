import { db } from '@/db'
import { applications, financialDetails, eligibilityResults } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { EligibilityEngine } from '@/domain/eligibilityEngine'
import { ApplicationService } from '@/services/applicationService'

export class EligibilityService {
  /**
   * Evaluates application eligibility by fetching the existing financial snapshot,
   * passing it to the pure EligibilityEngine, and immutably recording the result.
   */
  static async evaluateEligibility(applicationId: string, userId: string) {
    return await db.transaction(async (tx) => {
      // 1. Validate application ownership and state
      const [app] = await tx.select()
        .from(applications)
        .where(eq(applications.id, applicationId))
        .limit(1)

      if (!app || app.userId !== userId) {
        throw new Error('Application not found or unauthorized')
      }

      if (app.status !== 'FINANCIALS_COMPLETED' && app.status !== 'ELIGIBILITY_PENDING') {
        throw new Error(`Cannot evaluate eligibility from state: ${app.status}`)
      }

      // If it's FINANCIALS_COMPLETED, transition to ELIGIBILITY_PENDING first
      // to respect the state machine boundaries
      if (app.status === 'FINANCIALS_COMPLETED') {
        await ApplicationService.transitionState(
          applicationId,
          'ELIGIBILITY_PENDING',
          userId,
          'Initiating eligibility evaluation',
          tx
        )
      }

      // 2. Fetch the immutable financial snapshot
      const [financials] = await tx.select()
        .from(financialDetails)
        .where(eq(financialDetails.applicationId, applicationId))
        .limit(1)

      if (!financials) {
        throw new Error('Financial details snapshot not found for this application')
      }

      // 3. Evaluate using pure engine
      const result = EligibilityEngine.evaluate({
        monthlyIncome: parseFloat(financials.monthlyIncome),
        creditScore: financials.creditScore,
        existingEmiObligations: parseFloat(financials.existingEmiObligations),
        requestedAmount: app.requestedAmount ? parseFloat(app.requestedAmount) : null
      })

      // 4. Determine evaluation version
      const existingResults = await tx.select({ version: eligibilityResults.evaluationVersion })
        .from(eligibilityResults)
        .where(eq(eligibilityResults.applicationId, applicationId))
        .orderBy(desc(eligibilityResults.evaluationVersion))
        .limit(1)

      const newVersion = existingResults.length > 0 ? existingResults[0].version + 1 : 1

      // 5. Save the immutable result
      await tx.insert(eligibilityResults).values({
        applicationId,
        evaluationVersion: newVersion,
        decision: result.decision,
        maxEligibleAmount: result.maxEligibleAmount.toString(),
        calculatedDti: result.calculatedDti.toString(),
        reasons: result.reasons
      })

      // 6. Transition to final decision state
      const updatedApp = await ApplicationService.transitionState(
        applicationId,
        result.decision, // ELIGIBLE, PARTIALLY_ELIGIBLE, NOT_ELIGIBLE map exactly to states
        userId,
        `Eligibility evaluated (Version ${newVersion}): ${result.decision}`,
        tx
      )

      return {
        app: updatedApp,
        eligibility: result
      }
    })
  }
}

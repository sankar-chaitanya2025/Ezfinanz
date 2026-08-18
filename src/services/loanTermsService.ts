import { db } from '@/db'
import { applications, eligibilityResults, loanTerms, auditLogs } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { FinancialCalculator } from '@/domain/financialCalculator'
import { ApplicationService } from '@/services/applicationService'

export class LoanTermsService {
  private static readonly INTEREST_RATE = 0.12;

  /**
   * Generates and persists loan terms based on user's explicitly selected amount and tenure.
   */
  static async generateAndAcceptTerms(applicationId: string, userId: string, requestedAmount: number, requestedTenure: number) {
    return await db.transaction(async (tx) => {
      // 1. Validate application ownership and state
      const [app] = await tx.select()
        .from(applications)
        .where(eq(applications.id, applicationId))
        .limit(1)

      if (!app || app.userId !== userId) {
        throw new Error('Application not found or unauthorized')
      }

      if (app.status !== 'ELIGIBLE' && app.status !== 'PARTIALLY_ELIGIBLE' && app.status !== 'TERMS_SELECTED') {
        throw new Error(`Cannot generate terms from state: ${app.status}`)
      }

      // 2. Fetch the latest eligibility result
      const [latestEligibility] = await tx.select()
        .from(eligibilityResults)
        .where(eq(eligibilityResults.applicationId, applicationId))
        .orderBy(desc(eligibilityResults.evaluationVersion))
        .limit(1)

      if (!latestEligibility) {
        throw new Error('No eligibility evaluation found for this application')
      }

      const maxEligibleAmount = parseFloat(latestEligibility.maxEligibleAmount);

      // 3. Validate user inputs against bounds
      if (requestedAmount <= 0) {
        throw new Error('Requested amount must be greater than 0');
      }

      if (requestedAmount > maxEligibleAmount) {
        throw new Error(`Requested amount (₹${requestedAmount}) exceeds maximum eligible amount (₹${maxEligibleAmount})`);
      }

      // 4. Calculate terms
      const calculatedTerms = FinancialCalculator.generateTerms({
        finalAmount: requestedAmount,
        tenure: requestedTenure,
        annualInterestRate: this.INTEREST_RATE,
      })

      // 5. Check if terms already exist
      const [existingTerms] = await tx.select()
        .from(loanTerms)
        .where(eq(loanTerms.applicationId, applicationId))
        .limit(1)

      if (existingTerms) {
        // Wipe and replace: update existing record
        await tx.update(loanTerms).set({
          finalAmount: calculatedTerms.finalAmount.toString(),
          tenure: calculatedTerms.tenure,
          interestRate: calculatedTerms.interestRate.toString(),
          emi: calculatedTerms.emi.toString(),
          processingFee: calculatedTerms.processingFee.toString(),
          gst: calculatedTerms.gst.toString(),
          totalInterest: calculatedTerms.totalInterest.toString(),
          totalCharges: calculatedTerms.totalCharges.toString(),
          totalRepayment: calculatedTerms.totalRepayment.toString(),
          netDisbursement: calculatedTerms.netDisbursement.toString(),
          irr: calculatedTerms.irr.toString(),
        }).where(eq(loanTerms.id, existingTerms.id));
      } else {
        // Insert new record
        await tx.insert(loanTerms).values({
          applicationId,
          finalAmount: calculatedTerms.finalAmount.toString(),
          tenure: calculatedTerms.tenure,
          interestRate: calculatedTerms.interestRate.toString(),
          emi: calculatedTerms.emi.toString(),
          processingFee: calculatedTerms.processingFee.toString(),
          gst: calculatedTerms.gst.toString(),
          totalInterest: calculatedTerms.totalInterest.toString(),
          totalCharges: calculatedTerms.totalCharges.toString(),
          totalRepayment: calculatedTerms.totalRepayment.toString(),
          netDisbursement: calculatedTerms.netDisbursement.toString(),
          irr: calculatedTerms.irr.toString(),
        })
      }

      // 6. Transition to TERMS_SELECTED
      let updatedApp = app;
      if (app.status !== 'TERMS_SELECTED') {
        updatedApp = await ApplicationService.transitionState(
          applicationId,
          'TERMS_SELECTED',
          userId,
          `Terms selected: ₹${calculatedTerms.finalAmount} for ${calculatedTerms.tenure} months`,
          tx
        );
      } else {
        // Just log the update in audit log manually since we are not changing state
        await tx.insert(auditLogs).values({
          applicationId,
          action: 'TERMS_UPDATED',
          previousStatus: 'TERMS_SELECTED',
          newStatus: 'TERMS_SELECTED',
          actionBy: userId,
          notes: `Terms updated: ₹${calculatedTerms.finalAmount} for ${calculatedTerms.tenure} months`
        });
      }

      return {
        app: updatedApp,
        terms: calculatedTerms
      }
    })
  }
}

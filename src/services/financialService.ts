import { db } from '@/db'
import { 
  applications, 
  financialDetails, 
  externalCreditObligations, 
  kycDetails,
  employmentTypeEnum
} from '@/db/schema'
import { eq } from 'drizzle-orm'
import { MockCreditBureauProvider } from '@/providers/mockCreditBureauProvider'
import { ApplicationService } from '@/services/applicationService'

type EmploymentType = typeof employmentTypeEnum.enumValues[number]

export interface FinancialSubmission {
  employmentType: EmploymentType
  employerName: string
  designation: string
  monthlyIncome: number
}

export class FinancialService {
  /**
   * Submits financial details, syncs external credit obligations via Mock Bureau,
   * computes aggregated EMI, and advances state to FINANCIALS_COMPLETED.
   * All operations run inside a single transaction.
   */
  static async submitFinancials(
    applicationId: string,
    userId: string,
    data: FinancialSubmission
  ) {
    if (data.monthlyIncome <= 0) {
      throw new Error('Monthly income must be greater than zero')
    }

    return await db.transaction(async (tx) => {
      // 1. Validate application ownership and state
      const [app] = await tx.select()
        .from(applications)
        .where(eq(applications.id, applicationId))
        .limit(1)

      if (!app || app.userId !== userId) {
        throw new Error('Application not found or unauthorized')
      }

      if (app.status !== 'KYC_COMPLETED' && app.status !== 'NOT_ELIGIBLE') {
        throw new Error(`Cannot submit financials in state ${app.status}`)
      }

      // 2. Obtain KYC hash to mock credit bureau call
      const [kyc] = await tx.select({ idNumberHash: kycDetails.idNumberHash })
        .from(kycDetails)
        .where(eq(kycDetails.applicationId, applicationId))
        .limit(1)

      if (!kyc) {
        throw new Error('KYC details not found for this application')
      }

      // 3. Fetch mock bureau report
      const bureauReport = await MockCreditBureauProvider.fetchReport(kyc.idNumberHash)

      // 4. Wipe-and-Replace external credit obligations for the user
      await tx.delete(externalCreditObligations)
        .where(eq(externalCreditObligations.userId, userId))

      let existingEmiObligations = 0

      if (bureauReport.obligations.length > 0) {
        await tx.insert(externalCreditObligations)
          .values(
            bureauReport.obligations.map(ob => ({
              userId,
              loanType: ob.loanType,
              emiAmount: ob.emiAmount,
              outstandingAmount: ob.outstandingAmount,
              status: ob.status,
              lenderName: ob.lenderName
            }))
          )

        // 5. Aggregate EMI (only ACTIVE and DEFAULTED)
        for (const ob of bureauReport.obligations) {
          if (ob.status === 'ACTIVE' || ob.status === 'DEFAULTED') {
            existingEmiObligations += parseFloat(ob.emiAmount)
          }
        }
      }

      // 6. Upsert financial details snapshot for this application
      await tx.insert(financialDetails)
        .values({
          applicationId,
          employmentType: data.employmentType,
          employerName: data.employerName,
          designation: data.designation,
          monthlyIncome: data.monthlyIncome.toString(),
          creditScore: bureauReport.creditScore,
          existingEmiObligations: existingEmiObligations.toString()
        })
        .onConflictDoUpdate({
          target: financialDetails.applicationId,
          set: {
            employmentType: data.employmentType,
            employerName: data.employerName,
            designation: data.designation,
            monthlyIncome: data.monthlyIncome.toString(),
            creditScore: bureauReport.creditScore,
            existingEmiObligations: existingEmiObligations.toString()
          }
        })

      // 7. Transition Application State
      const updatedApp = await ApplicationService.transitionState(
        applicationId,
        'FINANCIALS_COMPLETED',
        userId,
        'Financial details submitted and credit bureau synced',
        tx
      )

      return updatedApp
    })
  }
}

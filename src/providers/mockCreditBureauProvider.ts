import { loanStatusEnum } from '@/db/schema'

type LoanStatus = typeof loanStatusEnum.enumValues[number]

export interface ExternalObligation {
  loanType: string
  emiAmount: string
  outstandingAmount: string
  status: LoanStatus
  lenderName: string
}

export interface CreditBureauReport {
  creditScore: number
  obligations: ExternalObligation[]
}

export class MockCreditBureauProvider {
  /**
   * Deterministically returns a mock credit report based on the ID Hash.
   * - If hash starts with 'f', simulates a bad score (e.g. 500) and defaults.
   * - If hash starts with 'a', simulates a medium score (e.g. 650) with active loans.
   * - Otherwise, simulates a good score (750+) with closed loans or no loans.
   */
  static async fetchReport(idNumberHash: string): Promise<CreditBureauReport> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800))

    const char = idNumberHash.charAt(0).toLowerCase()

    if (char === 'f') {
      return {
        creditScore: 520,
        obligations: [
          {
            loanType: 'PERSONAL_LOAN',
            emiAmount: '5000',
            outstandingAmount: '45000',
            status: 'DEFAULTED',
            lenderName: 'Mock Bank A'
          }
        ]
      }
    }

    if (char === 'a') {
      return {
        creditScore: 680,
        obligations: [
          {
            loanType: 'AUTO_LOAN',
            emiAmount: '12000',
            outstandingAmount: '350000',
            status: 'ACTIVE',
            lenderName: 'Mock Auto Finance'
          },
          {
            loanType: 'CREDIT_CARD',
            emiAmount: '2000',
            outstandingAmount: '15000',
            status: 'ACTIVE',
            lenderName: 'Mock Bank B'
          }
        ]
      }
    }

    // Default good score
    return {
      creditScore: 780,
      obligations: [
        {
          loanType: 'HOME_LOAN',
          emiAmount: '25000',
          outstandingAmount: '0',
          status: 'CLOSED',
          lenderName: 'Mock Housing Finance'
        }
      ]
    }
  }
}

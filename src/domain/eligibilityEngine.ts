export interface FinancialFacts {
  monthlyIncome: number;
  creditScore: number | null;
  existingEmiObligations: number;
  requestedAmount: number | null;
}

export type EligibilityDecision = 'ELIGIBLE' | 'PARTIALLY_ELIGIBLE' | 'NOT_ELIGIBLE';

export interface EligibilityResult {
  decision: EligibilityDecision;
  maxEligibleAmount: number;
  calculatedDti: number;
  reasons: string[];
}

export class EligibilityEngine {
  private static readonly ANNUAL_INTEREST_RATE = 0.12;
  private static readonly TENURE_MONTHS = 60;
  private static readonly MAX_DTI_PERCENTAGE = 50;
  private static readonly MIN_INCOME = 15000;
  private static readonly MIN_CREDIT_SCORE = 650;
  private static readonly ELIGIBLE_CREDIT_SCORE = 700;
  private static readonly ABSOLUTE_MAX_LOAN_AMOUNT = 5000000; // ₹50 Lakhs limit for personal loans

  /**
   * Calculates the EMI for a given principal amount, annual interest rate, and tenure.
   * Uses standard reducing-balance EMI formula: E = P * r * (1+r)^n / ((1+r)^n - 1)
   */
  public static calculateEMI(principal: number, annualRate: number, months: number): number {
    if (principal <= 0) return 0;
    const monthlyRate = annualRate / 12;
    const num = principal * monthlyRate * Math.pow(1 + monthlyRate, months);
    const den = Math.pow(1 + monthlyRate, months) - 1;
    return parseFloat((num / den).toFixed(2));
  }

  /**
   * Calculates the Present Value (maximum principal) for a given affordable EMI.
   * P = E * ((1+r)^n - 1) / (r * (1+r)^n)
   */
  public static calculatePV(emi: number, annualRate: number, months: number): number {
    if (emi <= 0) return 0;
    const monthlyRate = annualRate / 12;
    const num = emi * (Math.pow(1 + monthlyRate, months) - 1);
    const den = monthlyRate * Math.pow(1 + monthlyRate, months);
    return parseFloat((num / den).toFixed(2));
  }

  public static evaluate(facts: FinancialFacts): EligibilityResult {
    const reasons: string[] = [];

    // Basic Input Validation
    if (!facts.requestedAmount || facts.requestedAmount <= 0) {
      reasons.push('Requested amount must be greater than 0.');
      return {
        decision: 'NOT_ELIGIBLE',
        maxEligibleAmount: 0,
        calculatedDti: 0,
        reasons,
      };
    }

    if (facts.requestedAmount > this.ABSOLUTE_MAX_LOAN_AMOUNT) {
      reasons.push(`Requested amount (₹${facts.requestedAmount.toLocaleString('en-IN')}) exceeds the maximum loan limit of ₹${this.ABSOLUTE_MAX_LOAN_AMOUNT.toLocaleString('en-IN')}.`);
      return {
        decision: 'NOT_ELIGIBLE',
        maxEligibleAmount: 0,
        calculatedDti: 0,
        reasons,
      };
    }

    if (!facts.creditScore) {
      reasons.push('Credit score is missing.');
      return {
        decision: 'NOT_ELIGIBLE',
        maxEligibleAmount: 0,
        calculatedDti: 0,
        reasons,
      };
    }

    // 1. Minimum Income Check
    if (facts.monthlyIncome < this.MIN_INCOME) {
      reasons.push(`Monthly income (₹${facts.monthlyIncome}) is below the minimum required (₹${this.MIN_INCOME}).`);
      return {
        decision: 'NOT_ELIGIBLE',
        maxEligibleAmount: 0,
        calculatedDti: 0,
        reasons,
      };
    }

    // 2. Credit Score Check
    if (facts.creditScore < this.MIN_CREDIT_SCORE) {
      reasons.push(`Credit score (${facts.creditScore}) is below the minimum required (${this.MIN_CREDIT_SCORE}).`);
      return {
        decision: 'NOT_ELIGIBLE',
        maxEligibleAmount: 0,
        calculatedDti: 0,
        reasons,
      };
    }

    // 3. Calculate Maximum Affordable EMI & Max Eligible Amount
    const maxAffordableEMI = parseFloat(((facts.monthlyIncome * (this.MAX_DTI_PERCENTAGE / 100)) - facts.existingEmiObligations).toFixed(2));
    
    if (maxAffordableEMI <= 0) {
      reasons.push(`Existing EMI obligations (₹${facts.existingEmiObligations}) exceed or equal 50% of monthly income.`);
      return {
        decision: 'NOT_ELIGIBLE',
        maxEligibleAmount: 0,
        calculatedDti: parseFloat(((facts.existingEmiObligations / facts.monthlyIncome) * 100).toFixed(2)),
        reasons,
      };
    }

    const maxEligibleAmount = this.calculatePV(maxAffordableEMI, this.ANNUAL_INTEREST_RATE, this.TENURE_MONTHS);

    if (maxEligibleAmount <= 0) {
      reasons.push('Calculated maximum eligible amount is 0 or negative.');
      return {
        decision: 'NOT_ELIGIBLE',
        maxEligibleAmount: 0,
        calculatedDti: parseFloat(((facts.existingEmiObligations / facts.monthlyIncome) * 100).toFixed(2)),
        reasons,
      };
    }

    // 4. Calculate Proposed EMI and DTI
    const proposedEMI = this.calculateEMI(facts.requestedAmount, this.ANNUAL_INTEREST_RATE, this.TENURE_MONTHS);
    const calculatedDti = parseFloat((((facts.existingEmiObligations + proposedEMI) / facts.monthlyIncome) * 100).toFixed(2));

    // 5. Decision Logic
    let decision: EligibilityDecision = 'ELIGIBLE';

    if (facts.creditScore >= this.MIN_CREDIT_SCORE && facts.creditScore < this.ELIGIBLE_CREDIT_SCORE) {
      decision = 'PARTIALLY_ELIGIBLE';
      reasons.push(`Credit score (${facts.creditScore}) falls in the partial eligibility bracket (${this.MIN_CREDIT_SCORE}-${this.ELIGIBLE_CREDIT_SCORE - 1}).`);
    }

    if (facts.requestedAmount > maxEligibleAmount) {
      decision = 'PARTIALLY_ELIGIBLE';
      reasons.push(`Requested amount (₹${facts.requestedAmount}) exceeds maximum eligible amount (₹${maxEligibleAmount}).`);
    }

    if (decision === 'ELIGIBLE' && calculatedDti > this.MAX_DTI_PERCENTAGE) {
      // This should technically be caught by requestedAmount > maxEligibleAmount, but just in case of rounding:
      decision = 'PARTIALLY_ELIGIBLE';
      reasons.push(`Requested amount results in a DTI (${calculatedDti}%) exceeding the maximum (${this.MAX_DTI_PERCENTAGE}%).`);
    }

    if (decision === 'ELIGIBLE') {
      reasons.push('Applicant meets all eligibility criteria.');
    }

    return {
      decision,
      maxEligibleAmount: decision === 'PARTIALLY_ELIGIBLE' ? maxEligibleAmount : facts.requestedAmount,
      calculatedDti,
      reasons,
    };
  }
}

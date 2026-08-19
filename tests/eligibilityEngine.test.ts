import { describe, it, expect } from 'vitest';
import { EligibilityEngine, FinancialFacts } from '../src/domain/eligibilityEngine';

describe('EligibilityEngine - Pure Business Rules', () => {
  const baseFacts: FinancialFacts = {
    monthlyIncome: 50000,
    creditScore: 750,
    existingEmiObligations: 10000,
    requestedAmount: 500000, // 5 Lakhs
  };

  it('should evaluate as ELIGIBLE for a perfect candidate', () => {
    const result = EligibilityEngine.evaluate(baseFacts);
    expect(result.decision).toBe('ELIGIBLE');
    expect(result.maxEligibleAmount).toBeGreaterThanOrEqual(baseFacts.requestedAmount as number);
    expect(result.calculatedDti).toBeLessThanOrEqual(50);
  });

  it('should return NOT_ELIGIBLE if requested amount is 0', () => {
    const result = EligibilityEngine.evaluate({ ...baseFacts, requestedAmount: 0 });
    expect(result.decision).toBe('NOT_ELIGIBLE');
    expect(result.reasons.some(r => r.includes('greater than 0'))).toBe(true);
  });

  it('should return NOT_ELIGIBLE if income is below 15000', () => {
    const result = EligibilityEngine.evaluate({ ...baseFacts, monthlyIncome: 14999 });
    expect(result.decision).toBe('NOT_ELIGIBLE');
    expect(result.reasons.some(r => r.includes('below the minimum required'))).toBe(true);
  });

  it('should evaluate exactly 15000 income', () => {
    const result = EligibilityEngine.evaluate({ 
      ...baseFacts, 
      monthlyIncome: 15000,
      existingEmiObligations: 0,
      requestedAmount: 50000
    });
    // Max affordable EMI = 7500. PV(7500, 1%, 60) = ~337000
    expect(result.decision).toBe('ELIGIBLE');
  });

  it('should return NOT_ELIGIBLE if credit score is below 650', () => {
    const result = EligibilityEngine.evaluate({ ...baseFacts, creditScore: 649 });
    expect(result.decision).toBe('NOT_ELIGIBLE');
    expect(result.reasons.some(r => r.includes('Credit score (649) is below the minimum'))).toBe(true);
  });

  it('should evaluate exactly 650 credit score as PARTIALLY_ELIGIBLE', () => {
    const result = EligibilityEngine.evaluate({ ...baseFacts, creditScore: 650 });
    expect(result.decision).toBe('PARTIALLY_ELIGIBLE');
  });

  it('should evaluate exactly 699 credit score as PARTIALLY_ELIGIBLE', () => {
    const result = EligibilityEngine.evaluate({ ...baseFacts, creditScore: 699 });
    expect(result.decision).toBe('PARTIALLY_ELIGIBLE');
  });

  it('should evaluate exactly 700 credit score as ELIGIBLE', () => {
    const result = EligibilityEngine.evaluate({ ...baseFacts, creditScore: 700 });
    expect(result.decision).toBe('ELIGIBLE');
  });

  it('should return NOT_ELIGIBLE if existing EMI >= 50% of income', () => {
    const result = EligibilityEngine.evaluate({ ...baseFacts, existingEmiObligations: 25000 });
    expect(result.decision).toBe('NOT_ELIGIBLE');
    expect(result.reasons.some(r => r.includes('exceed or equal 50%'))).toBe(true);
  });

  it('should return PARTIALLY_ELIGIBLE if requested amount exceeds max eligible amount but within absolute limits', () => {
    const result = EligibilityEngine.evaluate({ ...baseFacts, requestedAmount: 5000000 }); // 50 Lakhs
    expect(result.decision).toBe('PARTIALLY_ELIGIBLE');
    // For 50k income, max EMI = 25k - 10k = 15k
    // PV of 15k @ 12% for 60m is ~6.74 Lakhs
    expect(result.maxEligibleAmount).toBeLessThan(5000000);
    expect(result.maxEligibleAmount).toBeGreaterThan(600000);
    expect(result.reasons.some(r => r.includes('exceeds maximum eligible amount'))).toBe(true);
  });

  it('should return NOT_ELIGIBLE if requested amount exceeds the absolute maximum loan limit', () => {
    const result = EligibilityEngine.evaluate({ ...baseFacts, requestedAmount: 200000000 }); // 20 Crores
    expect(result.decision).toBe('NOT_ELIGIBLE');
    expect(result.reasons.some(r => r.includes('exceeds the maximum loan limit'))).toBe(true);
  });

  it('should correctly calculate deterministic PV and EMI', () => {
    const emi = EligibilityEngine.calculateEMI(100000, 0.12, 60);
    expect(emi).toBe(2224.44);

    const pv = EligibilityEngine.calculatePV(2224.44, 0.12, 60);
    // Should be close to 100000
    expect(Math.round(pv)).toBe(100000);
  });

  it('should return NOT_ELIGIBLE if DTI threshold forces maxEligibleAmount <= 0', () => {
    const result = EligibilityEngine.evaluate({ 
      ...baseFacts, 
      existingEmiObligations: 26000 // 52% of income
    });
    expect(result.decision).toBe('NOT_ELIGIBLE');
    expect(result.calculatedDti).toBe(52);
  });
});

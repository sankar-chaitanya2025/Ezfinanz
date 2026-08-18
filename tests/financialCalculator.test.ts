import { describe, it, expect } from 'vitest';
import { FinancialCalculator } from '../src/domain/financialCalculator';

describe('FinancialCalculator - Pure Math', () => {
  it('should calculate EMI accurately and round to 2 decimals', () => {
    // 1 Lakh at 12% for 12 months -> EMI is ~8884.88
    const emi = FinancialCalculator.calculateEMI(100000, 0.12, 12);
    expect(emi).toBe(8884.88);
  });

  it('should generate terms correctly according to defined rules', () => {
    const request = {
      finalAmount: 100000,
      tenure: 12,
      annualInterestRate: 0.12,
    };
    const terms = FinancialCalculator.generateTerms(request);
    
    // PF = 2% of 100k = 2000
    expect(terms.processingFee).toBe(2000);
    // GST = 18% of 2000 = 360
    expect(terms.gst).toBe(360);
    // totalCharges = 2000 + 360 = 2360
    expect(terms.totalCharges).toBe(2360);
    // netDisbursement = 100k - 2360 = 97640
    expect(terms.netDisbursement).toBe(97640);
    
    // EMI = 8884.88
    expect(terms.emi).toBe(8884.88);
    
    // totalRepayment = 8884.88 * 12 = 106618.56
    expect(terms.totalRepayment).toBe(106618.56);
    
    // totalInterest = 106618.56 - 100000 = 6618.56
    expect(terms.totalInterest).toBe(6618.56);

    // IRR calculation
    // Monthly cash flows: Month 0: -97640, Months 1..12: +8884.88
    // Using an external IRR calc for verification:
    // Rate that sets NPV=0 -> r is approx 1.341% monthly -> 16.09% annual
    expect(terms.irr).toBeGreaterThan(0.16);
    expect(terms.irr).toBeLessThanOrEqual(0.17);
  });

  it('should enforce strictly allowed tenures', () => {
    expect(() => FinancialCalculator.generateTerms({
      finalAmount: 100000,
      tenure: 15, // Invalid
      annualInterestRate: 0.12,
    })).toThrowError('Tenure must be one of: 12, 24, 36, 48, 60 months');
  });

  it('should enforce strictly positive finalAmount', () => {
    expect(() => FinancialCalculator.generateTerms({
      finalAmount: 0,
      tenure: 12,
      annualInterestRate: 0.12,
    })).toThrowError('Final amount must be greater than 0');
    
    expect(() => FinancialCalculator.generateTerms({
      finalAmount: -50000,
      tenure: 12,
      annualInterestRate: 0.12,
    })).toThrowError('Final amount must be greater than 0');
  });

  it('should handle deterministic repeated calculations', () => {
    const request = {
      finalAmount: 500000,
      tenure: 60,
      annualInterestRate: 0.12,
    };
    const t1 = FinancialCalculator.generateTerms(request);
    const t2 = FinancialCalculator.generateTerms(request);
    
    expect(t1).toEqual(t2);
  });
});

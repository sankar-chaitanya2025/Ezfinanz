export interface LoanTermsRequest {
  finalAmount: number;
  tenure: number; // in months
  annualInterestRate: number; // e.g. 0.12 for 12%
}

export interface LoanTermsData {
  finalAmount: number;
  tenure: number;
  interestRate: number;
  emi: number;
  processingFee: number;
  gst: number;
  totalCharges: number;
  totalInterest: number;
  totalRepayment: number;
  netDisbursement: number;
  irr: number; // Annualized IRR
}

export class FinancialCalculator {
  private static readonly PROCESSING_FEE_RATE = 0.02; // 2%
  private static readonly GST_RATE = 0.18; // 18% on PF

  /**
   * Helper to strictly round to 2 decimal places half-up
   */
  public static round(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calculates the EMI using standard reducing-balance formula:
   * E = P * r * (1+r)^n / ((1+r)^n - 1)
   */
  public static calculateEMI(principal: number, annualRate: number, months: number): number {
    if (principal <= 0 || months <= 0) return 0;
    if (annualRate === 0) return this.round(principal / months);
    
    const monthlyRate = annualRate / 12;
    const num = principal * monthlyRate * Math.pow(1 + monthlyRate, months);
    const den = Math.pow(1 + monthlyRate, months) - 1;
    return this.round(num / den);
  }

  /**
   * Calculates Periodic IRR given initial outflow and standard monthly inflows.
   * IRR is the monthly discount rate 'r' that makes NPV = 0.
   * Then annualized IRR = r * 12.
   * 
   * NPV(r) = -netDisbursement + Sum_{t=1}^n [ EMI / (1+r)^t ]
   * Since inflows are equal, this simplifies to the annuity PV formula:
   * netDisbursement = EMI * [ 1 - (1+r)^-n ] / r
   */
  public static calculateIRR(netDisbursement: number, emi: number, tenure: number): number {
    if (netDisbursement <= 0 || emi <= 0 || tenure <= 0) return 0;
    if (netDisbursement >= emi * tenure) return 0;

    // Use Newton-Raphson or Bisection method to find 'r'
    let low = 0.0;
    let high = 1.0; // 100% monthly rate as upper bound
    let r = 0.01; // initial guess 1%
    const tolerance = 1e-6;
    let iterations = 0;
    
    // Bisection method for stability
    while (high - low > tolerance && iterations < 1000) {
      r = (low + high) / 2;
      // PV of annuity
      const currentPV = emi * (1 - Math.pow(1 + r, -tenure)) / r;
      
      if (currentPV > netDisbursement) {
        // PV is too high -> rate is too low
        low = r;
      } else {
        // PV is too low -> rate is too high
        high = r;
      }
      iterations++;
    }
    
    // Annualize and return as decimal (e.g. 0.125 for 12.5%)
    return this.round(r * 12 * 100) / 100; // Returns rounded decimal rate, e.g. 0.13 for 13%
    // Wait, let's keep IRR as a percentage (e.g. 13.5) for consistency with how we show DTI?
    // The requirement says "applicable IRR". We'll return it as a decimal rate (e.g. 0.135 -> 13.5%) to match annualInterestRate.
  }

  public static generateTerms(request: LoanTermsRequest): LoanTermsData {
    if (request.finalAmount <= 0) {
      throw new Error("Final amount must be greater than 0");
    }
    if (![12, 24, 36, 48, 60].includes(request.tenure)) {
      throw new Error("Tenure must be one of: 12, 24, 36, 48, 60 months");
    }

    const emi = this.calculateEMI(request.finalAmount, request.annualInterestRate, request.tenure);
    const processingFee = this.round(request.finalAmount * this.PROCESSING_FEE_RATE);
    const gst = this.round(processingFee * this.GST_RATE);
    const totalCharges = this.round(processingFee + gst);
    
    const totalRepayment = this.round(emi * request.tenure);
    const totalInterest = this.round(totalRepayment - request.finalAmount);
    const netDisbursement = this.round(request.finalAmount - totalCharges);

    const irr = this.calculateIRR(netDisbursement, emi, request.tenure);

    return {
      finalAmount: this.round(request.finalAmount),
      tenure: request.tenure,
      interestRate: request.annualInterestRate,
      emi,
      processingFee,
      gst,
      totalCharges,
      totalInterest,
      totalRepayment,
      netDisbursement,
      irr: this.round(irr) // Rounding to 2 decimal places (e.g. 0.14)
    };
  }
}

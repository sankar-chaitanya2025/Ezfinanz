export interface BankVerificationResult {
  status: 'VERIFIED' | 'FAILED';
  providerReference: string;
}

export class MockBankProvider {
  /**
   * Simulates a bank account verification.
   * Deterministic mock: Returns FAILED if accountNumber ends with '000', otherwise VERIFIED.
   */
  static async verifyAccount(accountNumber: string, ifscCode: string, accountHolderName: string): Promise<BankVerificationResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const providerReference = `MOCK-BANK-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    if (accountNumber.endsWith('000')) {
      return { status: 'FAILED', providerReference };
    }

    return { status: 'VERIFIED', providerReference };
  }
}

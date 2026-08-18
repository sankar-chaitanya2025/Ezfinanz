export interface SelfieVerificationResult {
  status: 'VERIFIED' | 'FAILED';
  providerReference: string;
}

export class MockSelfieProvider {
  /**
   * Simulates a selfie liveness/face match verification based on an uploaded image path.
   * Deterministic mock: Returns FAILED if the path contains 'blur' or 'invalid', otherwise VERIFIED.
   */
  static async verifySelfie(storagePath: string): Promise<SelfieVerificationResult> {
    // Simulate network delay and processing time
    await new Promise(resolve => setTimeout(resolve, 800));

    const providerReference = `MOCK-SELFIE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    if (storagePath.toLowerCase().includes('blur') || storagePath.toLowerCase().includes('invalid')) {
      return { status: 'FAILED', providerReference };
    }

    return { status: 'VERIFIED', providerReference };
  }
}

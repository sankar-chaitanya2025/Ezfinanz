import { db } from '@/db'
import { applications, bankDetails, auditLogs } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { MockBankProvider } from '@/providers/mockBankProvider'
import { ApplicationService } from '@/services/applicationService'

export class BankVerificationService {
  /**
   * Validates inputs, calls mock provider, and persists the bank snapshot.
   */
  static async verifyBank(applicationId: string, userId: string, accountNumber: string, ifscCode: string, accountHolderName: string) {
    // 1. Validate application ownership and state
    const [app] = await db.select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1)

    if (!app) {
      throw new Error('Application not found or unauthorized')
    }

    if (app.status !== 'TERMS_SELECTED') {
      throw new Error(`Cannot perform bank verification from state: ${app.status}`)
    }

    // 2. Validate Bank Inputs
    const accountRegex = /^\d{9,18}$/;
    if (!accountRegex.test(accountNumber)) {
      throw new Error('Account number must be between 9 and 18 digits.');
    }

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifscCode)) {
      throw new Error('Invalid IFSC code format.');
    }

    if (!accountHolderName || accountHolderName.trim().length === 0) {
      throw new Error('Account holder name is required.');
    }

    // 3. Mask account number for safe persistence
    const maskLength = Math.max(0, accountNumber.length - 4);
    const accountNumberMasked = 'X'.repeat(maskLength) + accountNumber.slice(-4);

    // 4. Call external mock provider (outside of DB transaction)
    const result = await MockBankProvider.verifyAccount(accountNumber, ifscCode, accountHolderName);

    // 5. Perform the atomic database write and state transition
    await db.transaction(async (tx) => {
      // Upsert bank details
      await tx.insert(bankDetails).values({
        applicationId,
        accountNumberMasked,
        ifscCode,
        accountHolderName: accountHolderName.trim(),
        verificationStatus: result.status
      }).onConflictDoUpdate({
        target: bankDetails.applicationId,
        set: {
          accountNumberMasked,
          ifscCode,
          accountHolderName: accountHolderName.trim(),
          verificationStatus: result.status
        }
      });

      if (result.status === 'VERIFIED') {
        // Transition state to BANK_VERIFIED
        await ApplicationService.transitionState(applicationId, 'BANK_VERIFIED', userId, 'Bank account successfully verified', tx);
      } else {
        // Log failure but remain in TERMS_SELECTED
        await tx.insert(auditLogs).values({
          applicationId,
          action: 'BANK_VERIFICATION_FAILED',
          previousStatus: 'TERMS_SELECTED',
          newStatus: 'TERMS_SELECTED',
          actionBy: userId,
          notes: 'Bank verification failed by provider'
        });
      }
    });

    return { status: result.status };
  }
}

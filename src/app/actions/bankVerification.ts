'use server'

import { createClient } from '@/utils/supabase/server'
import { BankVerificationService } from '@/services/bankVerificationService'
import { revalidatePath } from 'next/cache'

export async function submitBankVerificationAction(applicationId: string, formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const accountNumber = formData.get('accountNumber') as string;
    const ifscCode = formData.get('ifscCode') as string;
    const accountHolderName = formData.get('accountHolderName') as string;

    if (!accountNumber || !ifscCode || !accountHolderName) {
      throw new Error('All fields are required');
    }

    const result = await BankVerificationService.verifyBank(
      applicationId,
      user.id,
      accountNumber,
      ifscCode.toUpperCase(),
      accountHolderName
    );

    revalidatePath('/dashboard');
    return { success: true, result };
  } catch (error: unknown) {
    console.error('Bank verification error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return { success: false, error: message };
  }
}

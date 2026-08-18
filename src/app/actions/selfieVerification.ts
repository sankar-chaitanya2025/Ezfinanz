'use server'

import { createClient } from '@/utils/supabase/server'
import { SelfieVerificationService } from '@/services/selfieVerificationService'
import { revalidatePath } from 'next/cache'

export async function submitSelfieAction(applicationId: string, formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const file = formData.get('selfie') as File;
    if (!file) {
      throw new Error('Selfie image is required');
    }

    const result = await SelfieVerificationService.uploadAndVerifySelfie(
      applicationId,
      user.id,
      file
    );

    revalidatePath('/dashboard');
    return { success: true, result };
  } catch (error: any) {
    console.error('Selfie verification error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

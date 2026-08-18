'use server'

import { createClient } from '@/utils/supabase/server'
import { DeclarationService } from '@/services/declarationService'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

export async function submitDeclarationAction(applicationId: string) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const headersList = await headers()
    const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || undefined;

    await DeclarationService.acceptDeclaration(
      applicationId,
      user.id,
      ipAddress
    );

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    console.error('Declaration error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

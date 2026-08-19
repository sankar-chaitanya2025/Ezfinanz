'use server'

import { createClient } from '@/utils/supabase/server'
import { EligibilityService } from '@/services/eligibilityService'
import { revalidatePath } from 'next/cache'

export async function evaluateEligibilityAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const applicationId = formData.get('applicationId') as string

  if (!applicationId) {
    return { error: 'Missing application ID' }
  }

  try {
    await EligibilityService.evaluateEligibility(applicationId, user.id)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Unknown error occurred' }
  }
}

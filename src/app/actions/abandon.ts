'use server'

import { createClient } from '@/utils/supabase/server'
import { db } from '@/db'
import { ApplicationService } from '@/services/applicationService'
import { revalidatePath } from 'next/cache'

export async function abandonApplicationAction(applicationId: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  try {
    await db.transaction(async (tx) => {
      await ApplicationService.transitionState(
        applicationId,
        'REJECTED',
        user.id,
        'User explicitly abandoned application due to hard eligibility blockers',
        tx
      )
    })
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to abandon application' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

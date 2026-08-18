'use server'

import { ApplicationService } from '@/services/applicationService'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createApplicationAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    await ApplicationService.createApplication(user.id)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Unknown error occurred' }
  }
}

'use server'

import { ApplicationService } from '@/services/applicationService'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createApplicationAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const requestedAmountStr = formData.get('requestedAmount') as string
  const requestedTenureStr = formData.get('requestedTenure') as string

  const requestedAmount = requestedAmountStr ? parseFloat(requestedAmountStr) : undefined
  const requestedTenure = requestedTenureStr ? parseInt(requestedTenureStr, 10) : undefined

  try {
    await ApplicationService.createApplication(user.id, requestedAmount, requestedTenure)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Unknown error occurred' }
  }
}

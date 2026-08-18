'use server'

import { createClient } from '@/utils/supabase/server'
import { LoanTermsService } from '@/services/loanTermsService'
import { revalidatePath } from 'next/cache'

export async function generateAndAcceptTermsAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const applicationId = formData.get('applicationId') as string
  const requestedAmountStr = formData.get('requestedAmount') as string
  const requestedTenureStr = formData.get('requestedTenure') as string

  if (!applicationId || !requestedAmountStr || !requestedTenureStr) {
    return { error: 'Missing required fields' }
  }

  const requestedAmount = parseFloat(requestedAmountStr)
  const requestedTenure = parseInt(requestedTenureStr, 10)

  if (isNaN(requestedAmount) || isNaN(requestedTenure)) {
    return { error: 'Invalid numerical inputs' }
  }

  try {
    await LoanTermsService.generateAndAcceptTerms(applicationId, user.id, requestedAmount, requestedTenure)
    revalidatePath('/dashboard')
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Unknown error occurred' }
  }
}

'use server'

import { createClient } from '@/utils/supabase/server'
import { FinancialService } from '@/services/financialService'
import { revalidatePath } from 'next/cache'

export async function submitFinancialsAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { error: 'Not authenticated' }
  }

  const applicationId = formData.get('applicationId') as string
  const employmentType = formData.get('employmentType') as 'SALARIED' | 'SELF_EMPLOYED'
  const employerName = formData.get('employerName') as string
  const designation = formData.get('designation') as string
  const monthlyIncome = parseFloat(formData.get('monthlyIncome') as string)

  if (!applicationId || !employmentType || !employerName || !designation || isNaN(monthlyIncome)) {
    return { error: 'Missing required fields' }
  }

  try {
    await FinancialService.submitFinancials(applicationId, user.id, {
      employmentType,
      employerName,
      designation,
      monthlyIncome
    })
    
    revalidatePath('/dashboard')
    
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Unknown error occurred' }
  }
}

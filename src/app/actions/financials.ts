'use server'

import { createClient } from '@/utils/supabase/server'
import { FinancialService } from '@/services/financialService'
import { db } from '@/db'
import { applications } from '@/db/schema'
import { eq } from 'drizzle-orm'
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

  // Handle NOT_ELIGIBLE correction loop: update requestedAmount/Tenure if provided
  const correctedAmountStr = formData.get('correctedRequestedAmount') as string | null
  const correctedTenureStr = formData.get('correctedRequestedTenure') as string | null

  if (correctedAmountStr || correctedTenureStr) {
    const updates: Record<string, string | number> = {}
    if (correctedAmountStr) {
      const correctedAmount = parseFloat(correctedAmountStr)
      if (isNaN(correctedAmount) || correctedAmount <= 0) {
        return { error: 'Corrected requested amount must be a positive number' }
      }
      updates.requestedAmount = correctedAmountStr
    }
    if (correctedTenureStr) {
      const correctedTenure = parseInt(correctedTenureStr, 10)
      if (isNaN(correctedTenure) || correctedTenure <= 0) {
        return { error: 'Corrected requested tenure must be a positive number' }
      }
      updates.requestedTenure = correctedTenure
    }

    try {
      await db.update(applications)
        .set(updates)
        .where(eq(applications.id, applicationId))
    } catch (error) {
      if (error instanceof Error) {
        return { error: `Failed to update requested amount: ${error.message}` }
      }
      return { error: 'Failed to update requested amount' }
    }
  }

  try {
    await FinancialService.submitFinancials(applicationId, user.id, {
      employmentType,
      employerName,
      designation,
      monthlyIncome
    })
    
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Unknown error occurred' }
  }
}

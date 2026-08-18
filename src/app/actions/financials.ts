'use server'

import { createClient } from '@/utils/supabase/server'
import { FinancialService } from '@/services/financialService'
import { EligibilityService } from '@/services/eligibilityService'
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

  // Step 1: Submit financials — transitions to FINANCIALS_COMPLETED
  try {
    await FinancialService.submitFinancials(applicationId, user.id, {
      employmentType,
      employerName,
      designation,
      monthlyIncome
    })
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Failed to submit financial details' }
  }

  // Step 2: Immediately run eligibility evaluation — transitions to ELIGIBLE / PARTIALLY_ELIGIBLE / NOT_ELIGIBLE
  // This removes the confusing two-button flow from the UI.
  try {
    await EligibilityService.evaluateEligibility(applicationId, user.id)
  } catch (error) {
    // Financials were saved. Log the issue but don't block the user.
    // The "Run Eligibility Engine" button on FINANCIALS_COMPLETED is a fallback.
    console.error('[submitFinancialsAction] Auto-eligibility evaluation failed:', error)
  }

  revalidatePath('/dashboard')
  return { success: true }
}

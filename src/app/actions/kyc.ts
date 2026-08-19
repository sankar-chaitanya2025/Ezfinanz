'use server'

import { createClient } from '@/utils/supabase/server'
import { KycService } from '@/services/kycService'
import { idTypeEnum } from '@/db/schema'
import { revalidatePath } from 'next/cache'

type IdType = typeof idTypeEnum.enumValues[number]

export async function submitKycAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const applicationId = formData.get('applicationId') as string
  const idType = formData.get('idType') as IdType
  const idNumber = formData.get('idNumber') as string
  const fullName = formData.get('fullName') as string

  if (!applicationId || !idType || !idNumber) {
    return { error: 'Missing required fields' }
  }

  try {
    const result = await KycService.submitKyc(applicationId, user.id, idType, idNumber, fullName)
    revalidatePath('/dashboard')
    
    if (result.status === 'FAILED') {
      return { error: 'KYC Verification Failed. Please check your ID and try again.' }
    }
    
    return { success: true }
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: 'Unknown error occurred' }
  }
}

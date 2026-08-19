'use server'

import { createClient } from '@/utils/supabase/server'
import { AdminService } from '@/services/adminService'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Ensures the authenticated user is an ADMIN.
 */
async function enforceAdminRole() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Not authenticated')
  }

  const [profile] = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
  
  if (!profile || profile.role !== 'ADMIN') {
    throw new Error('Unauthorized: Admin access required')
  }

  return user.id
}

export async function claimApplicationAction(applicationId: string) {
  try {
    const adminUserId = await enforceAdminRole()
    await AdminService.claimApplication(applicationId, adminUserId)
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred'
    return { error: message }
  }
}

export async function approveApplicationAction(applicationId: string) {
  try {
    const adminUserId = await enforceAdminRole()
    await AdminService.approveApplication(applicationId, adminUserId)
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred'
    return { error: message }
  }
}

export async function rejectApplicationAction(applicationId: string, formData: FormData) {
  try {
    const adminUserId = await enforceAdminRole()
    const reason = formData.get('reason') as string | undefined
    await AdminService.rejectApplication(applicationId, adminUserId, reason)
    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred'
    return { error: message }
  }
}

/**
 * Development-only action to promote current user to ADMIN.
 */
export async function promoteToAdminAction() {
  if (process.env.NODE_ENV !== 'development') {
    return { error: 'This action is only available in development mode.' }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    await db.update(users)
      .set({ role: 'ADMIN' })
      .where(eq(users.id, user.id))

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred'
    return { error: message }
  }
}

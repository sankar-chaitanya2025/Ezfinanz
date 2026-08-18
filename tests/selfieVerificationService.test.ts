import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { db } from '@/db'
import { applications, users, selfieVerifications } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { SelfieVerificationService } from '@/services/selfieVerificationService'
import { clearDatabase, getTestUser } from './setup'
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

// Mock Supabase
vi.mock('@/utils/supabase/server', () => {
  return {
    createClient: vi.fn()
  }
})

describe('SelfieVerificationService', () => {
  let userId: string
  let appId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: { storage: { from: any; upload: any } }

  beforeEach(async () => {
    await clearDatabase()
    
    const user = await getTestUser()
    userId = user.id

    const [app] = await db.insert(applications).values({
      userId,
      status: 'DECLARATION_ACCEPTED',
      requestedAmount: '10000',
      requestedTenure: 12
    }).returning()
    appId = app.id

    // Setup mock supabase return value
    mockSupabase = {
      storage: {
        from: vi.fn().mockReturnThis(),
        upload: vi.fn().mockResolvedValue({ error: null })
      }
    }
    
    const { createClient } = await import('@/utils/supabase/server')
    ;(createClient as Mock).mockResolvedValue(mockSupabase)
  })

  it('should successfully upload, verify selfie, and transition to SUBMITTED', async () => {
    // Create a dummy File object
    const file = new File(['dummy content'], 'selfie.png', { type: 'image/png' })
    
    const result = await SelfieVerificationService.uploadAndVerifySelfie(appId, userId, file)
    expect(result.status).toBe('VERIFIED')

    // Verify Supabase upload was called
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('kyc-documents')
    expect(mockSupabase.storage.upload).toHaveBeenCalled()

    const [updatedApp] = await db.select().from(applications).where(eq(applications.id, appId))
    expect(updatedApp.status).toBe('SUBMITTED')

    const [selfie] = await db.select().from(selfieVerifications).where(eq(selfieVerifications.applicationId, appId))
    expect(selfie).toBeDefined()
    expect(selfie.verificationStatus).toBe('VERIFIED')
    expect(selfie.storagePath).toContain('selfie_')
    expect(selfie.reviewerId).toBeNull()
  }, 10000)

  it('should block if state is not DECLARATION_ACCEPTED or SELFIE_PENDING', async () => {
    await db.update(applications).set({ status: 'TERMS_SELECTED' }).where(eq(applications.id, appId))
    const file = new File(['dummy content'], 'selfie.png', { type: 'image/png' })

    await expect(
      SelfieVerificationService.uploadAndVerifySelfie(appId, userId, file)
    ).rejects.toThrow(/Cannot submit selfie from state/)
  }, 10000)

  it('should fail if file size is > 5MB', async () => {
    // Create a 6MB dummy file
    const largeContent = new Array(6 * 1024 * 1024).fill('a').join('')
    const file = new File([largeContent], 'large.png', { type: 'image/png' })

    await expect(
      SelfieVerificationService.uploadAndVerifySelfie(appId, userId, file)
    ).rejects.toThrow(/File size exceeds 5MB limit/)
  }, 10000)

  it('should fail if file is not an image', async () => {
    const file = new File(['dummy content'], 'doc.pdf', { type: 'application/pdf' })

    await expect(
      SelfieVerificationService.uploadAndVerifySelfie(appId, userId, file)
    ).rejects.toThrow(/Only image files are allowed/)
  }, 10000)

  it('should handle mock verification failure and transition to SELFIE_PENDING', async () => {
    // If the file name implies a blur, the mock provider will fail it
    const file = new File(['dummy content'], 'blur_selfie.png', { type: 'image/png' })
    
    const result = await SelfieVerificationService.uploadAndVerifySelfie(appId, userId, file)
    expect(result.status).toBe('FAILED')

    const [updatedApp] = await db.select().from(applications).where(eq(applications.id, appId))
    expect(updatedApp.status).toBe('SELFIE_PENDING')

    const [selfie] = await db.select().from(selfieVerifications).where(eq(selfieVerifications.applicationId, appId))
    expect(selfie.verificationStatus).toBe('FAILED')
  }, 10000)
})

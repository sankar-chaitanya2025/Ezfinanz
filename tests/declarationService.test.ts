import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import { applications, users, declarations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { DeclarationService } from '@/services/declarationService'
import { clearDatabase, getTestUser } from './setup'
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

describe('DeclarationService', () => {
  let userId: string
  let appId: string

  beforeEach(async () => {
    await clearDatabase()
    
    // Create test user
    const user = await getTestUser()
    userId = user.id

    // Create application and move to BANK_VERIFIED
    const [app] = await db.insert(applications).values({
      userId,
      status: 'BANK_VERIFIED',
      requestedAmount: '10000',
      requestedTenure: 12
    }).returning()
    appId = app.id
  })

  it('should successfully accept declaration and transition state', async () => {
    const result = await DeclarationService.acceptDeclaration(appId, userId, '192.168.1.1')
    expect(result.success).toBe(true)

    const [updatedApp] = await db.select().from(applications).where(eq(applications.id, appId))
    expect(updatedApp.status).toBe('DECLARATION_ACCEPTED')

    const [declaration] = await db.select().from(declarations).where(eq(declarations.applicationId, appId))
    expect(declaration).toBeDefined()
    expect(declaration.consentText).toBe(DeclarationService.getConsentText())
    expect(declaration.ipAddress).toBe('192.168.1.1')
    expect(declaration.acceptedAt).toBeDefined()
  })

  it('should block acceptance if state is not BANK_VERIFIED', async () => {
    // Transition to TERMS_SELECTED directly
    await db.update(applications).set({ status: 'TERMS_SELECTED' }).where(eq(applications.id, appId))

    await expect(
      DeclarationService.acceptDeclaration(appId, userId)
    ).rejects.toThrow(/Cannot accept declaration from state/)
  })

  it('should block if user does not own application', async () => {
    const otherUser = await getTestUser()

    await expect(
      DeclarationService.acceptDeclaration(appId, otherUser.id)
    ).rejects.toThrow(/Application not found or unauthorized/)
  })
})

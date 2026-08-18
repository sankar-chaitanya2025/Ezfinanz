import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '@/db'
import { applications, users, bankDetails } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { BankVerificationService } from '@/services/bankVerificationService'
import { ApplicationService } from '@/services/applicationService'
import { clearDatabase, getTestUser } from './setup'
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

describe('BankVerificationService', () => {
  let userId: string
  let appId: string

  beforeEach(async () => {
    await clearDatabase()
    
    // Create test user
    const user = await getTestUser()
    userId = user.id

    // Create application and move to TERMS_SELECTED
    const [app] = await db.insert(applications).values({
      userId,
      status: 'TERMS_SELECTED',
      requestedAmount: '10000',
      requestedTenure: 12
    }).returning()
    appId = app.id
  })

  it('should successfully verify a valid bank account and transition state', async () => {
    const result = await BankVerificationService.verifyBank(
      appId,
      userId,
      '123456789012',
      'HDFC0001234',
      'John Doe'
    )

    expect(result.status).toBe('VERIFIED')

    const [updatedApp] = await db.select().from(applications).where(eq(applications.id, appId))
    expect(updatedApp.status).toBe('BANK_VERIFIED')

    const [bank] = await db.select().from(bankDetails).where(eq(bankDetails.applicationId, appId))
    expect(bank).toBeDefined()
    expect(bank.accountNumberMasked).toBe('XXXXXXXX9012') // last 4 visible
    expect(bank.ifscCode).toBe('HDFC0001234')
  })

  it('should block verification if state is not TERMS_SELECTED', async () => {
    // Transition to DRAFT directly
    await db.update(applications).set({ status: 'DRAFT' }).where(eq(applications.id, appId))

    await expect(
      BankVerificationService.verifyBank(appId, userId, '123456789012', 'HDFC0001234', 'John Doe')
    ).rejects.toThrow(/Cannot perform bank verification from state/)
  })

  it('should fail verification if mock returns FAILED (ends with 000)', async () => {
    const result = await BankVerificationService.verifyBank(
      appId,
      userId,
      '123456789000',
      'HDFC0001234',
      'John Doe'
    )

    expect(result.status).toBe('FAILED')

    const [updatedApp] = await db.select().from(applications).where(eq(applications.id, appId))
    expect(updatedApp.status).toBe('TERMS_SELECTED') // State does not progress
    
    const [bank] = await db.select().from(bankDetails).where(eq(bankDetails.applicationId, appId))
    expect(bank.verificationStatus).toBe('FAILED')
  })

  it('should fail on invalid account number format', async () => {
    await expect(
      BankVerificationService.verifyBank(appId, userId, '123', 'HDFC0001234', 'John Doe')
    ).rejects.toThrow(/Account number must be between 9 and 18 digits/)
  })

  it('should fail on invalid IFSC code format', async () => {
    await expect(
      BankVerificationService.verifyBank(appId, userId, '123456789012', 'INVALID', 'John Doe')
    ).rejects.toThrow(/Invalid IFSC code format/)
  })

  it('should fail if user does not own application', async () => {
    const otherUser = await getTestUser()

    await expect(
      BankVerificationService.verifyBank(appId, otherUser.id, '123456789012', 'HDFC0001234', 'John Doe')
    ).rejects.toThrow(/Application not found or unauthorized/)
  })
})

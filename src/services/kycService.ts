import { db } from '@/db'
import { applications, kycDetails, auditLogs, idTypeEnum } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { hashIdNumber, maskIdNumber } from '@/lib/pii'
import { MockDigiLockerProvider } from '@/providers/mockDigiLockerProvider'
import { ApplicationService } from '@/services/applicationService'

type IdType = typeof idTypeEnum.enumValues[number]

export class KycService {
  /**
   * Processes a KYC submission.
   * Ensures the identity is not used by another user.
   * Updates application state based on the provider result.
   */
  static async submitKyc(applicationId: string, userId: string, idType: IdType, plainIdNumber: string) {
    // 1. Verify ownership and state
    const [app] = await db.select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1)

    if (!app) {
      throw new Error('Application not found or unauthorized')
    }

    if (app.status !== 'DRAFT' && app.status !== 'KYC_PENDING') {
      throw new Error('Application is not in a valid state to initiate KYC')
    }

    // Move to KYC_PENDING if in DRAFT
    if (app.status === 'DRAFT') {
      await ApplicationService.transitionState(applicationId, 'KYC_PENDING', userId)
    }

    // 2. Hash and mask
    const idHash = hashIdNumber(plainIdNumber)
    const idMasked = maskIdNumber(plainIdNumber, idType)

    // 3. Call the external provider (DO NOT hold a DB transaction during network call)
    const kycResult = await MockDigiLockerProvider.verifyId(idType, plainIdNumber)

    // 4. Perform the transactional deduplication and write
    await db.transaction(async (tx) => {
      // Deduplication check: Has this verified identity been used by a DIFFERENT user?
      const existingIdentities = await tx.select({ ownerUserId: applications.userId })
        .from(kycDetails)
        .innerJoin(applications, eq(kycDetails.applicationId, applications.id))
        .where(
          and(
            eq(kycDetails.idType, idType),
            eq(kycDetails.idNumberHash, idHash),
            eq(kycDetails.verificationStatus, 'VERIFIED'),
            ne(applications.userId, userId)
          )
        )
        .limit(1)

      if (existingIdentities.length > 0) {
        throw new Error('Identity already verified by another user account.')
      }

      // Upsert the KYC record using the unique applicationId constraint
      await tx.insert(kycDetails)
        .values({
          applicationId,
          idType,
          idNumberMasked: idMasked,
          idNumberHash: idHash,
          fullName: kycResult.fullName || '',
          dob: kycResult.dob || '1970-01-01', // Default placeholder if missing
          gender: kycResult.gender || 'OTHER',
          address: kycResult.address || '',
          provider: 'MOCK_DIGILOCKER',
          providerReference: kycResult.providerReference,
          verificationStatus: kycResult.status
        })
        .onConflictDoUpdate({
          target: kycDetails.applicationId,
          set: {
            idType,
            idNumberMasked: idMasked,
            idNumberHash: idHash,
            fullName: kycResult.fullName || '',
            dob: kycResult.dob || '1970-01-01',
            gender: kycResult.gender || 'OTHER',
            address: kycResult.address || '',
            provider: 'MOCK_DIGILOCKER',
            providerReference: kycResult.providerReference,
            verificationStatus: kycResult.status
          }
        })
    })

    // 5. Update application state if successful
    if (kycResult.status === 'VERIFIED') {
      await ApplicationService.transitionState(applicationId, 'KYC_COMPLETED', userId)
    } else {
      // If failed, create an audit log to record the failure, but state remains KYC_PENDING
      await db.insert(auditLogs).values({
        applicationId,
        action: 'KYC_FAILED',
        previousStatus: 'KYC_PENDING',
        newStatus: 'KYC_PENDING',
        actionBy: userId,
        notes: 'KYC verification failed by provider'
      })
    }

    return { status: kycResult.status }
  }
}

import { db } from '@/db'
import { applications, selfieVerifications, auditLogs } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { MockSelfieProvider } from '@/providers/mockSelfieProvider'
import { ApplicationService } from '@/services/applicationService'
import { createClient } from '@/utils/supabase/server'

export class SelfieVerificationService {
  private static readonly BUCKET_NAME = 'kyc-documents';

  /**
   * 1. Validates state
   * 2. Uploads the image to Supabase Storage
   * 3. Calls MockSelfieProvider
   * 4. Persists the storagePath and status in DB
   * 5. Transitions state to SELFIE_PENDING then SUBMITTED
   */
  static async uploadAndVerifySelfie(applicationId: string, userId: string, file: File) {
    // 1. Validate application ownership and state
    const [app] = await db.select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1)

    if (!app) {
      throw new Error('Application not found or unauthorized')
    }

    if (app.status !== 'DECLARATION_ACCEPTED' && app.status !== 'SELFIE_PENDING') {
      throw new Error(`Cannot submit selfie from state: ${app.status}`)
    }

    // 2. Validate File
    if (file.size > 5 * 1024 * 1024) { // 5MB max
      throw new Error('File size exceeds 5MB limit');
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('Only image files are allowed');
    }

    // 3. Upload to Supabase Storage (Outside of DB transaction!)
    const supabase = await createClient();
    const fileExtension = file.name.split('.').pop();
    const baseName = file.name.split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '');
    const storagePath = `${userId}/${applicationId}/selfie_${baseName}_${Date.now()}.${fileExtension}`;
    
    const { error: uploadError } = await supabase.storage
      .from(this.BUCKET_NAME)
      .upload(storagePath, file, {
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload selfie: ${uploadError.message}`);
    }

    // 4. Call external mock provider
    const result = await MockSelfieProvider.verifySelfie(storagePath);

    // 5. Perform the atomic database write and state transition
    await db.transaction(async (tx) => {
      // Upsert selfie verification record
      await tx.insert(selfieVerifications).values({
        applicationId,
        storagePath,
        verificationStatus: result.status
      }).onConflictDoUpdate({
        target: selfieVerifications.applicationId,
        set: {
          storagePath,
          verificationStatus: result.status,
          // Clear previous reviewer fields since it's a new submission
          reviewerId: null,
          reviewTimestamp: null
        }
      });

      if (app.status === 'DECLARATION_ACCEPTED') {
         await ApplicationService.transitionState(applicationId, 'SELFIE_PENDING', userId, 'Selfie uploaded', tx);
      }

      if (result.status === 'VERIFIED') {
        // Transition state to SUBMITTED
        await ApplicationService.transitionState(applicationId, 'SUBMITTED', userId, 'Selfie successfully verified by provider', tx);
      } else {
        // Log failure but remain in SELFIE_PENDING
        await tx.insert(auditLogs).values({
          applicationId,
          action: 'SELFIE_VERIFICATION_FAILED',
          previousStatus: 'SELFIE_PENDING',
          newStatus: 'SELFIE_PENDING',
          actionBy: userId,
          notes: 'Selfie verification failed by provider'
        });
      }
    });

    return { status: result.status, storagePath };
  }
}

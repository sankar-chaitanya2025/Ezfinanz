import { db } from '@/db'
import { applications, declarations } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { ApplicationService } from '@/services/applicationService'

export class DeclarationService {
  private static readonly CONSENT_TEXT = "I hereby declare that the information provided is true and correct. I consent to EZFinanz processing my loan application.";

  /**
   * Persists the declaration consent and transitions state to DECLARATION_ACCEPTED.
   */
  static async acceptDeclaration(applicationId: string, userId: string, ipAddress?: string) {
    return await db.transaction(async (tx) => {
      // 1. Validate application ownership and state
      const [app] = await tx.select()
        .from(applications)
        .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
        .limit(1)

      if (!app) {
        throw new Error('Application not found or unauthorized')
      }

      if (app.status !== 'BANK_VERIFIED') {
        throw new Error(`Cannot accept declaration from state: ${app.status}`)
      }

      // 2. Persist the declaration snapshot
      await tx.insert(declarations).values({
        applicationId,
        consentText: this.CONSENT_TEXT,
        ipAddress: ipAddress || null,
      }).onConflictDoUpdate({
        target: declarations.applicationId,
        set: {
          consentText: this.CONSENT_TEXT,
          ipAddress: ipAddress || null,
          acceptedAt: new Date()
        }
      });

      // 3. Transition to DECLARATION_ACCEPTED
      await ApplicationService.transitionState(
        applicationId, 
        'DECLARATION_ACCEPTED', 
        userId, 
        'Declaration accepted by customer', 
        tx
      );

      return { success: true };
    });
  }

  static getConsentText(): string {
    return this.CONSENT_TEXT;
  }
}

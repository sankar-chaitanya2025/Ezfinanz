import { db } from '@/db'
import { applications, auditLogs, applicationStateEnum } from '@/db/schema'
import { eq, and, notInArray, desc } from 'drizzle-orm'
import { isValidTransition } from '@/lib/state-machine'

type ApplicationState = typeof applicationStateEnum.enumValues[number]

export class ApplicationService {
  /**
   * Retrieves all applications for a given user, ordered by most recently updated.
   */
  static async getUserApplications(userId: string) {
    return await db.select()
      .from(applications)
      .where(eq(applications.userId, userId))
      .orderBy(desc(applications.updatedAt))
  }

  /**
   * Creates a new application if the user does not have an active/in-progress one.
   */
  static async createApplication(userId: string, requestedAmount?: number, requestedTenure?: number) {
    // 1. Check for existing in-progress applications
    const activeApps = await db.select()
      .from(applications)
      .where(
        and(
          eq(applications.userId, userId),
          notInArray(applications.status, ['APPROVED', 'REJECTED'])
        )
      )
      .limit(1)

    if (activeApps.length > 0) {
      throw new Error('User already has an active/in-progress application.')
    }

    // 2. Create the application (defaults to DRAFT) inside a transaction to ensure audit log is created
    return await db.transaction(async (tx) => {
      const [newApp] = await tx.insert(applications)
        .values({
          userId,
          status: 'DRAFT',
          requestedAmount: requestedAmount?.toString(),
          requestedTenure: requestedTenure
        })
        .returning()

      // 3. Create initial audit log
      await tx.insert(auditLogs).values({
        applicationId: newApp.id,
        action: 'CREATED',
        newStatus: 'DRAFT',
        actionBy: userId,
        notes: 'Application initialized'
      })

      return newApp
    })
  }

  /**
   * Transitions an application to a new state if valid.
   */
  static async transitionState(
    applicationId: string, 
    newState: ApplicationState, 
    actionByUserId: string, 
    notes?: string,
    dbOrTx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0] = db
  ) {
    const executeLogic = async (tx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
      // 1. Fetch current application
      const [currentApp] = await tx.select()
        .from(applications)
        .where(eq(applications.id, applicationId))
        .limit(1)

      if (!currentApp) {
        throw new Error('Application not found.')
      }

      const currentState = currentApp.status

      // 2. Validate transition
      if (!isValidTransition(currentState, newState)) {
        throw new Error(`Invalid state transition from ${currentState} to ${newState}`)
      }

      // 3. Update application status
      const [updatedApp] = await tx.update(applications)
        .set({ 
          status: newState,
          updatedAt: new Date()
        })
        .where(eq(applications.id, applicationId))
        .returning()

      // 4. Create audit log
      await tx.insert(auditLogs).values({
        applicationId: applicationId,
        action: 'STATE_TRANSITION',
        previousStatus: currentState,
        newStatus: newState,
        actionBy: actionByUserId,
        notes: notes || `State transitioned from ${currentState} to ${newState}`
      })

      return updatedApp
    }

    if (typeof dbOrTx.transaction === 'function') {
      return await dbOrTx.transaction(executeLogic)
    } else {
      return await executeLogic(dbOrTx)
    }
  }
}

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logout } from '@/app/actions/auth'

import { ApplicationService } from '@/services/applicationService'
import { createApplicationAction } from '@/app/actions/application'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch application-level profile
  const profileResult = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
  const profile = profileResult[0]

  const userApplications = await ApplicationService.getUserApplications(user.id)

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold mb-4">Dashboard (Test)</h1>
        <div className="bg-white text-black border p-4 rounded mb-4 shadow">
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Auth ID:</strong> {user.id}</p>
          <p><strong>Application Role:</strong> {profile?.role || 'UNKNOWN (Profile sync failed)'}</p>
        </div>
        <form action={logout}>
          <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded" type="submit">
            Log Out
          </button>
        </form>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Your Applications</h2>
          <form action={createApplicationAction}>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded" type="submit">
              Create New Application
            </button>
          </form>
        </div>

        {userApplications.length === 0 ? (
          <p className="text-gray-400">No applications found.</p>
        ) : (
          <div className="space-y-4">
            {userApplications.map(app => (
              <div key={app.id} className="border p-4 rounded shadow bg-gray-800 text-white">
                <p><strong>ID:</strong> {app.id}</p>
                <p><strong>Status:</strong> {app.status}</p>
                <p><strong>Created At:</strong> {new Date(app.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

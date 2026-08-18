import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logout } from '@/app/actions/auth'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch application-level profile
  const profileResult = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
  const profile = profileResult[0]

  return (
    <div className="p-8">
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
  )
}

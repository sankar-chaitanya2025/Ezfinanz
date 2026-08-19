import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [profile] = await db.select().from(users).where(eq(users.id, user.id)).limit(1)

  if (!profile || profile.role !== 'ADMIN') {
    // If not admin, redirect them to customer dashboard
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900">EZFinanz Admin Portal</h1>
        <div className="text-sm text-gray-600">Logged in as {profile.email}</div>
      </nav>
      <main className="p-6">
        {children}
      </main>
    </div>
  )
}

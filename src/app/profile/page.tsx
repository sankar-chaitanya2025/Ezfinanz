import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users, applications, loans } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { UserNav } from '@/components/layout/UserNav'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, Activity } from 'lucide-react'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const [profile] = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
  const userApps = await db.select().from(applications).where(eq(applications.userId, user.id))
  const userLoans = await db.select().from(loans).where(eq(loans.userId, user.id))

  const approvedLoansCount = userLoans.length
  const totalDisbursed = userLoans.reduce((acc, loan) => acc + (loan.disbursedAmount ? parseFloat(loan.disbursedAmount) : 0), 0)

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <UserNav theme="light" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Your Profile</h2>
          <p className="text-sm text-zinc-500 mt-2">Manage your account settings and view your lifetime metrics.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1 md:col-span-2 border-zinc-200 shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" /> Personal Details
              </CardTitle>
              <CardDescription>Your verified identity information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-zinc-500 uppercase">Email Address</span>
                  <p className="text-sm font-medium text-zinc-900 truncate">{user.email}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-zinc-500 uppercase">System Role</span>
                  <div><Badge variant={profile?.role === 'ADMIN' ? 'default' : 'secondary'}>{profile?.role || 'CUSTOMER'}</Badge></div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-zinc-500 uppercase">Account ID</span>
                  <p className="text-xs font-mono text-zinc-600 bg-zinc-100 p-1.5 rounded truncate" title={user.id}>{user.id}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1 border-zinc-200 shadow-sm bg-white bg-gradient-to-br from-indigo-50 to-white">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" /> Lifetime Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <span className="text-xs font-semibold text-indigo-600/80 uppercase tracking-wider block mb-1">Total Applications</span>
                <p className="text-3xl font-bold text-zinc-900">{userApps.length}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-indigo-600/80 uppercase tracking-wider block mb-1">Active/Approved</span>
                <p className="text-3xl font-bold text-zinc-900">{approvedLoansCount}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-indigo-600/80 uppercase tracking-wider block mb-1">Total Disbursed</span>
                <p className="text-2xl font-bold text-indigo-600">₹{totalDisbursed.toLocaleString('en-IN')}</p>
              </div>
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  )
}

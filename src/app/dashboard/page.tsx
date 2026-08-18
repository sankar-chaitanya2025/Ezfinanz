import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logout } from '@/app/actions/auth'

import { ApplicationService } from '@/services/applicationService'

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
          <form action={async () => {
            'use server';
            const { createApplicationAction } = await import('@/app/actions/application');
            await createApplicationAction();
          }}>
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
                
                {(app.status === 'DRAFT' || app.status === 'KYC_PENDING') && (
                  <form action={async (formData) => {
                    'use server';
                    const { submitKycAction } = await import('@/app/actions/kyc');
                    await submitKycAction(formData);
                  }} className="mt-4 p-4 border border-gray-600 rounded bg-gray-900 space-y-2">
                    <h3 className="font-semibold text-lg">Verify Identity</h3>
                    <input type="hidden" name="applicationId" value={app.id} />
                    <div>
                      <select name="idType" required className="w-full p-2 rounded text-black bg-white border border-gray-300">
                        <option value="AADHAR">Aadhar</option>
                        <option value="PAN">PAN</option>
                      </select>
                    </div>
                    <div>
                      <input 
                        type="text" 
                        name="idNumber" 
                        placeholder="Enter ID Number (Use 'FAIL' to simulate rejection)"
                        required
                        className="w-full p-2 rounded text-black bg-white border border-gray-300"
                      />
                    </div>
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                      Submit KYC
                    </button>
                  </form>
                )}

                {(app.status === 'KYC_COMPLETED' || app.status === 'NOT_ELIGIBLE') && (
                  <div className="mt-4 p-4 border rounded bg-blue-50 text-black">
                    <h4 className="font-semibold mb-2">Submit Financial Details</h4>
                    <form action={async (formData) => {
                      'use server';
                      const { submitFinancialsAction } = await import('@/app/actions/financials');
                      await submitFinancialsAction(formData);
                    }} className="space-y-2">
                      <input type="hidden" name="applicationId" value={app.id} />
                      <div>
                        <label className="block text-sm">Employment Type</label>
                        <select name="employmentType" className="border p-2 rounded w-full" required>
                          <option value="SALARIED">Salaried</option>
                          <option value="SELF_EMPLOYED">Self Employed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm">Employer Name</label>
                        <input type="text" name="employerName" className="border p-2 rounded w-full" required />
                      </div>
                      <div>
                        <label className="block text-sm">Designation</label>
                        <input type="text" name="designation" className="border p-2 rounded w-full" required />
                      </div>
                      <div>
                        <label className="block text-sm">Monthly Income</label>
                        <input type="number" name="monthlyIncome" className="border p-2 rounded w-full" min="1" required />
                      </div>
                      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                        Sync Credit Bureau & Submit
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

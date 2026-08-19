import { AdminService } from '@/services/adminService'
import { claimApplicationAction, approveApplicationAction, rejectApplicationAction } from '@/app/actions/admin'
import { logout } from '@/app/actions/auth'
import { createClient } from '@/utils/supabase/server'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminId = user?.id

  const applications = await AdminService.getReviewableApplications()
  
  // Fetch details for all (N+1 query, but fine for unpolished functional MVP)
  const appDetails = await Promise.all(
    applications.map(app => AdminService.getApplicationDetails(app.id))
  )

  return (
    <div className="space-y-8 text-black">
      <div className="flex justify-between items-center bg-white p-4 rounded shadow">
        <div>
          <h2 className="text-2xl font-bold">Admin Application Review Queue</h2>
          <p className="text-sm text-gray-500">Review and process submitted loan applications.</p>
        </div>
        <form action={logout}>
          <button type="submit" className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
        </form>
      </div>

      <div className="space-y-6">
        {appDetails.map((details) => {
          if (!details) return null
          const { application: app, kyc, financial, eligibility, terms, bank, selfie, declaration } = details

          const isClaimedByMe = app.reviewerId === adminId
          const isClaimedByOther = app.reviewerId && app.reviewerId !== adminId

          return (
            <div key={app.id} className="bg-white p-6 rounded shadow border border-gray-200">
              <div className="flex justify-between border-b pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold">Application ID: {app.id}</h3>
                  <p><strong>Customer:</strong> {app.customerEmail}</p>
                  <p><strong>Status:</strong> <span className="inline-block bg-gray-200 px-2 py-1 rounded text-sm">{app.status}</span></p>
                  <p><strong>Created At:</strong> {new Date(app.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p><strong>Requested Amount:</strong> ₹{app.requestedAmount}</p>
                  <p><strong>Requested Tenure:</strong> {app.requestedTenure} months</p>
                  <p><strong>Assigned To:</strong> {app.reviewerId ? (isClaimedByMe ? 'You' : app.reviewerId) : 'Unassigned'}</p>
                </div>
              </div>

              {/* Data Dump (Unpolished) */}
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div className="border p-2 bg-gray-50">
                  <h4 className="font-bold border-b mb-2">KYC Details</h4>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(kyc, null, 2)}</pre>
                </div>
                <div className="border p-2 bg-gray-50">
                  <h4 className="font-bold border-b mb-2">Financial Details</h4>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(financial, null, 2)}</pre>
                </div>
                <div className="border p-2 bg-gray-50">
                  <h4 className="font-bold border-b mb-2">Latest Eligibility</h4>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(eligibility[0] || null, null, 2)}</pre>
                </div>
                <div className="border p-2 bg-gray-50">
                  <h4 className="font-bold border-b mb-2">Accepted Terms</h4>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(terms, null, 2)}</pre>
                </div>
                <div className="border p-2 bg-gray-50">
                  <h4 className="font-bold border-b mb-2">Bank Verification</h4>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(bank, null, 2)}</pre>
                </div>
                <div className="border p-2 bg-gray-50">
                  <h4 className="font-bold border-b mb-2">Selfie & Declaration</h4>
                  <pre className="whitespace-pre-wrap">Selfie: {JSON.stringify(selfie, null, 2)}</pre>
                  <pre className="whitespace-pre-wrap mt-2 border-t pt-2">Decl: {JSON.stringify(declaration, null, 2)}</pre>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4 p-4 bg-gray-100 rounded">
                {app.status === 'SUBMITTED' && (
                  <form action={async () => {
                    'use server'
                    await claimApplicationAction(app.id)
                  }}>
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-bold">
                      Claim Application
                    </button>
                  </form>
                )}

                {app.status === 'UNDER_REVIEW' && isClaimedByMe && (
                  <>
                    <form action={async () => {
                      'use server'
                      await approveApplicationAction(app.id)
                    }}>
                      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded font-bold">
                        Approve Application
                      </button>
                    </form>

                    <form action={async (formData) => {
                      'use server'
                      await rejectApplicationAction(app.id, formData)
                    }} className="flex gap-2">
                      <input type="text" name="reason" placeholder="Rejection reason..." className="border p-2 rounded" required />
                      <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded font-bold">
                        Reject
                      </button>
                    </form>
                  </>
                )}

                {app.status === 'UNDER_REVIEW' && isClaimedByOther && (
                  <p className="text-gray-500 italic">This application is being reviewed by another admin.</p>
                )}

                {(app.status === 'APPROVED' || app.status === 'REJECTED') && (
                  <p className="text-gray-500 font-bold">Review Complete: {app.status}</p>
                )}
              </div>
            </div>
          )
        })}
        {applications.length === 0 && (
          <div className="text-center p-8 bg-white rounded shadow text-gray-500">
            No applications in queue.
          </div>
        )}
      </div>
    </div>
  )
}

import { AdminService } from '@/services/adminService'
import { logout } from '@/app/actions/auth'
import { createClient } from '@/utils/supabase/server'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  await supabase.auth.getUser()

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
          const { application: app, kyc, financial, eligibility, terms, bank, selfie, declaration, loan } = details

          return (
            <div key={app.id} className="bg-white p-6 rounded shadow border border-gray-200">
              <div className="flex justify-between border-b pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold">Applicant: {kyc?.fullName || app.customerEmail}</h3>
                  <p><strong>Loan Requested:</strong> ₹{app.requestedAmount} for {app.requestedTenure} months</p>
                  <p><strong>Current Stage:</strong> <span className="inline-block bg-gray-200 px-2 py-1 rounded text-sm font-semibold">{app.status}</span></p>
                  <p><strong>Submission Time:</strong> {app.submittedAt ? new Date(app.submittedAt).toLocaleString() : '—'}</p>
                </div>
                <div className="text-right">
                  {loan && (
                    <p className="mb-2"><strong>Loan Status:</strong> <span className="text-blue-600 font-bold">{loan.status}</span></p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div className="border p-2 bg-gray-50">
                  <h4 className="font-bold border-b mb-2">KYC Details</h4>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(kyc, null, 2)}</pre>
                </div>
                <div className="border p-2 bg-gray-50">
                  <h4 className="font-bold border-b mb-2">Financial Details</h4>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(financial, null, 2)}</pre>
                </div>
                <div className="border p-2 bg-gray-50">
                  <h4 className="font-bold border-b mb-2">Eligibility & Terms</h4>
                  <pre className="whitespace-pre-wrap">Eligibility: {JSON.stringify(eligibility, null, 2)}</pre>
                  <pre className="whitespace-pre-wrap mt-2 border-t pt-2">Terms: {JSON.stringify(terms, null, 2)}</pre>
                </div>
                <div className="border p-2 bg-gray-50">
                  <h4 className="font-bold border-b mb-2">Bank Details</h4>
                  <pre className="whitespace-pre-wrap">{JSON.stringify(bank, null, 2)}</pre>
                </div>
                <div className="border p-2 bg-gray-50 col-span-2">
                  <h4 className="font-bold border-b mb-2">Selfie & Declaration</h4>
                  {selfie?.storagePath ? (
                    <div className="mb-2 border p-1 bg-white inline-block">
                      <img 
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/kyc-documents/${selfie.storagePath}`} 
                        alt="Customer Selfie" 
                        className="max-w-[200px] h-auto"
                      />
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap">Selfie: {JSON.stringify(selfie, null, 2)}</pre>
                  )}
                  <pre className="whitespace-pre-wrap mt-2 border-t pt-2">Decl: {JSON.stringify(declaration, null, 2)}</pre>
                </div>
              </div>

              <div className="flex gap-4 justify-end mt-4 border-t pt-4">
                {app.status === 'SUBMITTED' && (
                  <>
                    <form action={async () => {
                      'use server'
                      const { approveApplicationAction } = await import('@/app/actions/admin')
                      await approveApplicationAction(app.id)
                    }}>
                      <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700">
                        Approve Application
                      </button>
                    </form>

                    <form action={async (formData) => {
                      'use server'
                      const { rejectApplicationAction } = await import('@/app/actions/admin')
                      await rejectApplicationAction(app.id, formData)
                    }} className="flex gap-2">
                      <input type="text" name="reason" placeholder="Rejection reason..." className="border p-2 rounded" required />
                      <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-700">
                        Reject
                      </button>
                    </form>
                  </>
                )}

                {app.status === 'APPROVED' && loan?.status === 'DISBURSEMENT_PENDING' && (
                  <form action={async () => {
                    'use server'
                    const { confirmDisbursementAction } = await import('@/app/actions/admin')
                    await confirmDisbursementAction(app.id)
                  }}>
                    <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded font-bold hover:bg-purple-700">
                      Confirm Disbursement
                    </button>
                  </form>
                )}

                {(app.status === 'APPROVED' || app.status === 'REJECTED') && loan?.status !== 'DISBURSEMENT_PENDING' && (
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

import { AdminService } from '@/services/adminService'
import { logout } from '@/app/actions/auth'
import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LogOut, CheckCircle, XCircle, Banknote, FileText, Users, Activity, IndianRupee, Clock } from 'lucide-react'
import { UserNav } from '@/components/layout/UserNav'

function DataRow({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex justify-between items-start gap-4 text-xs">
      <span className="text-zinc-500 font-medium shrink-0">{label}</span>
      <span className="font-semibold text-zinc-900 text-right truncate" title={String(value)}>{value}</span>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  await supabase.auth.getUser()

  const applications = await AdminService.getReviewableApplications()
  
  // Fetch details for all (N+1 query, but fine for unpolished functional MVP)
  const appDetails = await Promise.all(
    applications.map(app => AdminService.getApplicationDetails(app.id))
  )

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      {/* Header */}
      <UserNav theme="dark" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Admin Dashboard</h2>
          <p className="text-sm text-zinc-500 mt-1">Overview of system metrics and pending reviews.</p>
        </div>

        {/* METRICS DASHBOARD */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-zinc-200 shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-zinc-500">Total Applications</CardTitle>
              <Users className="h-4 w-4 text-zinc-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-900">{applications.length}</div>
            </CardContent>
          </Card>
          
          <Card className="border-zinc-200 shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-zinc-500">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {applications.filter(a => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW').length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-zinc-500">Approved Loans</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {applications.filter(a => a.status === 'APPROVED').length}
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-zinc-500">Total Disbursed</CardTitle>
              <IndianRupee className="h-4 w-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">
                ₹{appDetails.reduce((sum, detail) => sum + (detail?.loan?.disbursedAmount ? parseFloat(detail.loan.disbursedAmount) : 0), 0).toLocaleString('en-IN')}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h3 className="text-xl font-bold tracking-tight text-zinc-900 mb-4 mt-8">Application Queue</h3>
        </div>

        <div className="space-y-8">
          {appDetails.map((details) => {
            if (!details) return null
            const { application: app, kyc, financial, eligibility, terms, bank, selfie, declaration, loan } = details

            return (
              <Card key={app.id} className="shadow-sm border-zinc-200 bg-white overflow-hidden">
                <div className="bg-zinc-50/80 border-b border-zinc-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">{kyc?.fullName || app.customerEmail}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="font-mono text-xs uppercase">{app.id.split('-')[0]}</Badge>
                      <Badge className="bg-zinc-900">{app.status}</Badge>
                    </div>
                  </div>
                  <div className="text-left md:text-right text-sm">
                    <p className="text-zinc-500 mb-1">Requested</p>
                    <p className="font-semibold text-zinc-900">₹{app.requestedAmount} for {app.requestedTenure}M</p>
                    {loan && (
                      <p className="mt-2 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">
                        Loan: {loan.status}
                      </p>
                    )}
                  </div>
                </div>

                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* KYC Section */}
                    <div className="space-y-3 bg-zinc-50/50 p-5 rounded-xl border border-zinc-100 shadow-sm">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 pb-2 mb-3">KYC Details</h4>
                      {kyc ? (
                        <div className="space-y-2.5">
                          <DataRow label="ID Type" value={kyc.idType} />
                          <DataRow label="ID Number" value={kyc.idNumberMasked} />
                          <DataRow label="DOB" value={kyc.dob} />
                          <DataRow label="Gender" value={kyc.gender} />
                          <DataRow label="Status" value={kyc.verificationStatus} />
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400">Not provided</p>
                      )}
                    </div>

                    {/* Financial Section */}
                    <div className="space-y-3 bg-zinc-50/50 p-5 rounded-xl border border-zinc-100 shadow-sm">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 pb-2 mb-3">Financial</h4>
                      {financial ? (
                        <div className="space-y-2.5">
                          <DataRow label="Employment" value={financial.employmentType} />
                          <DataRow label="Employer" value={financial.employerName} />
                          <DataRow label="Income" value={`₹${financial.monthlyIncome}`} />
                          <DataRow label="Credit Score" value={financial.creditScore} />
                          <DataRow label="Existing EMIs" value={`₹${financial.existingEmiObligations}`} />
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400">Not provided</p>
                      )}
                    </div>

                    {/* Terms & Eligibility */}
                    <div className="space-y-3 bg-zinc-50/50 p-5 rounded-xl border border-zinc-100 shadow-sm">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 pb-2 mb-3">Terms</h4>
                      {eligibility && eligibility.length > 0 ? (
                        <div className="space-y-2.5">
                          <DataRow label="Decision" value={eligibility[0].decision} />
                          <DataRow label="Max Eligible" value={`₹${eligibility[0].maxEligibleAmount}`} />
                          {terms && (
                            <div className="border-t border-zinc-200 pt-3 mt-3 space-y-2.5">
                              <DataRow label="Final Amount" value={`₹${terms.finalAmount}`} />
                              <DataRow label="Tenure" value={`${terms.tenure} Months`} />
                              <DataRow label="Monthly EMI" value={`₹${terms.emi}`} />
                              <DataRow label="Processing Fee" value={`₹${terms.processingFee}`} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400">Not provided</p>
                      )}
                    </div>

                    {/* Bank & Selfie */}
                    <div className="space-y-3 bg-zinc-50/50 p-5 rounded-xl border border-zinc-100 shadow-sm">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 border-b border-zinc-200 pb-2 mb-3">Bank & Selfie</h4>
                      {bank ? (
                        <div className="space-y-2.5">
                          <DataRow label="Account" value={bank.accountNumberMasked} />
                          <DataRow label="IFSC" value={bank.ifscCode} />
                          <DataRow label="Holder Name" value={bank.accountHolderName} />
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-400">Bank not provided</p>
                      )}
                      <div className="border-t border-zinc-200 pt-3 mt-3">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">Selfie Verification</span>
                        {selfie?.storagePath ? (
                          <div className="relative aspect-[3/4] w-full max-w-[120px] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                            <img 
                              src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/kyc-documents/${selfie.storagePath}`} 
                              alt="Selfie" 
                              className="object-cover w-full h-full"
                            />
                          </div>
                        ) : (
                          <p className="text-xs text-zinc-400">No selfie uploaded</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="bg-zinc-50/50 border-t border-zinc-100 p-6 flex flex-wrap items-center justify-end gap-4">
                  {app.status === 'SUBMITTED' && (
                    <div className="flex flex-col sm:flex-row w-full justify-end gap-4 items-end sm:items-center">
                      <form action={async (formData) => {
                        'use server'
                        const { rejectApplicationAction } = await import('@/app/actions/admin')
                        await rejectApplicationAction(app.id, formData)
                      }} className="flex w-full sm:w-auto items-center gap-2">
                        <Input type="text" name="reason" placeholder="Rejection reason..." className="flex-1 sm:w-64 bg-white" required />
                        <Button type="submit" variant="destructive" className="shrink-0">
                          <XCircle className="w-4 h-4 mr-2" /> Reject
                        </Button>
                      </form>

                      <form action={async () => {
                        'use server'
                        const { approveApplicationAction } = await import('@/app/actions/admin')
                        await approveApplicationAction(app.id)
                      }} className="w-full sm:w-auto">
                        <Button type="submit" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">
                          <CheckCircle className="w-4 h-4 mr-2" /> Approve
                        </Button>
                      </form>
                    </div>
                  )}

                  {app.status === 'APPROVED' && loan?.status === 'DISBURSEMENT_PENDING' && (
                    <form action={async () => {
                      'use server'
                      const { confirmDisbursementAction } = await import('@/app/actions/admin')
                      await confirmDisbursementAction(app.id)
                    }}>
                      <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white">
                        <Banknote className="w-4 h-4 mr-2" /> Confirm Disbursement
                      </Button>
                    </form>
                  )}

                  {(app.status === 'APPROVED' || app.status === 'REJECTED') && loan?.status !== 'DISBURSEMENT_PENDING' && (
                    <p className="text-sm text-zinc-500 font-semibold flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Review Complete
                    </p>
                  )}
                </CardFooter>
              </Card>
            )
          })}

          {applications.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed border-zinc-200 rounded-xl bg-white">
              <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 font-medium">No applications in queue.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

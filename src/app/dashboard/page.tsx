import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users, eligibilityResults } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { logout } from '@/app/actions/auth'
import { ApplicationService } from '@/services/applicationService'
import { EmiTermSelector } from '@/components/dashboard/EmiTermSelector'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, AlertTriangle, Banknote, Camera, CheckCircle, CheckCircle2, FileText, ShieldCheck, User } from 'lucide-react'
import { UserNav } from '@/components/layout/UserNav'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const errorParam = (await searchParams).error

  if (!user) {
    redirect('/login')
  }

  const profileResult = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
  const profile = profileResult[0]

  const userApplications = await ApplicationService.getUserApplications(user.id)

  const { loans } = await import('@/db/schema')
  const userLoans = await db.select().from(loans).where(eq(loans.userId, user.id))
  const loanMap = Object.fromEntries(userLoans.map(l => [l.applicationId, l]))

  // For each NOT_ELIGIBLE app, fetch the latest eligibility result so we can show reasons
  const eligibilityMap: Record<string, { reasons: string[]; decision: string } | null> = {}
  for (const app of userApplications) {
    if (app.status === 'NOT_ELIGIBLE') {
      const [latest] = await db
        .select({ reasons: eligibilityResults.reasons, decision: eligibilityResults.decision })
        .from(eligibilityResults)
        .where(eq(eligibilityResults.applicationId, app.id))
        .orderBy(desc(eligibilityResults.evaluationVersion))
        .limit(1)
      eligibilityMap[app.id] = latest
        ? { reasons: (latest.reasons as string[]) ?? [], decision: latest.decision }
        : null
    }
  }

  // Only block creating a new app for states that are genuinely in-progress.
  // NOT_ELIGIBLE is included since the correction loop lives on the same app.
  const IN_PROGRESS_STATES = [
    'DRAFT', 'KYC_PENDING', 'KYC_COMPLETED',
    'FINANCIALS_COMPLETED', 'ELIGIBILITY_PENDING',
    'NOT_ELIGIBLE', // correction loop — stays on same app
    'ELIGIBLE', 'PARTIALLY_ELIGIBLE',
    'TERMS_SELECTED', 'BANK_VERIFIED', 'DECLARATION_ACCEPTED',
    'SELFIE_PENDING', 'SUBMITTED', 'UNDER_REVIEW',
  ]
  const hasActiveApplication = userApplications.some(a => IN_PROGRESS_STATES.includes(a.status))

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      {/* Header */}
      <UserNav theme="light" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {errorParam && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <strong className="font-bold block">Error</strong>
              <span className="text-sm">{errorParam}</span>
            </div>
          </div>
        )}
        

        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-6">Your Applications</h2>

          {!hasActiveApplication && (
            <Card className="border-zinc-200 shadow-sm mb-8 bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-indigo-600" /> Start New Application
                </CardTitle>
                <CardDescription>Request a new loan up to ₹5,00,000</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={async (formData) => {
                  'use server';
                  const { createApplicationAction } = await import('@/app/actions/application');
                  const result = await createApplicationAction(formData);
                  if (result?.error) {
                    const { redirect } = await import('next/navigation');
                    redirect('/dashboard?error=' + encodeURIComponent(result.error));
                  }
                }} className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="requestedAmount">Requested Amount (₹)</Label>
                      <Input id="requestedAmount" type="number" name="requestedAmount" placeholder="e.g. 500000" required />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="requestedTenure">Tenure (Months)</Label>
                      <select name="requestedTenure" id="requestedTenure" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" required defaultValue={60}>
                        <option value="12">12 Months</option>
                        <option value="24">24 Months</option>
                        <option value="36">36 Months</option>
                        <option value="48">48 Months</option>
                        <option value="60">60 Months</option>
                      </select>
                    </div>
                  </div>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">
                    Create New Application
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {userApplications.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-xl">
              <FileText className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 font-medium">No applications found.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {userApplications.map(app => {
                const eligibility = eligibilityMap[app.id]
                const reasons: string[] = eligibility?.reasons ?? []
                const creditScoreBlocked = reasons.some(r =>
                  r.toLowerCase().includes('credit score') && r.toLowerCase().includes('below')
                )

                return (
                  <Card key={app.id} className="border-zinc-200 shadow-sm overflow-hidden bg-white">
                    <div className="bg-zinc-50 border-b border-zinc-100 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono text-[10px] uppercase text-zinc-500">{app.id.split('-')[0]}</Badge>
                          <Badge className="bg-zinc-900 hover:bg-zinc-800">{app.status.replace(/_/g, ' ')}</Badge>
                        </div>
                        <p className="text-xs text-zinc-500">Created on {new Date(app.createdAt).toLocaleDateString()}</p>
                      </div>
                      
                      {app.requestedAmount && (
                        <div className="text-left sm:text-right">
                          <p className="text-sm font-semibold text-zinc-900">₹{parseFloat(app.requestedAmount).toLocaleString('en-IN')}</p>
                          <p className="text-xs text-zinc-500">{app.requestedTenure} months</p>
                        </div>
                      )}
                    </div>

                    {loanMap[app.id] && (
                      <div className="bg-indigo-50/50 border-b border-indigo-100 p-4 sm:px-6">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-800 mb-2">Loan Details</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-indigo-600/70 text-xs">Status</p>
                            <p className="font-semibold text-indigo-900">{loanMap[app.id].status}</p>
                          </div>
                          {loanMap[app.id].sanctionedAmount && (
                            <div>
                              <p className="text-indigo-600/70 text-xs">Sanctioned</p>
                              <p className="font-semibold text-indigo-900">₹{parseFloat(loanMap[app.id].sanctionedAmount!).toLocaleString('en-IN')}</p>
                            </div>
                          )}
                          {loanMap[app.id].disbursedAmount && (
                            <div>
                              <p className="text-indigo-600/70 text-xs">Disbursed</p>
                              <p className="font-bold text-emerald-600">₹{parseFloat(loanMap[app.id].disbursedAmount!).toLocaleString('en-IN')}</p>
                            </div>
                          )}
                          {loanMap[app.id].disbursedAt && (
                            <div>
                              <p className="text-indigo-600/70 text-xs">Date</p>
                              <p className="font-semibold text-indigo-900">{new Date(loanMap[app.id].disbursedAt!).toLocaleDateString()}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <CardContent className="p-4 sm:p-6">
                      {/* ── STEP 1: KYC ── */}
                      {(app.status === 'DRAFT' || app.status === 'KYC_PENDING') && (
                        <div className="border border-zinc-200 rounded-2xl p-6 bg-white shadow-sm">
                          <h3 className="font-bold text-lg text-zinc-900 mb-2">Step 1: Verify Identity (KYC)</h3>
                          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 text-sm text-zinc-600 mb-6 space-y-2">
                            <p><strong>PAN Tips:</strong> Use <code className="bg-zinc-200 px-1.5 py-0.5 rounded text-zinc-900">ABCDE1000F</code> for Good Score. Use <code className="bg-zinc-200 px-1.5 py-0.5 rounded text-zinc-900">FAILP1234F</code> to simulate failure.</p>
                            <p><strong>Aadhar Tips:</strong> Must be exactly 12 digits. Use <code className="bg-zinc-200 px-1.5 py-0.5 rounded text-zinc-900">100000000000</code> for Good Score. Use <code className="bg-zinc-200 px-1.5 py-0.5 rounded text-zinc-900">000012345678</code> to simulate failure.</p>
                          </div>
                          
                          <form action={async (formData) => {
                            'use server';
                            const { submitKycAction } = await import('@/app/actions/kyc');
                            await submitKycAction(formData);
                          }} className="space-y-4 max-w-md">
                            <input type="hidden" name="applicationId" value={app.id} />
                            <div className="space-y-2">
                              <Label>ID Type</Label>
                              <select name="idType" required className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                                <option value="AADHAR">Aadhar</option>
                                <option value="PAN">PAN</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label>Full Name (as per ID)</Label>
                              <Input type="text" name="fullName" placeholder="John Doe" required />
                            </div>
                            <div className="space-y-2">
                              <Label>ID Number</Label>
                              <Input type="text" name="idNumber" placeholder="ABCD1234" required />
                            </div>
                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                              Submit KYC
                            </Button>
                          </form>
                        </div>
                      )}

                      {/* ── STEP 2: Financial Details ── */}
                      {(app.status === 'KYC_COMPLETED' || app.status === 'NOT_ELIGIBLE') && (
                        <div className="border border-blue-100 rounded-2xl p-6 bg-blue-50/30">
                          {app.status === 'NOT_ELIGIBLE' && (
                            <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50">
                              <p className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Not Eligible — Reason(s):
                              </p>
                              {reasons.length > 0 ? (
                                <ul className="list-disc list-inside text-sm text-red-700 space-y-1 ml-1">
                                  {reasons.map((r, i) => <li key={i}>{r}</li>)}
                                </ul>
                              ) : (
                                <p className="text-sm text-red-700">No reason recorded.</p>
                              )}

                              {creditScoreBlocked && (
                                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm">
                                  <strong className="block mb-1">⚠ Credit score is below the minimum (650).</strong>
                                  This cannot be fixed by updating your income or amount. Your credit score is determined by your KYC ID via the bureau. To test with a good score, create a new application and use ID <strong>ABCD1234</strong> for KYC.
                                  
                                  <form action={async () => {
                                    'use server';
                                    const { abandonApplicationAction } = await import('@/app/actions/abandon');
                                    await abandonApplicationAction(app.id);
                                  }} className="mt-4">
                                    <Button variant="destructive" size="sm" type="submit">
                                      Abandon Application & Start Fresh
                                    </Button>
                                  </form>
                                </div>
                              )}
                            </div>
                          )}

                          <h3 className="font-bold text-lg text-zinc-900 mb-1">
                            {app.status === 'NOT_ELIGIBLE' ? 'Step 2 (Retry): Correct Financial Details' : 'Step 2: Submit Financial Details'}
                          </h3>
                          <p className="text-sm text-zinc-500 mb-6">
                            This will sync with the credit bureau and automatically evaluate your eligibility.
                          </p>

                          <form action={async (formData) => {
                            'use server';
                            const { submitFinancialsAction } = await import('@/app/actions/financials');
                            await submitFinancialsAction(formData);
                          }} className="space-y-4 max-w-md">
                            <input type="hidden" name="applicationId" value={app.id} />
                            
                            <div className="space-y-2">
                              <Label>Employment Type</Label>
                              <select name="employmentType" className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" required>
                                <option value="SALARIED">Salaried</option>
                                <option value="SELF_EMPLOYED">Self Employed</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label>Employer Name</Label>
                              <Input type="text" name="employerName" className="bg-white" required />
                            </div>
                            <div className="space-y-2">
                              <Label>Designation</Label>
                              <Input type="text" name="designation" className="bg-white" required />
                            </div>
                            <div className="space-y-2">
                              <Label>Monthly Income (₹)</Label>
                              <Input type="number" name="monthlyIncome" className="bg-white" min="15001" placeholder="Minimum ₹15,000" required />
                            </div>
                            
                            {app.status === 'NOT_ELIGIBLE' && (
                              <div className="pt-4 mt-4 border-t border-blue-100 space-y-4">
                                <div className="space-y-2">
                                  <Label>Updated Requested Amount (₹)</Label>
                                  <Input type="number" name="correctedRequestedAmount" defaultValue={app.requestedAmount ? parseFloat(app.requestedAmount) : undefined} className="bg-white" required />
                                </div>
                                <div className="space-y-2">
                                  <Label>Updated Tenure (Months)</Label>
                                  <select name="correctedRequestedTenure" className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" required defaultValue={app.requestedTenure ?? 60}>
                                    {[12, 24, 36, 48, 60].map(t => (
                                      <option key={t} value={t}>{t} Months</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                            
                            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2">
                              Sync Credit Bureau & Evaluate
                            </Button>
                          </form>
                        </div>
                      )}

                      {/* ── STEP 3 (fallback) ── */}
                      {app.status === 'FINANCIALS_COMPLETED' && (
                        <div className="border border-indigo-100 rounded-2xl p-6 bg-indigo-50/50">
                          <h3 className="font-bold text-lg text-zinc-900 mb-1">Evaluate Eligibility</h3>
                          <p className="text-sm text-zinc-500 mb-4">Financial details saved. Click below to run the eligibility engine.</p>
                          <form action={async (formData) => {
                            'use server';
                            const { evaluateEligibilityAction } = await import('@/app/actions/eligibility');
                            await evaluateEligibilityAction(formData);
                          }}>
                            <input type="hidden" name="applicationId" value={app.id} />
                            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                              Run Eligibility Engine
                            </Button>
                          </form>
                        </div>
                      )}

                      {/* ── STEP 4: Select Loan Terms ── */}
                      {(app.status === 'ELIGIBLE' || app.status === 'PARTIALLY_ELIGIBLE') && (
                        <div className="border border-emerald-100 rounded-2xl p-6 bg-white shadow-sm">
                          <div className="mb-6">
                            <h3 className="font-bold text-lg text-zinc-900 mb-1 flex items-center gap-2">
                              {app.status === 'ELIGIBLE' ? (
                                <><CheckCircle className="w-5 h-5 text-emerald-600" /> Eligible!</>
                              ) : (
                                <><AlertCircle className="w-5 h-5 text-amber-500" /> Partially Eligible</>
                              )}
                              — Select Loan Terms
                            </h3>
                            <p className="text-sm text-zinc-500">
                              Confirm or adjust your loan amount and tenure. Amount must be within your approved limit.
                            </p>
                          </div>
                          
                          <form action={async (formData) => {
                            'use server';
                            const { generateAndAcceptTermsAction } = await import('@/app/actions/loanTerms');
                            await generateAndAcceptTermsAction(formData);
                          }}>
                            <EmiTermSelector 
                              applicationId={app.id} 
                              initialAmount={app.requestedAmount ? parseFloat(app.requestedAmount) : 100000} 
                              initialTenure={app.requestedTenure || 36}
                            />
                          </form>
                        </div>
                      )}

                      {/* ── STEP 5: Bank Verification ── */}
                      {app.status === 'TERMS_SELECTED' && (
                        <div className="border border-amber-100 rounded-2xl p-6 bg-amber-50/30">
                          <h3 className="font-bold text-lg text-zinc-900 mb-1">Step 5: Bank Account Verification</h3>
                          <p className="text-sm text-zinc-500 mb-6">Account number ending in <strong>000</strong> simulates failure.</p>
                          
                          <form action={async (formData) => {
                            'use server';
                            const { submitBankVerificationAction } = await import('@/app/actions/bankVerification');
                            const result = await submitBankVerificationAction(app.id, formData);
                            if (!result.success || result.error) {
                              const { redirect } = await import('next/navigation');
                              redirect('/dashboard?error=' + encodeURIComponent(result.error || 'Bank verification failed'));
                            }
                            if (result.result?.status === 'FAILED') {
                              const { redirect } = await import('next/navigation');
                              redirect('/dashboard?error=' + encodeURIComponent('Bank account verification was rejected. Please check your details and try again.'));
                            }
                          }} className="space-y-4 max-w-md">
                            <div className="space-y-2">
                              <Label>Account Number (9–18 digits)</Label>
                              <Input type="text" name="accountNumber" className="bg-white" required />
                            </div>
                            <div className="space-y-2">
                              <Label>IFSC Code</Label>
                              <Input type="text" name="ifscCode" placeholder="e.g. HDFC0001234" className="bg-white" required />
                            </div>
                            <div className="space-y-2">
                              <Label>Account Holder Name</Label>
                              <Input type="text" name="accountHolderName" className="bg-white" required />
                            </div>
                            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white mt-2">
                              Verify Bank Account
                            </Button>
                          </form>
                        </div>
                      )}

                      {/* ── STEP 6: Declaration ── */}
                      {app.status === 'BANK_VERIFIED' && (
                        <div className="border border-indigo-100 rounded-2xl p-8 bg-indigo-50/50 text-center">
                          <ShieldCheck className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                          <h3 className="font-bold text-xl text-zinc-900 mb-4 tracking-tight">Final Declaration</h3>
                          <div className="bg-white border border-zinc-200 p-5 rounded-xl text-sm text-zinc-600 mb-6 text-left max-w-md mx-auto italic font-medium shadow-sm">
                            &quot;I hereby declare that the information provided is true and correct. I consent to EZFinanz processing my loan application and verifying my credit history.&quot;
                          </div>
                          <form action={async () => {
                            'use server';
                            const { submitDeclarationAction } = await import('@/app/actions/declaration');
                            await submitDeclarationAction(app.id);
                          }}>
                            <Button type="submit" size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8">
                              I Agree & Accept
                            </Button>
                          </form>
                        </div>
                      )}

                      {/* ── STEP 7: Selfie ── */}
                      {(app.status === 'DECLARATION_ACCEPTED' || app.status === 'SELFIE_PENDING') && (
                        <div className="border border-indigo-100 rounded-2xl p-6 bg-white shadow-sm">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                              <Camera className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-lg text-zinc-900 tracking-tight">Selfie Verification</h3>
                              <p className="text-sm text-zinc-500">Final step! Take a clear photo of your face.</p>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-400 mb-4">Include <strong>blur</strong> or <strong>invalid</strong> in the filename to simulate failure.</p>

                          {app.status === 'SELFIE_PENDING' && (
                            <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 shrink-0"/> Previous selfie was rejected. Please upload a clearer photo.
                            </div>
                          )}

                          <form action={async (formData) => {
                            'use server';
                            const { submitSelfieAction } = await import('@/app/actions/selfieVerification');
                            const result = await submitSelfieAction(app.id, formData);
                            if (result?.error) {
                              const { redirect } = await import('next/navigation');
                              redirect('/dashboard?error=' + encodeURIComponent(result.error));
                            }
                          }} className="max-w-md space-y-4">
                            <Input type="file" name="selfie" accept="image/*" capture="user" required className="cursor-pointer h-12" />
                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                              Upload Selfie & Finish
                            </Button>
                          </form>
                        </div>
                      )}

                      {/* ── Terminal states ── */}
                      {app.status === 'SUBMITTED' && (
                        <div className="border border-blue-200 rounded-2xl p-8 bg-blue-50 text-center">
                          <CheckCircle className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                          <h3 className="text-xl font-bold text-zinc-900 mb-2">Application Submitted!</h3>
                          <p className="text-blue-700 text-sm">Your application is now safely in our system pending review.</p>
                        </div>
                      )}
                      
                      {app.status === 'UNDER_REVIEW' && (
                        <div className="border border-indigo-200 rounded-2xl p-8 bg-indigo-50 text-center">
                          <FileText className="w-12 h-12 text-indigo-500 mx-auto mb-4 animate-pulse" />
                          <h3 className="text-xl font-bold text-zinc-900 mb-2">Under Review</h3>
                          <p className="text-indigo-700 text-sm">Our team is carefully reviewing your application.</p>
                        </div>
                      )}
                      
                      {app.status === 'APPROVED' && (
                        <div className="border border-emerald-200 rounded-2xl p-10 bg-emerald-50 text-center">
                          <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
                          <h3 className="text-2xl font-bold text-zinc-900 mb-2">Approved & Disbursed!</h3>
                          <p className="text-emerald-700 text-sm mb-6">Your loan has been successfully sanctioned.</p>
                          {loanMap[app.id] && (
                            <div className="inline-block bg-white border border-emerald-200 rounded-2xl p-6 text-center shadow-sm">
                              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Amount Disbursed</p>
                              <p className="text-3xl font-black text-emerald-600">₹{parseFloat(loanMap[app.id].disbursedAmount || '0').toLocaleString('en-IN')}</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {app.status === 'REJECTED' && (
                        <div className="border border-red-200 rounded-2xl p-8 bg-red-50 text-center">
                          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                          <h3 className="text-xl font-bold text-zinc-900 mb-2">Application Rejected</h3>
                          <p className="text-red-700 text-sm">Unfortunately, we could not approve your application at this time.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

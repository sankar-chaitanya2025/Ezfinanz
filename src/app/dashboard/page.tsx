import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users, eligibilityResults } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { logout } from '@/app/actions/auth'

import { ApplicationService } from '@/services/applicationService'

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
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      {errorParam && (
        <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded mb-4">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{errorParam}</span>
        </div>
      )}
      
      <div>
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Dashboard (Test)</h1>

          {profile?.role === 'ADMIN' && (
             <a href="/admin" className="bg-purple-600 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-purple-700">
               Go to Admin Dashboard
             </a>
          )}
        </div>
        <div className="bg-white text-black border p-4 rounded mb-4 shadow">
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Auth ID:</strong> {user.id}</p>
          <p><strong>Role:</strong> {profile?.role || 'UNKNOWN'}</p>
        </div>
        <form action={logout}>
          <button className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded" type="submit">
            Log Out
          </button>
        </form>
      </div>

      <div>
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Your Applications</h2>

          {!hasActiveApplication && (
            <div className="p-6 border border-gray-300 rounded bg-gray-50 text-black shadow-sm mb-6">
              <h3 className="font-semibold text-lg border-b pb-2 mb-4">Start New Application</h3>
              <form action={async (formData) => {
                'use server';
                const { createApplicationAction } = await import('@/app/actions/application');
                const result = await createApplicationAction(formData);
                if (result?.error) {
                  const { redirect } = await import('next/navigation');
                  redirect('/dashboard?error=' + encodeURIComponent(result.error));
                }
              }} className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Requested Amount (₹)</label>
                    <input type="number" name="requestedAmount" placeholder="e.g. 500000" className="border border-gray-300 p-2 rounded w-full" required />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tenure (Months)</label>
                    <select name="requestedTenure" className="border border-gray-300 p-2 rounded w-full" required defaultValue={60}>
                      <option value="12">12 Months</option>
                      <option value="24">24 Months</option>
                      <option value="36">36 Months</option>
                      <option value="48">48 Months</option>
                      <option value="60">60 Months</option>
                    </select>
                  </div>
                </div>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded self-start mt-2 font-medium" type="submit">
                  Create New Application
                </button>
              </form>
            </div>
          )}
        </div>

        {userApplications.length === 0 ? (
          <p className="text-gray-400">No applications found.</p>
        ) : (
          <div className="space-y-4">
            {userApplications.map(app => {
              const eligibility = eligibilityMap[app.id]
              const reasons: string[] = eligibility?.reasons ?? []
              // Detect whether the blocking reason is credit score (unfixable via correction loop)
              const creditScoreBlocked = reasons.some(r =>
                r.toLowerCase().includes('credit score') && r.toLowerCase().includes('below')
              )

              return (
                <div key={app.id} className="border p-4 rounded shadow bg-gray-800 text-white">
                  <p><strong>ID:</strong> {app.id}</p>
                  <p><strong>Status:</strong> {app.status}</p>
                  {loanMap[app.id] && (
                    <p><strong>Loan Status:</strong> <span className="text-blue-400 font-bold">{loanMap[app.id].status}</span></p>
                  )}
                  {app.requestedAmount && (
                    <p><strong>Requested Amount:</strong> ₹{parseFloat(app.requestedAmount).toLocaleString('en-IN')}</p>
                  )}
                  {app.requestedTenure && (
                    <p><strong>Tenure:</strong> {app.requestedTenure} months</p>
                  )}
                  <p><strong>Created At:</strong> {new Date(app.createdAt).toLocaleString()}</p>

                  {/* ── STEP 1: KYC ── */}
                  {(app.status === 'DRAFT' || app.status === 'KYC_PENDING') && (
                    <form action={async (formData) => {
                      'use server';
                      const { submitKycAction } = await import('@/app/actions/kyc');
                      await submitKycAction(formData);
                    }} className="mt-4 p-4 border border-gray-600 rounded bg-gray-900 space-y-2">
                      <h3 className="font-semibold text-lg">Step 1: Verify Identity (KYC)</h3>
                      <p className="text-sm text-gray-400">
                        ID tip: use <code className="bg-gray-700 px-1 rounded">ABCD1234</code> for a good credit score (780).
                        IDs starting with <code className="bg-gray-700 px-1 rounded">f</code> after hashing give score 520 (blocked).
                      </p>
                      <input type="hidden" name="applicationId" value={app.id} />
                      <div>
                        <label className="block text-sm mb-1">ID Type</label>
                        <select name="idType" required className="w-full p-2 rounded text-black bg-white border border-gray-300">
                          <option value="AADHAR">Aadhar</option>
                          <option value="PAN">PAN</option>
                        </select>
                      </div>
                      <div>
                        <input
                          type="text"
                          name="idNumber"
                          placeholder="Enter ID Number (use ABCD1234 to guarantee eligibility)"
                          required
                          className="w-full p-2 rounded text-black bg-white border border-gray-300"
                        />
                      </div>
                      <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                        Submit KYC
                      </button>
                    </form>
                  )}

                  {/* ── STEP 2: Financial Details ── */}
                  {(app.status === 'KYC_COMPLETED' || app.status === 'NOT_ELIGIBLE') && (
                    <div className="mt-4 p-4 border rounded bg-blue-50 text-black">

                      {/* NOT_ELIGIBLE: show reasons and detect if credit score is blocking */}
                      {app.status === 'NOT_ELIGIBLE' && (
                        <div className="mb-3 p-3 rounded border border-red-300 bg-red-50">
                          <p className="font-semibold text-red-700 mb-1">❌ Not Eligible — Reason(s):</p>
                          {reasons.length > 0 ? (
                            <ul className="list-disc list-inside text-sm text-red-600 space-y-0.5">
                              {reasons.map((r, i) => <li key={i}>{r}</li>)}
                            </ul>
                          ) : (
                            <p className="text-sm text-red-600">No reason recorded.</p>
                          )}

                          {creditScoreBlocked && (
                            <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded text-amber-800 text-sm">
                              <strong>⚠ Credit score is below the minimum (650).</strong>
                              <br />
                              This cannot be fixed by updating your income or amount.
                              Your credit score is determined by your KYC ID via the bureau.
                              To test with a good score, create a new application and use ID <strong>ABCD1234</strong> for KYC.
                              
                              <form action={async () => {
                                'use server';
                                const { abandonApplicationAction } = await import('@/app/actions/abandon');
                                await abandonApplicationAction(app.id);
                              }} className="mt-3">
                                <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-semibold">
                                  Abandon Application &amp; Start Fresh
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      )}

                      <h4 className="font-semibold mb-1">
                        {app.status === 'NOT_ELIGIBLE'
                          ? 'Step 2 (Retry): Correct Financial Details'
                          : 'Step 2: Submit Financial Details'}
                      </h4>
                      <p className="text-xs text-gray-500 mb-2">
                        This will sync with the credit bureau and automatically evaluate your eligibility in one step.
                      </p>

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
                          <label className="block text-sm">Monthly Income (₹)</label>
                          <input type="number" name="monthlyIncome" className="border p-2 rounded w-full" min="15001" placeholder="Minimum ₹15,000" required />
                        </div>
                        {app.status === 'NOT_ELIGIBLE' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium">Updated Requested Amount (₹)</label>
                              <input
                                type="number"
                                name="correctedRequestedAmount"
                                defaultValue={app.requestedAmount ? parseFloat(app.requestedAmount) : undefined}
                                className="border p-2 rounded w-full"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium">Updated Tenure (Months)</label>
                              <select name="correctedRequestedTenure" className="border p-2 rounded w-full" required defaultValue={app.requestedTenure ?? 60}>
                                {[12, 24, 36, 48, 60].map(t => (
                                  <option key={t} value={t}>{t} Months</option>
                                ))}
                              </select>
                            </div>
                          </>
                        )}
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mt-2 w-full font-medium">
                          Sync Credit Bureau &amp; Submit → Evaluate Eligibility
                        </button>
                      </form>
                    </div>
                  )}

                  {/* ── STEP 3 (fallback): Run Eligibility Engine if stuck at FINANCIALS_COMPLETED ── */}
                  {app.status === 'FINANCIALS_COMPLETED' && (
                    <div className="mt-4 p-4 border rounded bg-indigo-50 text-black">
                      <h4 className="font-semibold mb-2">Evaluate Eligibility</h4>
                      <p className="text-sm text-gray-600 mb-2">Financial details saved. Click below to run the eligibility engine.</p>
                      <form action={async (formData) => {
                        'use server';
                        const { evaluateEligibilityAction } = await import('@/app/actions/eligibility');
                        await evaluateEligibilityAction(formData);
                      }}>
                        <input type="hidden" name="applicationId" value={app.id} />
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">
                          Run Eligibility Engine
                        </button>
                      </form>
                    </div>
                  )}

                  {/* ── STEP 4: Select Loan Terms ── */}
                  {(app.status === 'ELIGIBLE' || app.status === 'PARTIALLY_ELIGIBLE') && (
                    <div className="mt-4 p-4 border rounded bg-green-50 text-black">
                      <h4 className="font-semibold mb-1">
                        {app.status === 'ELIGIBLE' ? '✅ Eligible!' : '⚡ Partially Eligible'} — Select Loan Terms
                      </h4>
                      <p className="text-sm mb-3 text-gray-600">
                        Confirm or adjust your loan amount and tenure. Amount must be within your approved limit.
                      </p>
                      <form action={async (formData) => {
                        'use server';
                        const { generateAndAcceptTermsAction } = await import('@/app/actions/loanTerms');
                        await generateAndAcceptTermsAction(formData);
                      }} className="flex flex-col gap-3">
                        <input type="hidden" name="applicationId" value={app.id} />
                        <div>
                          <label className="block text-sm">Final Loan Amount (₹)</label>
                          <input
                            type="number"
                            name="requestedAmount"
                            defaultValue={app.requestedAmount ? parseFloat(app.requestedAmount) : undefined}
                            className="border p-2 rounded w-full"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm">Tenure (Months)</label>
                          <select name="requestedTenure" className="border p-2 rounded w-full" required defaultValue={app.requestedTenure ?? 60}>
                            {[12, 24, 36, 48, 60].map(t => (
                              <option key={t} value={t}>{t} Months</option>
                            ))}
                          </select>
                        </div>
                        <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mt-2">
                          Calculate &amp; Accept Terms
                        </button>
                      </form>
                    </div>
                  )}

                  {/* ── STEP 5: Bank Verification ── */}
                  {app.status === 'TERMS_SELECTED' && (
                    <div className="mt-4 p-4 border rounded bg-yellow-50 text-black">
                      <h4 className="font-semibold mb-2">Step 5: Bank Account Verification</h4>
                      <p className="text-sm text-gray-600 mb-2">Account number ending in <strong>000</strong> simulates failure.</p>
                      <form action={async (formData) => {
                        'use server';
                        const { submitBankVerificationAction } = await import('@/app/actions/bankVerification');
                        await submitBankVerificationAction(app.id, formData);
                      }} className="space-y-2">
                        <div>
                          <label className="block text-sm">Account Number (9–18 digits)</label>
                          <input type="text" name="accountNumber" className="border p-2 rounded w-full" required />
                        </div>
                        <div>
                          <label className="block text-sm">IFSC Code (e.g. HDFC0001234)</label>
                          <input type="text" name="ifscCode" className="border p-2 rounded w-full" required />
                        </div>
                        <div>
                          <label className="block text-sm">Account Holder Name</label>
                          <input type="text" name="accountHolderName" className="border p-2 rounded w-full" required />
                        </div>
                        <button type="submit" className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded mt-2">
                          Verify Bank Account
                        </button>
                      </form>
                    </div>
                  )}

                  {/* ── STEP 6: Declaration ── */}
                  {app.status === 'BANK_VERIFIED' && (
                    <div className="mt-4 p-4 border rounded bg-purple-50 text-black">
                      <h4 className="font-semibold mb-2">Step 6: Declaration &amp; Consent</h4>
                      <p className="text-sm italic mb-2">&ldquo;I hereby declare that the information provided is true and correct. I consent to EZFinanz processing my loan application.&rdquo;</p>
                      <form action={async () => {
                        'use server';
                        const { submitDeclarationAction } = await import('@/app/actions/declaration');
                        await submitDeclarationAction(app.id);
                      }}>
                        <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded">
                          Accept Declaration
                        </button>
                      </form>
                    </div>
                  )}

                  {/* ── STEP 7: Selfie ── */}
                  {(app.status === 'DECLARATION_ACCEPTED' || app.status === 'SELFIE_PENDING') && (
                    <div className="mt-4 p-4 border rounded bg-pink-50 text-black">
                      <h4 className="font-semibold mb-2">Step 7: Selfie Verification</h4>
                      <p className="text-sm mb-2">Upload or take a selfie photo. Include <strong>blur</strong> or <strong>invalid</strong> in the filename to simulate failure.</p>
                      {app.status === 'SELFIE_PENDING' && (
                        <p className="text-sm text-amber-700 mb-2">⚠ Previous selfie failed. Please try again.</p>
                      )}
                      <form action={async (formData) => {
                        'use server';
                        const { submitSelfieAction } = await import('@/app/actions/selfieVerification');
                        const result = await submitSelfieAction(app.id, formData);
                        if (result?.error) {
                          const { redirect } = await import('next/navigation');
                          redirect('/dashboard?error=' + encodeURIComponent(result.error));
                        }
                      }} className="space-y-2">
                        {/* capture="user" tells mobile browsers to open the front camera directly! */}
                        <input type="file" name="selfie" accept="image/*" capture="user" required className="border p-2 rounded w-full bg-white" />
                        <button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded">
                          Upload &amp; Verify Selfie
                        </button>
                      </form>
                    </div>
                  )}

                  {/* ── Terminal states ── */}
                  {app.status === 'SUBMITTED' && (
                    <div className="mt-4 p-4 border rounded bg-teal-50 text-black">
                      <p className="font-semibold">✅ Application submitted and pending review.</p>
                    </div>
                  )}
                  {app.status === 'UNDER_REVIEW' && (
                    <div className="mt-4 p-4 border rounded bg-blue-50 text-black">
                      <p className="font-semibold">🔍 Under review by our team.</p>
                    </div>
                  )}
                  {app.status === 'APPROVED' && (
                    <div className="mt-4 p-4 border rounded bg-green-50 text-black">
                      <p className="font-semibold text-green-700">🎉 Approved!</p>
                    </div>
                  )}
                  {app.status === 'REJECTED' && (
                    <div className="mt-4 p-4 border rounded bg-red-50 text-black">
                      <p className="font-semibold text-red-700">❌ Application rejected.</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

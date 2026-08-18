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

  // Determine if user has any active (non-terminal) application
  const TERMINAL_STATES = ['APPROVED', 'REJECTED']
  const hasActiveApplication = userApplications.some(a => !TERMINAL_STATES.includes(a.status))

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
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Your Applications</h2>

          {/* Only show new application form if no in-progress application exists */}
          {!hasActiveApplication && (
            <form action={async (formData) => {
              'use server';
              const { createApplicationAction } = await import('@/app/actions/application');
              await createApplicationAction(formData);
            }} className="p-6 border border-gray-300 rounded bg-gray-50 text-black flex flex-col gap-4 shadow-sm mb-6">
              <h3 className="font-semibold text-lg border-b pb-2">Start New Application</h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Requested Amount (₹)</label>
                  <input type="number" name="requestedAmount" placeholder="e.g. 500000" className="border border-gray-300 p-2 rounded w-full" required />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tenure (Months)</label>
                  <select name="requestedTenure" className="border border-gray-300 p-2 rounded w-full" required>
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
          )}
        </div>

        {userApplications.length === 0 ? (
          <p className="text-gray-400">No applications found.</p>
        ) : (
          <div className="space-y-4">
            {userApplications.map(app => (
              <div key={app.id} className="border p-4 rounded shadow bg-gray-800 text-white">
                <p><strong>ID:</strong> {app.id}</p>
                <p><strong>Status:</strong> {app.status}</p>
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
                    <p className="text-sm text-gray-400">Use &apos;FAIL&apos; anywhere in ID to simulate rejection. Use &apos;ABCD1234&apos; for a good score.</p>
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
                        placeholder="Enter ID Number"
                        required
                        className="w-full p-2 rounded text-black bg-white border border-gray-300"
                      />
                    </div>
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                      Submit KYC
                    </button>
                  </form>
                )}

                {/* ── STEP 2: Financial Details (initial submission or NOT_ELIGIBLE correction loop) ── */}
                {(app.status === 'KYC_COMPLETED' || app.status === 'NOT_ELIGIBLE') && (
                  <div className="mt-4 p-4 border rounded bg-blue-50 text-black">
                    <h4 className="font-semibold mb-1">
                      {app.status === 'NOT_ELIGIBLE'
                        ? 'Step 2 (Retry): Correct Financial Details'
                        : 'Step 2: Submit Financial Details'}
                    </h4>
                    {app.status === 'NOT_ELIGIBLE' && (
                      <p className="text-sm text-red-600 mb-2">
                        Your previous application was not eligible. Update your details and the requested amount below to try again.
                      </p>
                    )}
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
                        <input type="number" name="monthlyIncome" className="border p-2 rounded w-full" min="1" required />
                      </div>
                      {/* Allow updating requested amount during NOT_ELIGIBLE correction loop */}
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
                            <select name="correctedRequestedTenure" className="border p-2 rounded w-full" required>
                              {[12, 24, 36, 48, 60].map(t => (
                                <option key={t} value={t} selected={app.requestedTenure === t}>{t} Months</option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded mt-2">
                        Sync Credit Bureau &amp; Submit
                      </button>
                    </form>
                  </div>
                )}

                {/* ── STEP 3: Run Eligibility Engine ── */}
                {app.status === 'FINANCIALS_COMPLETED' && (
                  <div className="mt-4 p-4 border rounded bg-indigo-50 text-black">
                    <h4 className="font-semibold mb-2">Step 3: Evaluate Eligibility</h4>
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

                {/* ── STEP 4: Select Loan Terms (only ELIGIBLE / PARTIALLY_ELIGIBLE, NOT TERMS_SELECTED) ── */}
                {(app.status === 'ELIGIBLE' || app.status === 'PARTIALLY_ELIGIBLE') && (
                  <div className="mt-4 p-4 border rounded bg-green-50 text-black">
                    <h4 className="font-semibold mb-1">Step 4: Select Loan Terms</h4>
                    <p className="text-sm mb-3 text-gray-600">
                      Status: <strong>{app.status}</strong>. Confirm or adjust your final loan amount and tenure below.
                    </p>
                    <form action={async (formData) => {
                      'use server';
                      const { generateAndAcceptTermsAction } = await import('@/app/actions/loanTerms');
                      await generateAndAcceptTermsAction(formData);
                    }} className="flex flex-col gap-3">
                      <input type="hidden" name="applicationId" value={app.id} />
                      <div>
                        <label className="block text-sm">Requested Amount (₹)</label>
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
                        <select name="requestedTenure" className="border p-2 rounded w-full" required>
                          {[12, 24, 36, 48, 60].map(t => (
                            <option key={t} value={t} selected={app.requestedTenure === t}>{t} Months</option>
                          ))}
                        </select>
                      </div>
                      <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mt-2">
                        Calculate &amp; Accept Terms
                      </button>
                    </form>
                  </div>
                )}

                {/* ── STEP 5: Bank Verification (TERMS_SELECTED only) ── */}
                {app.status === 'TERMS_SELECTED' && (
                  <div className="mt-4 p-4 border rounded bg-yellow-50 text-black">
                    <h4 className="font-semibold mb-2">Step 5: Bank Account Verification</h4>
                    <p className="text-sm text-gray-600 mb-2">Use an account number ending in 000 to simulate verification failure.</p>
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

                {/* ── STEP 6: Declaration & Consent ── */}
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

                {/* ── STEP 7: Selfie Verification ── */}
                {(app.status === 'DECLARATION_ACCEPTED' || app.status === 'SELFIE_PENDING') && (
                  <div className="mt-4 p-4 border rounded bg-pink-50 text-black">
                    <h4 className="font-semibold mb-2">Step 7: Selfie Verification</h4>
                    <p className="text-sm mb-2">Upload a selfie photo. Include &apos;blur&apos; or &apos;invalid&apos; in the filename to simulate rejection.</p>
                    {app.status === 'SELFIE_PENDING' && (
                      <p className="text-sm text-amber-700 mb-2">⚠ Previous selfie verification failed. Please upload again.</p>
                    )}
                    <form action={async (formData) => {
                      'use server';
                      const { submitSelfieAction } = await import('@/app/actions/selfieVerification');
                      await submitSelfieAction(app.id, formData);
                    }} className="space-y-2">
                      <input type="file" name="selfie" accept="image/*" required className="border p-2 rounded w-full bg-white" />
                      <button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded">
                        Upload &amp; Verify Selfie
                      </button>
                    </form>
                  </div>
                )}

                {/* ── Terminal / info states ── */}
                {app.status === 'SUBMITTED' && (
                  <div className="mt-4 p-4 border rounded bg-teal-50 text-black">
                    <p className="font-semibold">✅ Application submitted successfully and is under review.</p>
                  </div>
                )}
                {app.status === 'UNDER_REVIEW' && (
                  <div className="mt-4 p-4 border rounded bg-blue-50 text-black">
                    <p className="font-semibold">🔍 Application is currently under review by our team.</p>
                  </div>
                )}
                {app.status === 'APPROVED' && (
                  <div className="mt-4 p-4 border rounded bg-green-50 text-black">
                    <p className="font-semibold text-green-700">🎉 Congratulations! Your application has been APPROVED.</p>
                  </div>
                )}
                {app.status === 'REJECTED' && (
                  <div className="mt-4 p-4 border rounded bg-red-50 text-black">
                    <p className="font-semibold text-red-700">❌ Your application was rejected.</p>
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


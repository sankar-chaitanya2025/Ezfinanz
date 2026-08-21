# EZFinanz: Literal Code Trace Guide

This guide is designed for developers who want to open the IDE and literally follow the execution of the program step-by-step. 

Whenever you ask, *"What happens when the user clicks this button?"*, this document gives you the exact file path, function name, and database table involved.

---

## The Master UI File: `src/app/dashboard/page.tsx`
Unlike a traditional multi-page app (e.g., `/kyc`, `/financials`, `/bank`), EZFinanz renders the entire multi-step loan wizard dynamically inside a single Next.js page: `src/app/dashboard/page.tsx`.

It uses the `application.status` from the database to determine which `<form>` to render. 
Each form uses Next.js Server Actions: `<form action={async (formData) => { ... }}>` to send data directly to the backend.

---

## Flow 1: Creating a New Application

1. **User Action**: Clicks "Start New Application" on the empty dashboard.
2. **UI Component**: `src/app/dashboard/page.tsx` (Line ~123).
3. **Server Action**: Calls `createApplicationAction(formData)` located in `src/app/actions/application.ts`.
4. **Domain Service**: The action extracts the `userId` from the Supabase session and calls `ApplicationService.createApplication(userId)` inside `src/services/applicationService.ts`.
5. **Database Operation**: Uses Drizzle ORM to execute an `INSERT` into the `applications` table (`src/db/schema.ts`).
6. **Result**: The application is created with `status = 'DRAFT'`. The Server Action calls `revalidatePath('/dashboard')`, causing the UI to instantly refresh and render the KYC form.

---

## Flow 2: KYC Verification

1. **User Action**: Selects ID type (e.g., PAN) and enters `ABCDE1234F`. Clicks "Verify Identity".
2. **UI Component**: Rendered in `src/app/dashboard/page.tsx` when `status === 'DRAFT'`.
3. **Server Action**: Calls `submitKycAction(applicationId, formData)` from `src/app/actions/kyc.ts`.
4. **Domain Service**: Calls `KycService.processKyc(applicationId, userId, idType, idNumber)` in `src/services/kycService.ts`.
5. **External Provider**: `KycService` instantiates `MockDigilockerProvider` (`src/providers/mockDigilockerProvider.ts`). This mock returns a hardcoded verified name and DOB based on the test PAN.
6. **Database Operation**: 
    - Inserts the verified data into the `kyc_details` table.
    - Calls `ApplicationService.transitionState()` to update the `applications` table `status` to `KYC_COMPLETED`.
7. **Result**: Revalidates the path. The UI now shows the Financials form.

---

## Flow 3: Financial Details & Account Aggregator

1. **User Action**: Inputs employment details and clicks "Connect Bank Account".
2. **UI Component**: Rendered in `src/app/dashboard/page.tsx` when `status === 'KYC_COMPLETED'`.
3. **Server Action**: Calls `submitFinancialsAction` in `src/app/actions/financials.ts`.
4. **Domain Service**: Calls `FinancialsService.processFinancials()` in `src/services/financialsService.ts`.
5. **External Provider**: Uses `MockAccountAggregatorProvider` (`src/providers/mockAccountAggregatorProvider.ts`) which generates a synthetic snapshot of the user's income (e.g., ₹85,000) and existing EMI obligations based on their input.
6. **Database Operation**: 
    - Inserts the financial snapshot into the `financial_details` table.
    - Transitions application `status` to `FINANCIALS_COMPLETED`.

---

## Flow 4: The Algorithmic Eligibility Assessment

1. **User Action**: Clicks the "Check My Eligibility" button.
2. **UI Component**: Rendered in `src/app/dashboard/page.tsx` when `status === 'FINANCIALS_COMPLETED'`.
3. **Server Action**: Calls `evaluateEligibilityAction()` in `src/app/actions/eligibility.ts`.
4. **Domain Service**: Calls `EligibilityService.evaluateEligibility()` in `src/services/eligibilityService.ts`.
5. **The Engine**: The service fetches the user's `financial_details` from the DB and passes them to `EligibilityEngine.evaluate()` in `src/domain/eligibilityEngine.ts`. 
    - *Note: This is a pure TypeScript class, not an AI model or external API.*
    - It validates `income >= 15000`, `creditScore >= 650`, and uses the `MAX_DTI_PERCENTAGE` (50%) to mathematically calculate the maximum eligible loan amount.
6. **Database Operation**: 
    - Inserts the engine's JSON output (including the array of rejection `reasons` if any) into the `eligibility_results` table.
    - Transitions application `status` to `ELIGIBLE` (or `NOT_ELIGIBLE`).

---

## Flow 5: Loan Terms Selection

1. **User Action**: Adjusts the dynamic slider in the UI to pick a specific loan amount and tenure (e.g., 24 months). Clicks "Accept Terms".
2. **UI Component**: Features an interactive `<EmiTermSelector />` component (`src/components/dashboard/EmiTermSelector.tsx`) that calculates EMI instantly on the client.
3. **Server Action**: Submits to `selectLoanTermsAction()` in `src/app/actions/loanTerms.ts`.
4. **Domain Service**: Calls `LoanTermsService.saveTerms()` in `src/services/loanTermsService.ts`.
    - *Security Check*: The backend mathematically re-verifies the EMI, processing fee (2%), and GST (18%) to ensure the user didn't spoof the frontend math.
5. **Database Operation**: 
    - Inserts the final breakdown into the `loan_terms` table.
    - Transitions application `status` to `TERMS_SELECTED`.

---

## Flow 6: Bank Account Verification (Penny Drop)

1. **User Action**: Enters Account Number and IFSC code, clicks "Verify Bank".
2. **UI Component**: Rendered in `dashboard/page.tsx` when `status === 'TERMS_SELECTED'`.
3. **Server Action**: Calls `verifyBankAction()` in `src/app/actions/bankVerification.ts`.
4. **Domain Service**: Calls `BankVerificationService.verifyBankAccount()` in `src/services/bankVerificationService.ts`.
5. **External Provider**: Uses `MockPennyDropProvider` (`src/providers/mockPennyDropProvider.ts`) to return a synthetic account holder name based on the IFSC code.
6. **Validation**: The service uses a fuzzy string matching algorithm to ensure the name from the Penny Drop matches the name we verified earlier in the `kyc_details` step.
7. **Database Operation**: 
    - Inserts into `bank_details`.
    - Transitions application `status` to `BANK_VERIFIED`.

---

## Flow 7: Declaration & Selfie Upload

1. **User Action**: Checks the consent box, accepts the T&Cs.
2. **Server Action**: Calls `acceptDeclarationAction()` (`src/app/actions/declaration.ts`), which calls `DeclarationService.acceptDeclaration()` inserting into the `declarations` table. Moves status to `DECLARATION_ACCEPTED`.
3. **User Action**: Uses their webcam to capture a selfie and clicks upload.
4. **UI Component**: The frontend pushes the file blob directly to **Supabase Storage**. Supabase returns a URL path. The `<form>` then submits this path string.
5. **Server Action**: Calls `submitSelfieAction()` in `src/app/actions/selfieVerification.ts`.
6. **Domain Service**: Calls `SelfieVerificationService.submitSelfie()`.
7. **Database Operation**:
    - Saves the storage path to the `selfie_verifications` table.
    - Transitions application `status` to its terminal user state: `SUBMITTED`.

---

## Flow 8: Admin Review & Approval

1. **User Action (Admin)**: The admin navigates to `/admin`.
2. **UI Component**: `src/app/admin/page.tsx`.
3. **Data Fetching**: The server component directly queries `AdminService.getReviewableApplications()` (`src/services/adminService.ts`) to fetch a list of `SUBMITTED` applications.
4. **Detailed View**: When the admin expands an application, `AdminService.getApplicationDetails()` runs a massive Drizzle JOIN query across all 7 database tables to present a unified view of the user.
5. **User Action (Admin)**: The admin clicks "Approve Application".
6. **Server Action**: Calls `approveApplicationAction()` in `src/app/actions/admin.ts`.
7. **Domain Service**: Calls `AdminService.approveApplication()`.
8. **Final Database Operations**: 
    - Transitions the `applications` table `status` to `APPROVED`.
    - Executes an `INSERT` into the `loans` table. This is the moment the abstract application becomes an active financial asset (`loan_status = 'SANCTIONED'`).

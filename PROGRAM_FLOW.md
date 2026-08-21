# EZFinanz: The Ultimate End-to-End Program Flow

If you want to understand exactly how EZFinanz works under the hood—from the moment a user clicks a button on the screen, down through the network, into the database, and back again—you are in the right place. 

This guide is written like a technical masterclass. We won't just list what happens; we will look at the exact data being passed around, the specific database tables being mutated, and the architectural reasons why the system behaves the way it does.

---

## Part 1: The Architectural Paradigm

Before we trace a user's journey, you must understand the rules of the house. EZFinanz is a **Next.js 15 (App Router)** application. We do not use traditional `fetch()` calls to a separate Express or Python REST API. 

Instead, we use **Server Actions**.

### The Request Flow in EZFinanz
1. **The Client (Browser)**: A user fills out a React form in a Client Component (e.g., `src/app/kyc/page.tsx`).
2. **The Server Action**: When the form is submitted, Next.js intercepts it and securely sends an HTTP POST request to a specialized function running on our Node.js server (e.g., `submitKycAction` in `src/app/actions/application.ts`).
3. **The Domain Service**: The Server Action is just a bouncer at the door. It strips out the data, validates the user's session, and hands the data to a pure business logic class (e.g., `KycService.processKyc()`).
4. **The Database (Drizzle ORM)**: The Domain Service runs SQL queries using Drizzle to talk to our Supabase PostgreSQL database.
5. **The Response**: The Server Action returns a success object or an error string. Next.js instantly revalidates the page, and the user's screen updates without a hard refresh.

---

## Part 2: The User Journey (Meet Rahul)

To make this intuitive, let's trace a concrete example. Meet **Rahul**. Rahul wants a personal loan of ₹3,00,000 to renovate his home. 

### Step 0: Authentication & Identity
Rahul navigates to `/login`. He types `rahul@example.com` and his password.
*   **The Code**: The form calls the `login` function in `src/app/actions/auth.ts`.
*   **What happens behind the scenes?**: We use the `@supabase/ssr` library. It takes Rahul's credentials and talks to the Supabase Auth server. Supabase verifies the password and returns a **JWT (JSON Web Token)**.
*   **The Magic**: Supabase automatically drops this JWT into an HTTP-only cookie in Rahul's browser. Now, every time Rahul clicks a button or requests a page, his browser silently sends this cookie to our server. Our server calls `supabase.auth.getUser()`, reads the cookie, and knows exactly who Rahul is (e.g., `userId: "d8c2b7...").

### Step 1: Creating the Application
Rahul lands on his dashboard. It's empty. He clicks **"Start New Application"**.
*   **The Code**: This triggers `createApplicationAction` which calls `ApplicationService.createApplication(userId)`.
*   **The Database Operation**: Drizzle runs an `INSERT` statement into the `applications` table.
    ```sql
    INSERT INTO applications (id, user_id, status, created_at) 
    VALUES ('app_123', 'd8c2b7...', 'DRAFT', NOW());
    ```
*   Rahul is instantly redirected into the loan wizard. His application state is officially **`DRAFT`**.

### Step 2: KYC (Know Your Customer)
Rahul is asked to enter his PAN number. He enters `ABCDE1234F`.
*   **The Code**: He clicks "Verify". The form data goes to `submitKycAction`. The action extracts the PAN and calls `KycService.processKyc(applicationId, userId, "PAN", "ABCDE1234F")`.
*   **The External Provider**: We need to verify this PAN with the government. Since we don't have a real API key yet, the service relies on an interface: `IKycProvider`. We inject the `MockDigilockerProvider`.
*   **Behind the scenes**: The Mock Provider sees the test PAN and returns a fake payload: 
    ```json
    { "fullName": "Rahul Sharma", "dob": "1990-05-14", "gender": "MALE", "address": "123 Fake Street, Delhi" }
    ```
*   **The Database Operation**: 
    1. The system opens a **Database Transaction** (so if anything fails, it all rolls back).
    2. Drizzle inserts this payload into the `kyc_details` table, linking it to `app_123`.
    3. Crucially, it calls `ApplicationService.transitionState()`, updating the application's status from `DRAFT` to `KYC_COMPLETED`.

### Step 3: The State Machine Security (An Interlude)
What if Rahul is a hacker? What if he tries to use Postman to send a fake request to the "Approve Loan" endpoint right now, skipping all other steps?

This is where the **State Machine** in `ApplicationService.ts` protects the system.
If Rahul tries to jump to `BANK_VERIFIED`, the code does this:
```typescript
// Inside ApplicationService.transitionState()
if (currentStatus !== 'TERMS_SELECTED') {
    throw new Error("Invalid transition: You cannot verify a bank account until you have selected loan terms!");
}
```
Because Rahul's application is currently `KYC_COMPLETED`, the database throws an error and blocks the hack. He *must* follow the exact linear path.

### Step 4: Financials & Account Aggregator
Rahul is now on the Financials page. He inputs his employer name ("TCS") and clicks "Connect Bank Account".
*   **The Code**: `submitFinancialsAction` routes to `FinancialsService.processFinancials()`.
*   **The Integration**: We call the `MockAccountAggregatorProvider`. In a production app, this would use a service like Setu to pull 6 months of bank statements. Our mock looks at Rahul and generates a realistic snapshot:
    ```json
    { "monthlyIncome": 85000, "existingEmiObligations": 12000, "creditScore": 740 }
    ```
*   **The Database Operation**: Insert into `financial_details`. Transition state to `FINANCIALS_COMPLETED`.

### Step 5: The Algorithmic Underwriter (Eligibility Engine)
Rahul clicks "Check My Eligibility". A loading spinner appears.
*   **The Code**: `evaluateEligibilityAction` fires. It calls `EligibilityService.evaluateEligibility()`.
*   **Behind the scenes**: The backend fetches Rahul's financial snapshot from the database and passes it to our pure, deterministic `EligibilityEngine`.
*   **The Math**: 
    1. **Income Check**: Is ₹85,000 > Minimum (₹15,000)? Yes.
    2. **Credit Check**: Is 740 > Minimum (650)? Yes.
    3. **DTI (Debt-to-Income) Check**: The system allows a maximum DTI of 50%. 
       Rahul makes ₹85,000. 50% of that is ₹42,500. This is his "Maximum Allowable Debt".
       He already pays ₹12,000 in EMIs. So, he has ₹30,500 left over for a new loan EMI.
       Using a reverse-EMI formula (Present Value calculation at 12% interest over 5 years), the engine determines that an EMI of ₹30,500 can support a maximum loan of ~₹14,00,000.
*   **The Result**: The engine declares him `ELIGIBLE` for a maximum of ₹14,00,000.
*   **The Database Operation**: 
    1. A new row is inserted into `eligibility_results` saving all this math for audit purposes.
    2. The application transitions to `ELIGIBLE`.

### Step 6: Loan Terms Selection
Rahul sees he is approved for up to ₹14 Lakhs, but he only wants ₹3,00,000. He uses the UI slider to select ₹3,00,000 over 24 months.
*   **The Code**: The frontend calculates the EMI dynamically. When he hits submit, `LoanTermsService.saveTerms()` is called.
*   **Behind the scenes**: The backend strictly recalculates everything to ensure Rahul didn't tamper with the frontend sliders. It calculates:
    - Principal: ₹3,00,000
    - Processing Fee (2%): ₹6,000
    - GST (18% on fee): ₹1,080
    - Net Disbursement: ₹2,92,920
*   **The Database Operation**: Insert into `loan_terms`. Transition to `TERMS_SELECTED`.

### Step 7: Bank Verification (Penny Drop)
We need to ensure Rahul's bank account actually belongs to "Rahul Sharma" (his KYC name) so we don't send money to a fraudster's account.
*   **The Code**: Rahul inputs his HDFC Account Number. `BankVerificationService.verifyBankAccount()` is called.
*   **The Integration**: We use `MockPennyDropProvider`. It simulates sending ₹1 over the IMPS network. The network replies with the name registered at the bank: "RAHUL K SHARMA". 
*   **Behind the scenes**: Our code runs a fuzzy string matching algorithm. "Rahul Sharma" matches "RAHUL K SHARMA" closely enough. Verification passes.
*   **The Database Operation**: Insert into `bank_details`. Transition to `BANK_VERIFIED`.

### Step 8: Final Declaration & Selfie
Rahul accepts the Terms and Conditions (saving his IP address and timestamp to the `declarations` table) and takes a live selfie using his webcam.
*   **The Code**: The selfie image is uploaded directly from Rahul's browser to an encrypted **Supabase Storage Bucket**. Supabase replies with a file path: `selfies/app_123_selfie.jpg`.
*   **The Action**: The form submits this file path to `submitSelfieAction`.
*   **The Database Operation**: Insert the path into `selfie_verifications`.
*   **The Final User Transition**: The application state is updated to **`SUBMITTED`**. Rahul's journey is over. He sees a success screen telling him his application is under review.

---

## Part 3: The Admin Flow (The Finish Line)

Rahul's application is locked. He can no longer edit it. Now, an employee of EZFinanz logs in.

1. **The Admin Queue (`src/app/admin/page.tsx`)**: The admin logs in. The server component runs `AdminService.getReviewableApplications()`, querying the database for all applications in `SUBMITTED` or `UNDER_REVIEW` states.
2. **Reviewing the Data**: The admin clicks Rahul's application. The backend runs a massive Drizzle query joining `applications`, `kyc_details`, `financial_details`, `eligibility_results`, `loan_terms`, `bank_details`, and `selfie_verifications`. 
3. **The Decision**: The admin looks at Rahul's selfie, compares it to his KYC data, checks the algorithmic approval, and clicks **Approve**.
4. **The Code**: `approveApplicationAction` triggers `AdminService.approveApplication()`.
5. **The Final Database Operation**:
    *   The application status is updated to **`APPROVED`**.
    *   A brand new row is created in the highly-protected `loans` table.
    ```sql
    INSERT INTO loans (application_id, user_id, status, sanctioned_amount, outstanding_balance) 
    VALUES ('app_123', 'd8c2b7...', 'SANCTIONED', 300000, 300000);
    ```

### The End
Rahul gets a notification. His loan of ₹3,00,000 has been sanctioned and is pending automated disbursement by the finance team. The cycle is complete!

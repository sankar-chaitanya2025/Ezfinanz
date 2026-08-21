# EZFinanz: Product & Architecture Deep-Dive

Welcome to the EZFinanz deep-dive. This document is designed to help you understand not just **what** we built, but **why** we built it this way. It covers the product vision, the system architecture, and the concrete technical trade-offs made along the way.

---

## 1. The Product & The Problem Space

### What is EZFinanz?
EZFinanz is an instant, digital-first consumer lending platform. It allows users to apply for personal loans (up to ₹5,00,000), get their financial eligibility assessed via AI, and receive a loan sanction—all within a matter of minutes, entirely online.

### Target Users & Pain Points
1. **The Consumer (Borrower)**: Modern users hate paperwork, branch visits, and waiting days for loan approvals. They want a "one-click" experience.
2. **The Administrator (Lender)**: Reviewing hundreds of applications manually is slow and error-prone. Admins need a dashboard that aggregates verified data and AI risk assessments to make fast, informed decisions.

---

## 2. Core Product Workflow

The loan application is modeled as a strict, unidirectional **State Machine**. A user cannot skip steps or spoof their application state. 

Here is the exact journey from the user's perspective:

1. **Authentication**: User signs up/logs in (Supabase Auth).
2. **Dashboard**: User clicks "Start New Application". The app enters the `DRAFT` state.
3. **KYC Verification (`KYC_PENDING` → `KYC_COMPLETED`)**: User verifies identity. In this V1, we simulate a DigiLocker integration to fetch PAN/Aadhar details securely.
4. **Financials (`FINANCIALS_COMPLETED`)**: User connects their bank account. We simulate an Account Aggregator (AA) framework to pull their salary, existing EMIs, and credit score.
5. **AI Eligibility (`ELIGIBILITY_PENDING` → `ELIGIBLE` / `NOT_ELIGIBLE`)**: The system feeds the KYC and Financial data into a Gemini AI model. The AI acts as the underwriter, calculating the Debt-to-Income (DTI) ratio and deciding the maximum eligible amount.
6. **Loan Terms (`TERMS_SELECTED`)**: The user selects their desired tenure (e.g., 12, 24, 36 months). The system calculates the exact EMI, interest, and processing fees.
7. **Bank Verification (`BANK_VERIFIED`)**: We simulate a "Penny Drop" verification to ensure the bank account belongs to the user and is active.
8. **Final Declaration (`DECLARATION_ACCEPTED`)**: The user accepts the legal terms and conditions.
9. **Selfie Verification (`SELFIE_PENDING` → `SUBMITTED`)**: An anti-fraud measure. The user uploads a live selfie to match against their KYC photo.
10. **Admin Review (`UNDER_REVIEW` → `APPROVED` / `REJECTED`)**: The application lands in the Admin Queue. An admin reviews the AI's assessment and the user's data, making the final call.

---

## 3. System Architecture & Tech Stack

EZFinanz is built on a modern, serverless-first stack designed for high iteration speed and absolute type safety.

*   **Framework**: Next.js 15 (App Router)
*   **Database**: Supabase (PostgreSQL)
*   **ORM**: Drizzle ORM
*   **Authentication**: Supabase Auth
*   **Styling & UI**: Tailwind CSS, Shadcn UI, Lucide Icons
*   **Animations**: GSAP, React Three Fiber (ShaderGradients)
*   **AI Engine**: Google Gemini (via `@google/genai`)

### High-Level Request Flow
1. **Client** calls a **Server Action** (e.g., `submitKycAction`).
2. **Server Action** validates input and calls the corresponding **Domain Service** (e.g., `KycService.processKyc`).
3. **Domain Service** enforces business logic, calls external providers (e.g., `MockDigilockerProvider`), and interacts with **Drizzle ORM** to update the database.
4. **ApplicationService** strictly transitions the application to the next state.
5. **Next.js** revalidates the path, instantly reflecting the new UI state to the user without a hard reload.

---

## 4. Key Technical & Design Decisions (The "Why")

### Decision 1: Next.js Server Actions over a REST API
*   **Why?** In traditional SPAs (React + Express), you have to manage API endpoints, fetch calls, loading states, and type-sharing between client and server. By using Next.js Server Actions, we eliminated the entire network boilerplate layer. Functions written on the server can be called directly from client forms (`<form action={myServerAction}>`).
*   **Trade-off**: Server Actions tightly couple the frontend and backend. If we ever want to build a native mobile app (React Native/Swift), we will have to build a separate REST/GraphQL API layer later.

### Decision 2: The Strict State Machine (`ApplicationService`)
*   **Why?** In fintech, state management is a massive security vector. If a user forces a POST request to `/api/loan-terms` before completing KYC, the system must reject it. Instead of writing ad-hoc checks in every route, we built a centralized `ApplicationService`. All state transitions *must* go through this service, which validates the `previousState` before moving to the `newState`.

### Decision 3: Mocking External Services via Interfaces
*   **Why?** Real banking APIs (DigiLocker, Setu/Onemoney for Account Aggregators, Penny Drop APIs) require rigorous compliance, business registrations, and paid API keys. We wanted to build the entire product end-to-end without being blocked by third parties.
*   **How?** We used the Strategy Pattern. We defined strict TypeScript interfaces (e.g., `IKycProvider`). Our `MockDigilockerProvider` implements this interface. When the startup gets regulatory approval, we just swap the mock class for a `RealDigilockerProvider` without changing a single line of business logic.

### Decision 4: Gemini AI for Risk Assessment
*   **Why AI instead of a rigid math formula?** Traditional underwriting uses strict rules (e.g., `if credit_score < 700 then reject`). AI allows for nuanced risk assessment. For example, if a user has a low credit score but their salary just doubled and they have zero existing EMIs, the AI can flag them as "Partially Eligible" rather than an outright rejection. 
*   **Safety net**: The AI doesn't have the final say on actual money disbursement—it flags the application for the human Admin to review. We also enforce structured JSON output from Gemini to ensure the backend doesn't crash parsing the AI's response.

### Decision 5: Drizzle ORM over Prisma
*   **Why?** Prisma abstracts SQL away heavily, which is great for beginners but bad for complex, optimized queries. Drizzle ORM provides a SQL-like syntax that is 100% type-safe. It also runs flawlessly on Edge runtimes, whereas Prisma historically struggled with connection pooling on serverless.

### Decision 6: The "Premium" Frontend Aesthetic
*   **Why?** Finance apps are traditionally boring, enterprise-looking, and clinical. We wanted EZFinanz to feel like a premium, modern consumer product (like Apple Card or CRED). We achieved this using Shadcn for pixel-perfect components, and WebGL (HeroShaderGradient) for stunning, dynamic visuals on the landing page and auth screens.

---

## 5. What We Deliberately Did *NOT* Build (And Why)

1. **Payment Gateways (Disbursement/Repayment)**: We modeled the database for it (`disbursedAmount`, `outstandingBalance`), but we did not integrate Stripe or Razorpay. Actual money movement requires escrow accounts and RBI/SEC compliance, which is out of scope for the software V1.
2. **Complex Role-Based Access Control (RBAC)**: We have `CUSTOMER` and `ADMIN`. We did not build granular admin roles (e.g., "Underwriter", "Auditor", "Support") because it adds unnecessary complexity before achieving product-market fit.
3. **Real-time WebSockets**: The Admin queue refreshes on page load. We skipped real-time WebSockets (Supabase Realtime) for now to keep the serverless architecture simple and cheap.

---

## 6. Database Schema & Data Flow

The database is highly normalized. The anchor of the system is the `applications` table.

*   `users` (1) ---> (M) `applications`
*   `applications` (1) ---> (1) `kyc_details`
*   `applications` (1) ---> (1) `financial_details`
*   `applications` (1) ---> (M) `eligibility_results` (We keep a history if the user corrects their data and re-evaluates).
*   `applications` (1) ---> (1) `loan_terms`
*   `applications` (1) ---> (1) `bank_details`
*   `applications` (1) ---> (1) `loans` (Created only after Admin approves the application).

**Denormalization Note**: You'll notice `loans` has both `application_id` and `user_id`. While `user_id` could be derived by joining `applications`, we denormalized it into `loans` to make fetching "all loans for a user" extremely fast (O(1) index lookup).

---

## 7. Current Limitations & Future Scalability

If this app scales to 100,000 concurrent users, here is what will break and how we'd fix it:

1. **AI Bottleneck**: Calling Gemini synchronously during the application flow means the user is staring at a loading spinner for 3-5 seconds. 
   * *Fix*: Move the AI evaluation to a background queue (e.g., Inngest or AWS SQS). The user goes to a "Processing..." screen, and we use Server-Sent Events (SSE) or WebSockets to notify them when the AI is done.
2. **Admin Queue N+1 Queries**: Currently, the Admin dashboard fetches applications and then loops through them to fetch detailed KYC/Financial data. 
   * *Fix*: Write a complex SQL `JOIN` in Drizzle to fetch the queue and its associated data in a single query.
3. **Idempotency**: If a user double-clicks the "Submit" button, Server Actions might trigger twice. 
   * *Fix*: Implement idempotency keys in the database to ensure state transitions cannot be duplicated within a 5-second window.

---

## Conclusion
EZFinanz is a highly structured, scalable, and visually stunning lending platform. By leveraging Next.js Server Actions for tight frontend/backend coupling, a strict State Machine for security, and AI for nuanced underwriting, it represents a modern approach to fintech engineering.

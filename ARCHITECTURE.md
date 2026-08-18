# EZFinanz Architecture & Design Decisions

This document records the meaningful architectural and design trade-offs made during the implementation of the EZFinanz Personal Loan Application Platform.

## 1. Separation of Application and Loan Entities

*   **Decision:** We model a customer's `Application` as an immutable snapshot of a specific loan journey in time, distinct from the actual `Loan` product. 
*   **Alternatives:** We considered using a single `Loan` table that tracks status from `DRAFT` to `CLOSED`.
*   **Why:** A user might have multiple applications (some rejected, some abandoned). Tying identity and external data directly to a single mutating loan record prevents historical auditing and point-in-time point-of-truth reconstruction. 
*   **Trade-off:** We gain strict auditability and historical accuracy, but give up some query simplicity (requiring joins across `applications` and `loans`).

## 2. Denormalization of `loans.userId`

*   **Decision:** We intentionally duplicated `user_id` onto the `loans` table, enforcing the invariant `loans.userId === applications.userId`.
*   **Alternatives:** Strictly navigating `loans -> applications -> users` to find a user's active loans.
*   **Why:** Fetching a user's active portfolio is the most common read path for the dashboard. Denormalizing this foreign key simplifies indexes, permissions (Row Level Security), and read queries.
*   **Trade-off:** We gain significant query performance and simplicity at the cost of theoretically maintaining an invariant across two tables.

## 3. Remote vs Local Supabase Development

*   **Decision:** We are using a hosted, remote Supabase instance for development rather than a local Docker setup.
*   **Alternatives:** Running `supabase start` via Docker to spin up the full stack locally.
*   **Why:** It minimizes local environment dependencies and allows immediate parity with the production deployment model, which is useful given the tight assignment constraints.
*   **Trade-off:** We gain speed of setup and zero local footprint, but give up offline development capability.

## 4. Supabase Auth as Absolute Identity Source of Truth

*   **Decision:** The application's `users` table acts merely as a profile projection. We do not store passwords, hashes, or verification states.
*   **Alternatives:** Building a custom NextAuth.js session strategy synced with our database.
*   **Why:** Supabase Auth is secure, battle-tested, and natively supports phone/email verification required by the assignment.
*   **Trade-off:** We gain robust security and offload session management complexity, but we tightly couple our identity layer to the Supabase ecosystem.

## 5. Append-only Eligibility Results (1:N)

*   **Decision:** `eligibility_results` has a 1:N relationship with `applications`, utilizing an `evaluation_version` column to track recalculations.
*   **Alternatives:** A 1:1 relationship where editing financial details overwrites the previous eligibility result.
*   **Why:** If a user is rejected, modifies their stated income, and is subsequently approved, an auditor or reviewer needs to see the history of evaluations that led to the final decision.
*   **Trade-off:** We gain a full historical audit trail of the rules engine, but we give up a simpler 1:1 data model. 

## 6. User Profile Synchronization

*   **Decision:** We synchronize newly registered Supabase Auth users to our application's `users` table directly within the Next.js Server Action (`signup`) rather than using a Postgres Database Trigger or a Webhook.
*   **Alternatives:** 
    1. Postgres Database Trigger on `auth.users` insert.
    2. Supabase Edge Function Webhook on user creation.
*   **Why:** For this assignment, keeping the sync logic within the application codebase (Server Actions) ensures it is easily discoverable, version-controlled, and doesn't require complex remote database configuration outside of the standard Drizzle migrations.
*   **Trade-off:** We gain simplicity and codebase cohesion, but give up guaranteed sync for users created outside the application UI (e.g., manually via the Supabase Dashboard).

## 7. Explicit Handling of Email Verification State

*   **Decision:** The signup Server Action explicitly checks for a null `session` upon successful user creation to route the user to an "email verification required" state, rather than blindly redirecting to the dashboard. During development, email confirmations are disabled to prevent Supabase rate-limiting.
*   **Alternatives:** Assuming signup always yields an active session.
*   **Why:** Supabase Auth (with email confirmations enabled) creates the user but prevents login until verified. Failing to handle this null session causes the route protection middleware to silently bounce the user back to the login page, creating a confusing experience.
*   **Trade-off:** We gain robust auth state handling and a correct authentication flow, but must manage more explicit routing logic in our Server Actions.

## 8. Concurrent Application Constraints

*   **Decision:** A user may have multiple applications over time, but is restricted to at most one *active/in-progress* application at any given time. Terminal states (`REJECTED`, `APPROVED` which implies `DISBURSED` or loan active eventually) allow new application creation. Existing active loans do not block new application creation.
*   **Alternatives:** 
    1. Blocking new applications if a user has an active loan.
    2. Allowing multiple concurrent in-progress applications.
*   **Why:** Preventing concurrent in-progress applications greatly simplifies state management and prevents users from spamming the origination flow. However, an active loan should not block a new application because a customer might qualify for multiple products. The risk assessment (Eligibility Engine) handles the financial impact of the active loan.
*   **Trade-off:** Simplifies the UX and state machine, but requires strict enforcement during the creation flow.

## 9. Separation of Concerns: Origination vs. Eligibility

*   **Decision:** The Application Service strictly manages origination (creation, state transitions, audit logs), while an independent Eligibility Engine will handle all financial risk logic (evaluating external credit obligations, past defaults, and income).
*   **Alternatives:** Checking for defaulted loans or high debt-to-income ratios during the initial application creation step.
*   **Why:** We separate workflow mechanics from business rules. If a user has a defaulted loan, they can still *create* an application, but the Eligibility Engine will reject it at the appropriate step. This keeps the state machine pure and the rules engine decoupled.
*   **Trade-off:** We gain architectural purity, but a user might fill out initial KYC steps only to be automatically rejected later due to pre-existing data.

## 10. KYC Failure Handling and Retries

*   **Decision:** A failed KYC verification (e.g. invalid ID) leaves the application in `KYC_PENDING` rather than transitioning to a terminal `REJECTED` state. The `kyc_details` row is upserted with a `FAILED` verification status, and the user is permitted to retry.
*   **Alternatives:** Rejecting the application entirely upon KYC failure.
*   **Why:** External KYC providers can fail for technical reasons or simple user typos. Rejecting the entire application forces the user to restart the origination flow, resulting in poor UX. Upserting the `kyc_details` row leverages the `UNIQUE(applicationId)` constraint effectively while maintaining the domain rule of one KYC snapshot per application. The audit log maintains the historical record of failed attempts.
*   **Trade-off:** Requires slightly more robust UPSERT logic in the backend, but significantly improves user conversion.

## 11. Cross-Account Identity Deduplication

*   **Decision:** We enforce a strict invariant: a verified identity (`id_type`, `id_number_hash`) may be reused by the *same* user across multiple applications, but MUST NOT be used by a *different* user. This is enforced via an application-level Read-then-Write query within the same database transaction as the KYC insertion, strictly avoiding frozen schema changes.
*   **Alternatives:** Altering the database schema to add triggers, conditional unique indexes, or a `user_identities` table.
*   **Why:** A simple `UNIQUE(id_type, id_number_hash)` constraint on `kyc_details` would incorrectly block the *same* user from originating multiple applications over time. Changing the schema violates the frozen architecture requirement. The application-level transactional check minimizes race-condition risks sufficiently for this specific business flow.
*   **Trade-off:** We perfectly preserve the frozen schema and achieve business rule compliance, but theoretically accept a marginal vulnerability to millisecond-level race conditions under Postgres `READ COMMITTED` isolation.

## 12. External Credit Obligations Sync Strategy

*   **Decision:** The `external_credit_obligations` table is treated as a localized snapshot/cache of the mock credit bureau's current truth for a given user. During a financial sync, all existing obligations for the user are deleted and replaced (Wipe-and-Replace) with the fresh bureau payload inside a single database transaction.
*   **Alternatives:** Attempting to `UPSERT` external obligations.
*   **Why:** The frozen database schema does not have an `externalReferenceId` column in `external_credit_obligations`. Without a unique external identifier, it is impossible to safely upsert individual external loans on repeated syncs (e.g. during correction loops). Wipe-and-Replace ensures no duplicate records are created, perfectly preserving the frozen schema while satisfying the business rule.
*   **Trade-off:** We lose the historical tracking of external obligations that the bureau might drop from its report, but this is an acceptable tradeoff since external credit history should fundamentally reflect the bureau's current truth.

## 13. Existing EMI Aggregation Rule

*   **Decision:** The `existingEmiObligations` snapshot stored in `financial_details` is calculated by summing the `emiAmount` of all external obligations where the status is `ACTIVE` or `DEFAULTED` only. `CLOSED` or `SANCTIONED` (un-disbursed) obligations contribute 0 to the current EMI burden.
*   **Alternatives:** Summing all obligations regardless of status, or dynamically calculating it at runtime.
*   **Why:** A snapshot is necessary for the Eligibility Engine to use immutable inputs. Excluding closed loans correctly reflects the applicant's current debt burden.
*   **Trade-off:** The snapshot is fixed at the time of `FINANCIALS_COMPLETED`. If the user waits 6 months to proceed, the snapshot might be stale. However, this is an intentional domain design choice (immutable snapshots).

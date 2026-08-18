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

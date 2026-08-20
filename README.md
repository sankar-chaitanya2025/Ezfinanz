<h1 align="center">
  <br />
  EZFinanz
  <br />
</h1>

<h4 align="center">A deterministic, full-stack personal loan platform built with Next.js, Supabase, and Drizzle ORM.</h4>

<p align="center">
  <a href="#what-is-ezfinanz">What is EZFinanz?</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#how-the-loan-flow-works">Loan Flow</a> •
  <a href="#the-eligibility-engine">Eligibility Engine</a> •
  <a href="#database-schema">Database Schema</a> •
  <a href="#testing">Testing</a> •
  <a href="#admin-panel">Admin Panel</a>
</p>

---

## What is EZFinanz?

EZFinanz is a **personal loan origination platform** that takes a user from zero to a fully underwritten loan decision — entirely online and in minutes.

It is not a marketing demo. Every step is backed by real business logic:

- **Instant eligibility** using a pure, deterministic rules engine (no black-box ML)
- **Full KYC verification** with ID hashing, cross-account deduplication, and retry handling
- **Bank account sync** with mock bureau integration
- **Transparent loan terms** — every rate, fee, and EMI is calculated on-demand and shown upfront
- **Admin review portal** — human-in-the-loop approval with selfie verification
- **Immutable audit trail** — every state transition is logged forever

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router) | Full-stack React, SSR, Server Actions |
| **Language** | TypeScript | Type-safe across the entire codebase |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) | Utility-first styling |
| **Database** | [PostgreSQL](https://www.postgresql.org) via [Supabase](https://supabase.com) | Relational data + Row Level Security |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team) | Type-safe SQL queries and migrations |
| **Auth** | [Supabase Auth](https://supabase.com/auth) | Email/password authentication |
| **File Storage** | [Supabase Storage](https://supabase.com/storage) | Selfie image uploads |
| **Animations** | [GSAP](https://gsap.com) + [Framer Motion](https://www.framer.com/motion/) | Scroll-driven and micro-animations |
| **Testing** | [Vitest](https://vitest.dev) | Unit tests for services and domain logic |

---

## Features

### For Users (Customers)

- 🔐 **Sign up / Log in** with email and password
- 📋 **KYC Verification** — submit Aadhar or PAN with full ID deduplication
- 💼 **Financial Profile** — declare income, employment type, and existing EMIs
- ✅ **Instant Eligibility Decision** — approved, partially eligible, or rejected in seconds with clear reasons
- 💰 **Custom Loan Terms** — choose your exact loan amount and tenure; see every rupee of fees and interest upfront
- 🏦 **Bank Account Sync** — verify your bank account number and IFSC before disbursement
- 🤳 **Selfie Capture** — live identity confirmation before final submission
- 📄 **Digital Declaration** — timestamped consent for regulatory compliance

### For Admins

- 📂 **Application Queue** — view all submitted applications with their current status
- 🔍 **Full Application Review** — inspect every KYC detail, financial snapshot, selfie, and audit log
- ✅ / ❌ **Approve or Reject** — with mandatory reviewer notes
- 📊 **Disburse Loans** — trigger disbursement after approval

---

## Getting Started

### Prerequisites

Before you begin, make sure you have:

- [Node.js](https://nodejs.org/) 18+ installed
- A [Supabase](https://supabase.com) account (free tier is enough)
- [Git](https://git-scm.com/) installed

### 1. Clone the Repository

```bash
git clone https://github.com/sankar-chaitanya2025/Ezfinanz.git
cd Ezfinanz
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root of the project:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
DATABASE_URL=your_supabase_postgresql_connection_string
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

> 💡 **Where to find these values:**
> Go to your Supabase project → **Settings → API** for the URL and keys.
> Go to **Settings → Database** for the connection string.

### 4. Push the Database Schema

EZFinanz uses **Drizzle ORM** to manage the database schema. Run this command to create all the tables in your Supabase database:

```bash
npm run db:push
```

### 5. (Optional) Create the Supabase Storage Bucket

Selfie photos are stored in Supabase Storage. Run this once:

```bash
npx tsx create_bucket.ts
```

### 6. Run the Development Server

```bash
npm run dev
```

The app will be available at **http://localhost:3000**.

---

## Project Structure

```
Ezfinanz/
│
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Landing page
│   │   ├── login/              # Login page
│   │   ├── signup/             # Sign-up page
│   │   ├── dashboard/          # Main user application flow
│   │   ├── admin/              # Admin review portal
│   │   └── actions/            # Next.js Server Actions (form handlers)
│   │
│   ├── components/
│   │   └── landing/            # Landing page UI components
│   │       ├── HeroSection.tsx
│   │       ├── HowItWorksSection.tsx
│   │       ├── FeatureGrid.tsx
│   │       ├── EligibilityCard.tsx
│   │       └── FinalCTA.tsx
│   │
│   ├── domain/
│   │   └── eligibilityEngine.ts  # Pure business rules engine (no DB deps)
│   │
│   ├── services/               # Data access layer — all DB queries live here
│   │   ├── applicationService.ts
│   │   ├── kycService.ts
│   │   ├── financialService.ts
│   │   ├── eligibilityService.ts
│   │   ├── loanTermsService.ts
│   │   ├── bankVerificationService.ts
│   │   ├── selfieVerificationService.ts
│   │   ├── declarationService.ts
│   │   └── adminService.ts
│   │
│   ├── db/
│   │   └── schema.ts           # Drizzle ORM table definitions (single source of truth)
│   │
│   ├── providers/
│   │   └── mockBankProvider.ts # Mock external bank/bureau API
│   │
│   ├── lib/                    # Supabase client helpers
│   └── middleware.ts           # Route protection (auth guard)
│
├── tests/                      # Vitest unit tests
├── drizzle/                    # Auto-generated SQL migration files
├── ARCHITECTURE.md             # Deep-dive into every design decision
└── package.json
```

---

## How the Loan Flow Works

A user moves through a **15-state application state machine** from start to finish. Each step is sequential and protected — you cannot skip to a later stage.

```
DRAFT
  └─► KYC_PENDING
        └─► KYC_COMPLETED
              └─► FINANCIALS_COMPLETED
                    └─► ELIGIBILITY_PENDING
                          ├─► ELIGIBLE ──────────────────────────────────►
                          ├─► PARTIALLY_ELIGIBLE  ─► TERMS_SELECTED      │
                          └─► NOT_ELIGIBLE            └─► BANK_VERIFIED   │
                                                            └─► DECLARATION_ACCEPTED
                                                                  └─► SELFIE_PENDING
                                                                        └─► SUBMITTED
                                                                              └─► UNDER_REVIEW
                                                                                    ├─► APPROVED → Loan Created
                                                                                    └─► REJECTED
```

### Step-by-Step Breakdown

| # | State | What happens |
|---|---|---|
| 1 | `DRAFT` | User creates their first application |
| 2 | `KYC_PENDING` | User submits Aadhar/PAN details (ID is hashed, cross-account checked) |
| 3 | `KYC_COMPLETED` | KYC verified — user can proceed |
| 4 | `FINANCIALS_COMPLETED` | User declares income, employer, and existing EMIs |
| 5 | `ELIGIBILITY_PENDING` | System evaluates eligibility using the rules engine |
| 6 | `ELIGIBLE` / `PARTIALLY_ELIGIBLE` | User receives their maximum loan amount and DTI |
| 7 | `TERMS_SELECTED` | User picks an amount and tenure; full EMI breakdown displayed |
| 8 | `BANK_VERIFIED` | Bank account number + IFSC confirmed via mock bureau |
| 9 | `DECLARATION_ACCEPTED` | User accepts consent text with IP-timestamped record |
| 10 | `SELFIE_PENDING` | Selfie uploaded and stored in Supabase Storage |
| 11 | `SUBMITTED` | Application sent to admin queue for human review |
| 12 | `UNDER_REVIEW` | Admin opens the application |
| 13 | `APPROVED` | Admin approves → loan record created |
| 14 | `REJECTED` | Admin rejects with mandatory notes |

---

## The Eligibility Engine

The `EligibilityEngine` at `src/domain/eligibilityEngine.ts` is **entirely pure TypeScript** — it does not touch the database, HTTP, or any framework. This makes it:

- **100% unit-testable** with no mocks needed
- **Deterministic** — same inputs always produce the same output
- **Independently auditable** by a compliance officer reading the code

### Business Rules

| Rule | Threshold |
|---|---|
| Minimum monthly income | ₹15,000 |
| Minimum credit score to be eligible | 650 |
| Credit score for full eligibility | 700+ |
| Maximum debt-to-income (DTI) ratio | 50% |
| Maximum loan amount | ₹50,00,000 (₹50 Lakhs) |
| Annual interest rate (fixed) | 12% |
| Maximum loan tenure | 60 months |

### Eligibility Decision Logic

1. **Input validation** — amount > 0, credit score present, income ≥ ₹15,000
2. **Credit score check** — score below 650 → `NOT_ELIGIBLE`
3. **Affordability calculation** — Max EMI = (50% of income) − existing EMIs
4. **Maximum eligible amount** — derived from max EMI using the standard EMI present-value formula
5. **Decision**:
   - Requested amount ≤ max eligible AND score ≥ 700 → **`ELIGIBLE`**
   - Score 650–699 OR requested > max eligible → **`PARTIALLY_ELIGIBLE`**
   - Any hard-limit breach → **`NOT_ELIGIBLE`**

### EMI Formula

EZFinanz uses the standard **reducing-balance EMI formula**:

```
EMI = P × r × (1 + r)^n / ((1 + r)^n − 1)

Where:
  P = Principal (loan amount)
  r = Monthly interest rate (annual rate ÷ 12)
  n = Tenure in months
```

### Loan Term Calculations

Every term sheet includes:

| Field | Formula / Description |
|---|---|
| **EMI** | Standard reducing-balance formula |
| **Processing Fee** | 2% of loan amount |
| **GST** | 18% on processing fee |
| **Total Interest** | (EMI × tenure) − principal |
| **Total Charges** | Processing fee + GST |
| **Total Repayment** | Principal + total interest |
| **Net Disbursement** | Principal − processing fee − GST |
| **IRR (Annualized)** | Periodic monthly IRR × 12 (Newton-Raphson solver) |

---

## Database Schema

The database has **12 tables** with strict referential integrity and immutable audit records.

```
users ◄──────────────── applications ──────────────────────────────────────►
  │                           │
  │              ┌────────────┼─────────────────────────┐
  │              │            │                         │
  ▼              ▼            ▼                         ▼
loans       kycDetails  financialDetails         eligibilityResults
                                                  (1:N, append-only)
               │
   ┌───────────┼──────────────────────────────────┐
   │           │              │                    │
   ▼           ▼              ▼                    ▼
loanTerms  bankDetails  selfieVerifications   declarations
                                                   │
                                            auditLogs (immutable)
```

### Key Design Decisions

- **Applications are immutable snapshots** — they don't mutate like a single `Loan` entity
- **`eligibility_results` is append-only** (1:N) — every recalculation is preserved for auditing
- **ID numbers are hashed** — `idNumberHash` is stored, never the raw Aadhar/PAN number
- **`loans.userId` is denormalized** — for fast portfolio queries without joins
- **All state transitions are logged** in `audit_logs` and can never be deleted

---

## Testing

EZFinanz has a full unit test suite for all services and the domain engine.

```bash
# Run all tests
npx vitest

# Run tests with watch mode
npx vitest --watch
```

### What's Tested

| Test File | What it covers |
|---|---|
| `eligibilityService.test.ts` | All eligibility decision paths, DTI edge cases |
| `loanTermsService.test.ts` | EMI calculations, IRR, fee breakdowns |
| `bankVerificationService.test.ts` | Bank account verification and mock bureau sync |
| `declarationService.test.ts` | Consent recording and state guard |
| `selfieVerificationService.test.ts` | Upload storage path logic and state transitions |

---

## Admin Panel

Accessible at `/admin` — only users with `role = 'ADMIN'` can access this route (enforced by both middleware and the database service layer).

### How to Promote a User to Admin

1. Open **Supabase Dashboard → Table Editor → users**
2. Find the user by email
3. Change `role` from `CUSTOMER` to `ADMIN`
4. Save

The next time that user logs in, they will be routed to `/admin`.

### What Admins Can Do

- View the full application queue with all submitted applications
- Open any application and read KYC details, financial snapshot, selfie image, and the full audit log
- Approve with an immediate loan creation, or reject with mandatory reviewer notes

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server at `localhost:3000` |
| `npm run build` | Build the production bundle |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate a new Drizzle migration from schema changes |
| `npm run db:push` | Push current schema directly to the database (no migration file) |
| `npm run db:studio` | Open Drizzle Studio — a visual database browser |
| `npm run db:seed` | Seed the database with test data |
| `npx vitest` | Run all unit tests |

---

## Architecture Deep-Dive

For the detailed reasoning behind every design decision — data modelling, concurrency constraints, KYC deduplication strategy, IRR calculation method, and more — read **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

---

## Roadmap

- [ ] SMS/OTP verification (Supabase phone auth)
- [ ] Real credit bureau API integration (currently mocked)
- [ ] Email notifications for approval/rejection
- [ ] Repayment schedule and EMI tracker in the dashboard
- [ ] Webhook for disbursement status from a payment gateway

---

## License

This project was built as a technical demonstration. All rights reserved.

---

<p align="center">Built with ❤️ by Sankar Chaitanya</p>

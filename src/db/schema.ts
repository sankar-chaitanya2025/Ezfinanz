import { 
  pgTable, 
  uuid, 
  varchar, 
  timestamp, 
  numeric, 
  integer, 
  text,
  date,
  jsonb,
  pgEnum,
  unique
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- ENUMS ---
export const roleEnum = pgEnum('role', ['CUSTOMER', 'ADMIN']);
export const applicationStateEnum = pgEnum('application_state', [
  'DRAFT', 
  'KYC_PENDING', 
  'KYC_COMPLETED', 
  'FINANCIALS_COMPLETED', 
  'ELIGIBILITY_PENDING', 
  'ELIGIBLE', 
  'PARTIALLY_ELIGIBLE', 
  'NOT_ELIGIBLE', 
  'TERMS_SELECTED', 
  'BANK_VERIFIED', 
  'DECLARATION_ACCEPTED', 
  'SELFIE_PENDING', 
  'SUBMITTED', 
  'UNDER_REVIEW', 
  'APPROVED', 
  'REJECTED'
]);
export const loanStatusEnum = pgEnum('loan_status', ['SANCTIONED', 'DISBURSEMENT_PENDING', 'ACTIVE', 'CLOSED', 'DEFAULTED']);
export const verificationStatusEnum = pgEnum('verification_status', ['PENDING', 'VERIFIED', 'FAILED']);
export const idTypeEnum = pgEnum('id_type', ['AADHAR', 'PAN']);
export const genderEnum = pgEnum('gender', ['MALE', 'FEMALE', 'OTHER']);
export const employmentTypeEnum = pgEnum('employment_type', ['SALARIED', 'SELF_EMPLOYED']);
export const eligibilityDecisionEnum = pgEnum('eligibility_decision', ['ELIGIBLE', 'PARTIALLY_ELIGIBLE', 'NOT_ELIGIBLE']);

// --- TABLES ---

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // Maps to Supabase Auth UUID
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).unique(),
  role: roleEnum('role').default('CUSTOMER').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const applications = pgTable('applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  status: applicationStateEnum('status').default('DRAFT').notNull(),
  requestedAmount: numeric('requested_amount'),
  requestedTenure: integer('requested_tenure'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  submittedAt: timestamp('submitted_at'),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  reviewTimestamp: timestamp('review_timestamp'),
});

export const loans = pgTable('loans', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull().unique().references(() => applications.id),
  userId: uuid('user_id').notNull().references(() => users.id), // Denormalized invariant: loans.user_id === applications.user_id
  status: loanStatusEnum('status').notNull(),
  sanctionedAmount: numeric('sanctioned_amount').notNull(),
  disbursedAmount: numeric('disbursed_amount'),
  outstandingBalance: numeric('outstanding_balance').notNull(),
  sanctionedAt: timestamp('sanctioned_at'),
  disbursedAt: timestamp('disbursed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const externalCreditObligations = pgTable('external_credit_obligations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  loanType: varchar('loan_type', { length: 100 }).notNull(),
  emiAmount: numeric('emi_amount').notNull(),
  outstandingAmount: numeric('outstanding_amount').notNull(),
  status: loanStatusEnum('status').notNull(),
  lenderName: varchar('lender_name', { length: 255 }).notNull(),
});

export const kycDetails = pgTable('kyc_details', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull().unique().references(() => applications.id),
  idType: idTypeEnum('id_type').notNull(),
  idNumberMasked: varchar('id_number_masked', { length: 50 }).notNull(),
  idNumberHash: varchar('id_number_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  dob: date('dob').notNull(),
  gender: genderEnum('gender').notNull(),
  address: text('address').notNull(),
  provider: varchar('provider', { length: 100 }).notNull(),
  providerReference: varchar('provider_reference', { length: 255 }),
  verificationStatus: verificationStatusEnum('verification_status').default('PENDING').notNull(),
});

export const financialDetails = pgTable('financial_details', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull().unique().references(() => applications.id),
  employmentType: employmentTypeEnum('employment_type').notNull(),
  employerName: varchar('employer_name', { length: 255 }).notNull(),
  designation: varchar('designation', { length: 255 }).notNull(),
  monthlyIncome: numeric('monthly_income').notNull(),
  creditScore: integer('credit_score'),
  existingEmiObligations: numeric('existing_emi_obligations').notNull(),
});

export const eligibilityResults = pgTable('eligibility_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull().references(() => applications.id),
  evaluationVersion: integer('evaluation_version').notNull(),
  decision: eligibilityDecisionEnum('decision').notNull(),
  maxEligibleAmount: numeric('max_eligible_amount').notNull(),
  calculatedDti: numeric('calculated_dti').notNull(),
  reasons: jsonb('reasons'), // Array of reason strings
  evaluatedAt: timestamp('evaluated_at').defaultNow().notNull(),
}, (t) => ({
  unq: unique().on(t.applicationId, t.evaluationVersion)
}));

export const loanTerms = pgTable('loan_terms', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull().unique().references(() => applications.id),
  finalAmount: numeric('final_amount').notNull(),
  tenure: integer('tenure').notNull(),
  interestRate: numeric('interest_rate').notNull(),
  emi: numeric('emi').notNull(),
  processingFee: numeric('processing_fee').notNull(),
  gst: numeric('gst').notNull(),
  totalInterest: numeric('total_interest').notNull(),
  totalCharges: numeric('total_charges').notNull(),
  totalRepayment: numeric('total_repayment').notNull(),
  netDisbursement: numeric('net_disbursement').notNull(),
  irr: numeric('irr').notNull(),
});

export const bankDetails = pgTable('bank_details', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull().unique().references(() => applications.id),
  accountNumberMasked: varchar('account_number_masked', { length: 50 }).notNull(),
  ifscCode: varchar('ifsc_code', { length: 20 }).notNull(),
  accountHolderName: varchar('account_holder_name', { length: 255 }).notNull(),
  verificationStatus: verificationStatusEnum('verification_status').default('PENDING').notNull(),
});

export const selfieVerifications = pgTable('selfie_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull().unique().references(() => applications.id),
  storagePath: varchar('storage_path', { length: 500 }).notNull(),
  verificationStatus: verificationStatusEnum('verification_status').default('PENDING').notNull(),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  reviewTimestamp: timestamp('review_timestamp'),
});

export const declarations = pgTable('declarations', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull().unique().references(() => applications.id),
  consentText: text('consent_text').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  acceptedAt: timestamp('accepted_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: uuid('application_id').notNull().references(() => applications.id),
  action: varchar('action', { length: 100 }).notNull(),
  previousStatus: applicationStateEnum('previous_status'),
  newStatus: applicationStateEnum('new_status'),
  actionBy: uuid('action_by').notNull().references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- RELATIONS ---
export const applicationsRelations = relations(applications, ({ one, many }) => ({
  user: one(users, { fields: [applications.userId], references: [users.id] }),
  reviewer: one(users, { fields: [applications.reviewerId], references: [users.id] }),
  loan: one(loans, { fields: [applications.id], references: [loans.applicationId] }),
  kycDetails: one(kycDetails, { fields: [applications.id], references: [kycDetails.applicationId] }),
  financialDetails: one(financialDetails, { fields: [applications.id], references: [financialDetails.applicationId] }),
  eligibilityResults: many(eligibilityResults),
  loanTerms: one(loanTerms, { fields: [applications.id], references: [loanTerms.applicationId] }),
  bankDetails: one(bankDetails, { fields: [applications.id], references: [bankDetails.applicationId] }),
  selfieVerification: one(selfieVerifications, { fields: [applications.id], references: [selfieVerifications.applicationId] }),
  declaration: one(declarations, { fields: [applications.id], references: [declarations.applicationId] }),
  auditLogs: many(auditLogs),
}));

export const usersRelations = relations(users, ({ many }) => ({
  applications: many(applications),
  loans: many(loans),
  externalCreditObligations: many(externalCreditObligations),
}));

export const loansRelations = relations(loans, ({ one }) => ({
  application: one(applications, { fields: [loans.applicationId], references: [applications.id] }),
  user: one(users, { fields: [loans.userId], references: [users.id] }),
}));

export const eligibilityResultsRelations = relations(eligibilityResults, ({ one }) => ({
  application: one(applications, { fields: [eligibilityResults.applicationId], references: [applications.id] }),
}));

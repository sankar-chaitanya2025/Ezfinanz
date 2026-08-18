CREATE TYPE "public"."application_state" AS ENUM('DRAFT', 'KYC_PENDING', 'KYC_COMPLETED', 'FINANCIALS_COMPLETED', 'ELIGIBILITY_PENDING', 'ELIGIBLE', 'PARTIALLY_ELIGIBLE', 'NOT_ELIGIBLE', 'TERMS_SELECTED', 'BANK_VERIFIED', 'DECLARATION_ACCEPTED', 'SELFIE_PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."eligibility_decision" AS ENUM('ELIGIBLE', 'PARTIALLY_ELIGIBLE', 'NOT_ELIGIBLE');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('SALARIED', 'SELF_EMPLOYED');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."id_type" AS ENUM('AADHAR', 'PAN');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('SANCTIONED', 'DISBURSEMENT_PENDING', 'ACTIVE', 'CLOSED', 'DEFAULTED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('CUSTOMER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('PENDING', 'VERIFIED', 'FAILED');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "application_state" DEFAULT 'DRAFT' NOT NULL,
	"requested_amount" numeric,
	"requested_tenure" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp,
	"reviewer_id" uuid,
	"review_timestamp" timestamp
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"previous_status" "application_state",
	"new_status" "application_state",
	"action_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"account_number_masked" varchar(50) NOT NULL,
	"ifsc_code" varchar(20) NOT NULL,
	"account_holder_name" varchar(255) NOT NULL,
	"verification_status" "verification_status" DEFAULT 'PENDING' NOT NULL,
	CONSTRAINT "bank_details_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"consent_text" text NOT NULL,
	"ip_address" varchar(45),
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "declarations_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "eligibility_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"evaluation_version" integer NOT NULL,
	"decision" "eligibility_decision" NOT NULL,
	"max_eligible_amount" numeric NOT NULL,
	"calculated_dti" numeric NOT NULL,
	"reasons" jsonb,
	"evaluated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "eligibility_results_application_id_evaluation_version_unique" UNIQUE("application_id","evaluation_version")
);
--> statement-breakpoint
CREATE TABLE "external_credit_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"loan_type" varchar(100) NOT NULL,
	"emi_amount" numeric NOT NULL,
	"outstanding_amount" numeric NOT NULL,
	"status" "loan_status" NOT NULL,
	"lender_name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"employment_type" "employment_type" NOT NULL,
	"employer_name" varchar(255) NOT NULL,
	"designation" varchar(255) NOT NULL,
	"monthly_income" numeric NOT NULL,
	"credit_score" integer,
	"existing_emi_obligations" numeric NOT NULL,
	CONSTRAINT "financial_details_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "kyc_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"id_type" "id_type" NOT NULL,
	"id_number_masked" varchar(50) NOT NULL,
	"id_number_hash" varchar(255) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"dob" date NOT NULL,
	"gender" "gender" NOT NULL,
	"address" text NOT NULL,
	"provider" varchar(100) NOT NULL,
	"provider_reference" varchar(255),
	"verification_status" "verification_status" DEFAULT 'PENDING' NOT NULL,
	CONSTRAINT "kyc_details_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "loan_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"final_amount" numeric NOT NULL,
	"tenure" integer NOT NULL,
	"interest_rate" numeric NOT NULL,
	"emi" numeric NOT NULL,
	"processing_fee" numeric NOT NULL,
	"gst" numeric NOT NULL,
	"total_interest" numeric NOT NULL,
	"total_charges" numeric NOT NULL,
	"total_repayment" numeric NOT NULL,
	"net_disbursement" numeric NOT NULL,
	"irr" numeric NOT NULL,
	CONSTRAINT "loan_terms_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "loan_status" NOT NULL,
	"sanctioned_amount" numeric NOT NULL,
	"disbursed_amount" numeric,
	"outstanding_balance" numeric NOT NULL,
	"sanctioned_at" timestamp,
	"disbursed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loans_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "selfie_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"storage_path" varchar(500) NOT NULL,
	"verification_status" "verification_status" DEFAULT 'PENDING' NOT NULL,
	"reviewer_id" uuid,
	"review_timestamp" timestamp,
	CONSTRAINT "selfie_verifications_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"role" "role" DEFAULT 'CUSTOMER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_action_by_users_id_fk" FOREIGN KEY ("action_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_details" ADD CONSTRAINT "bank_details_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "declarations" ADD CONSTRAINT "declarations_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eligibility_results" ADD CONSTRAINT "eligibility_results_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_credit_obligations" ADD CONSTRAINT "external_credit_obligations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_details" ADD CONSTRAINT "financial_details_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_details" ADD CONSTRAINT "kyc_details_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_terms" ADD CONSTRAINT "loan_terms_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selfie_verifications" ADD CONSTRAINT "selfie_verifications_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selfie_verifications" ADD CONSTRAINT "selfie_verifications_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
import { applicationStateEnum } from '@/db/schema'

type ApplicationState = typeof applicationStateEnum.enumValues[number]

export const VALID_TRANSITIONS: Record<ApplicationState, ApplicationState[]> = {
  DRAFT: ['KYC_PENDING'],
  KYC_PENDING: ['KYC_COMPLETED'],
  KYC_COMPLETED: ['FINANCIALS_COMPLETED'],
  FINANCIALS_COMPLETED: ['ELIGIBILITY_PENDING'],
  ELIGIBILITY_PENDING: ['ELIGIBLE', 'PARTIALLY_ELIGIBLE', 'NOT_ELIGIBLE'],
  NOT_ELIGIBLE: ['FINANCIALS_COMPLETED'], // Correction loop
  ELIGIBLE: ['TERMS_SELECTED'],
  PARTIALLY_ELIGIBLE: ['TERMS_SELECTED'],
  TERMS_SELECTED: ['BANK_VERIFIED'],
  BANK_VERIFIED: ['DECLARATION_ACCEPTED'],
  DECLARATION_ACCEPTED: ['SELFIE_PENDING'],
  SELFIE_PENDING: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: [], // Terminal application state (leads to active loan)
  REJECTED: [], // Terminal state
}

export function isValidTransition(fromState: ApplicationState, toState: ApplicationState): boolean {
  const allowed = VALID_TRANSITIONS[fromState]
  if (!allowed) return false
  return allowed.includes(toState)
}

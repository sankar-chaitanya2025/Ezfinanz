import { idTypeEnum, genderEnum } from '@/db/schema'

type IdType = typeof idTypeEnum.enumValues[number]
type Gender = typeof genderEnum.enumValues[number]

export interface KycResponse {
  status: 'VERIFIED' | 'FAILED'
  providerReference: string
  fullName?: string
  dob?: string // YYYY-MM-DD
  gender?: Gender
  address?: string
}

export class MockDigiLockerProvider {
  /**
   * Simulates an external KYC check.
   * Deterministic mock: ID containing "FAIL" will return FAILED.
   * Otherwise returns VERIFIED with dummy data.
   */
  static async verifyId(idType: IdType, idNumber: string, providedName?: string): Promise<KycResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800))

    const cleanId = idNumber.trim().toUpperCase()
    const providerReference = `MOCK-DL-${crypto.randomUUID()}`

    // Deterministic failure: Aadhar starting with '0000' or PAN starting with 'FAIL'
    if (cleanId.startsWith('0000') || cleanId.startsWith('FAIL')) {
      return {
        status: 'FAILED',
        providerReference
      }
    }

    return {
      status: 'VERIFIED',
      providerReference,
      fullName: providedName || 'John Doe',
      dob: '1990-01-01',
      gender: 'MALE',
      address: '123 Fake Street, Mock City, 110001'
    }
  }
}

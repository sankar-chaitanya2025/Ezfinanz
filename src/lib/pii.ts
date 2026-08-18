import crypto from 'crypto'
import { idTypeEnum } from '@/db/schema'

type IdType = typeof idTypeEnum.enumValues[number]

export function hashIdNumber(idNumber: string): string {
  return crypto.createHash('sha256').update(idNumber.trim().toUpperCase()).digest('hex')
}

export function maskIdNumber(idNumber: string, type: IdType): string {
  const clean = idNumber.trim().toUpperCase()
  if (type === 'AADHAR') {
    // Aadhar is 12 digits. Mask first 8, show last 4.
    if (clean.length === 12) {
      return `XXXXXXXX${clean.substring(8)}`
    }
  } else if (type === 'PAN') {
    // PAN is 10 chars. Show first 2 and last 2, mask middle 6.
    if (clean.length === 10) {
      return `${clean.substring(0, 2)}XXXXXX${clean.substring(8)}`
    }
  }
  
  // Fallback masking if format is unexpected
  if (clean.length > 4) {
    return '*'.repeat(clean.length - 4) + clean.slice(-4)
  }
  return '****'
}

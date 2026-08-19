/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { login } from '@/app/actions/auth'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/db'
import * as navigation from 'next/navigation'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/utils/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('Auth Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should redirect ADMIN users to /admin after login', async () => {
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-123' } } }),
      }
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const formData = new FormData()
    formData.append('email', 'admin@test.com')
    formData.append('password', 'password')

    // Mock db call
    const mockDbSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'admin-123', role: 'ADMIN' }])
    }
    vi.spyOn(db, 'select').mockReturnValue(mockDbSelect as any)

    await login(formData)

    expect(navigation.redirect).toHaveBeenCalledWith('/admin')
  })

  it('should redirect CUSTOMER users to /dashboard after login', async () => {
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'cust-123' } } }),
      }
    }
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any)

    const formData = new FormData()
    formData.append('email', 'cust@test.com')
    formData.append('password', 'password')

    // Mock db call
    const mockDbSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'cust-123', role: 'CUSTOMER' }])
    }
    vi.spyOn(db, 'select').mockReturnValue(mockDbSelect as any)

    await login(formData)

    expect(navigation.redirect).toHaveBeenCalledWith('/dashboard')
  })
})

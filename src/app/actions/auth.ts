'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { db } from '@/db'
import { users } from '@/db/schema'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    redirect('/login?error=Could+not+authenticate+user')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const phone = formData.get('phone') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    phone: phone || undefined,
  })

  if (error) {
    redirect('/signup?error=' + encodeURIComponent(error.message))
  }
  
  if (data.user) {
    // Synchronize to the users table immediately
    try {
      await db.insert(users).values({
        id: data.user.id,
        email: data.user.email!,
        phone: data.user.phone || null,
        role: 'CUSTOMER',
      }).onConflictDoNothing()
    } catch (dbError) {
      console.error("Failed to sync user to database:", dbError);
    }
  }

  if (!data.session) {
    redirect('/login?error=Please+check+your+email+to+verify+your+account')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

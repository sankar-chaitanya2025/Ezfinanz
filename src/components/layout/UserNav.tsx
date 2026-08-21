import { createClient } from '@/utils/supabase/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { logout } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { ShieldCheck, LogOut } from 'lucide-react'
import Link from 'next/link'

interface UserNavProps {
  theme?: 'light' | 'dark'
}

export async function UserNav({ theme = 'light' }: UserNavProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const profileResult = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
  const profile = profileResult[0]

  const isDark = theme === 'dark'

  return (
    <header className={`${isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-50' : 'bg-white border-zinc-200 text-zinc-900'} border-b sticky top-0 z-50`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <ShieldCheck className={`w-6 h-6 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            <span className="text-xl font-bold tracking-tight hidden sm:inline-block">EZFinanz</span>
          </Link>
          
          <nav className={`flex items-center gap-4 text-sm font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            <Link href="/dashboard" className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-zinc-900'}`}>
              Dashboard
            </Link>
            <Link href="/profile" className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-zinc-900'}`}>
              Profile
            </Link>
            {profile?.role === 'ADMIN' && (
              <Link href="/admin" className={`transition-colors ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'}`}>
                Admin Queue
              </Link>
            )}
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit" className={isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900'}>
              <LogOut className="w-4 h-4 mr-2" /> Log Out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}

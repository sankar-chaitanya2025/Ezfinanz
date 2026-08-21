import { signup } from '@/app/actions/auth'
import Link from 'next/link'
import { ShieldCheck, AlertCircle } from 'lucide-react'
import HeroShaderGradient from '@/components/landing/HeroShaderGradient'

export default async function SignupPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams
  const error = searchParams.error
  
  return (
    <div className="flex min-h-screen bg-white">
      {/* Left side: Form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:w-1/2 xl:w-5/12 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <Link href="/" className="flex items-center gap-2 mb-10 hover:opacity-80 transition-opacity w-fit">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
            <span className="text-2xl font-bold tracking-tight text-zinc-900">EZFinanz</span>
          </Link>

          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Create your account</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Join EZFinanz and experience instant decisions.
          </p>
          
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-8">
            <form action={signup} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-zinc-700" htmlFor="email">Email address</label>
                <input 
                  className="mt-1.5 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm shadow-sm transition-colors"
                  id="email" 
                  name="email" 
                  type="email" 
                  placeholder="name@example.com"
                  autoComplete="email"
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700" htmlFor="phone">Phone (Optional)</label>
                <input 
                  className="mt-1.5 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm shadow-sm transition-colors"
                  id="phone" 
                  name="phone" 
                  type="tel" 
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700" htmlFor="password">Password</label>
                <input 
                  className="mt-1.5 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm shadow-sm transition-colors"
                  id="password" 
                  name="password" 
                  type="password" 
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required 
                />
              </div>
              <button 
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 transition-colors"
                type="submit"
              >
                Sign up
              </button>
            </form>
            
            <div className="mt-8 text-center text-sm">
              <span className="text-zinc-500">Already have an account? </span>
              <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors">
                Log in
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Mesh Gradient Background */}
      <div className="hidden lg:block relative w-0 flex-1 overflow-hidden bg-zinc-950">
        <HeroShaderGradient className="absolute inset-0 h-full w-full opacity-90 mix-blend-screen" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(9,9,11,0.4)_100%)] pointer-events-none" />
        
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center pointer-events-none">
           <div className="max-w-md space-y-4">
             <h3 className="text-3xl font-bold text-white tracking-tight">The easiest way to finance your future.</h3>
             <p className="text-zinc-300 text-lg">Instant decisions. Zero paperwork. Secure processing.</p>
           </div>
        </div>
      </div>
    </div>
  )
}

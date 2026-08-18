import { login } from '@/app/actions/auth'

export default async function LoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams
  const error = searchParams.error
  return (
    <div className="flex min-h-screen items-center justify-center p-24">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Log in to EZFinanz</h2>
        </div>
        
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded text-sm text-center">
            {error}
          </div>
        )}

        <form action={login} className="space-y-4">
          <div>
            <label className="block text-sm font-medium" htmlFor="email">Email</label>
            <input 
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black bg-white"
              id="email" 
              name="email" 
              type="email" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="password">Password</label>
            <input 
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-black bg-white"
              id="password" 
              name="password" 
              type="password" 
              required 
            />
          </div>
          <button 
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            type="submit"
          >
            Log In
          </button>
        </form>
        <div className="text-center text-sm">
          <a href="/signup" className="text-blue-600 hover:text-blue-500">
            Don&apos;t have an account? Sign up
          </a>
        </div>
      </div>
    </div>
  )
}

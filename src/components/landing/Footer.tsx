import React from 'react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="col-span-1 md:col-span-2">
          <Link href="/" className="text-lg font-bold tracking-tight text-zinc-950 block mb-4">
            EZFinanz
          </Link>
          <p className="text-sm text-zinc-500 max-w-xs">
            Personal loans engineered for modern life. Clear terms, instant eligibility, and a seamless digital application.
          </p>
        </div>
        <div>
          <h4 className="font-medium text-sm text-zinc-950 mb-4">Platform</h4>
          <ul className="space-y-3 text-sm text-zinc-500">
            <li>
              <Link href="/signup" className="hover:text-zinc-950 transition-colors">Apply Now</Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-zinc-950 transition-colors">Log In</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-sm text-zinc-950 mb-4">Legal</h4>
          <ul className="space-y-3 text-sm text-zinc-500">
            <li><span className="hover:text-zinc-950 transition-colors cursor-pointer">Terms of Service</span></li>
            <li><span className="hover:text-zinc-950 transition-colors cursor-pointer">Privacy Policy</span></li>
            <li><span className="hover:text-zinc-950 transition-colors cursor-pointer">Licenses</span></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-zinc-100 flex flex-col md:flex-row items-center justify-between text-xs text-zinc-400">
        <p>© {new Date().getFullYear()} EZFinanz Inc. All rights reserved.</p>
        <p className="mt-2 md:mt-0">Subject to regulatory approval.</p>
      </div>
    </footer>
  )
}

import React from 'react'

export function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-zinc-200">
      {children}
    </div>
  )
}

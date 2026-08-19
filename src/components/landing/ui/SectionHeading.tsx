import React from 'react'

interface SectionHeadingProps {
  title: string
  subtitle?: string
  className?: string
  align?: 'left' | 'center'
}

export function SectionHeading({ title, subtitle, className = '', align = 'left' }: SectionHeadingProps) {
  return (
    <div className={`flex flex-col gap-3 mb-16 ${align === 'center' ? 'items-center text-center' : 'items-start text-left'} ${className}`}>
      <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-zinc-950 max-w-2xl">
        {title}
      </h2>
      {subtitle && (
        <p className="text-lg md:text-xl text-zinc-500 max-w-xl">
          {subtitle}
        </p>
      )}
    </div>
  )
}

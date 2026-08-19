'use client'

import React, { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface EligibilityCardProps {
  className?: string
  amount?: number
}

export function EligibilityCard({ className = '', amount = 500000 }: EligibilityCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [displayAmount, setDisplayAmount] = useState(0)

  useEffect(() => {
    if (!cardRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayAmount(amount);
      return;
    }

    const obj = { value: 0 };

    const tween = gsap.to(obj, {
      value: amount,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        setDisplayAmount(Math.round(obj.value));
      },
      scrollTrigger: {
        trigger: cardRef.current,
        start: 'top 80%',
        once: true,
      },
    });

    return () => {
      tween.kill();
      gsap.killTweensOf(obj);
    };
  }, [amount]);

  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(displayAmount);

  return (
    <div ref={cardRef} className={`bg-zinc-50 border border-zinc-200 rounded-md p-8 md:p-12 relative ${className}`}>
      {/* Visual Mockup Only. Does not call any real service or use real logic. */}
      <div className="flex items-center justify-between mb-8 pb-8 border-b border-zinc-200">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1">Status</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <p className="text-sm font-medium text-emerald-700">Eligible</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1">Credit Score</p>
          <p className="text-xl font-semibold text-zinc-950">750+</p>
        </div>
      </div>

      <div>
        <p className="text-sm text-zinc-500 mb-2">Maximum Approved Amount</p>
        <h4 className="text-5xl font-semibold tracking-tighter text-zinc-950 mb-8">
          ₹{formatted}
        </h4>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-500">Calculated DTI</span>
          <span className="font-medium text-zinc-950">32.4%</span>
        </div>
        <div className="flex justify-between items-end text-sm mt-6 pt-6 border-t border-zinc-200">
          <span className="text-zinc-500 pb-1">Max Affordable EMI</span>
          <p className="text-2xl font-bold text-indigo-600">
            ₹15,000
            <span className="text-sm font-medium text-indigo-400"> /mo</span>
          </p>
        </div>
      </div>
    </div>
  )
}

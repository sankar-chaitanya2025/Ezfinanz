'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import HeroShaderGradient from './HeroShaderGradient'
import { EligibilityCard } from './EligibilityCard'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 20 }
  }
}

export function HeroSection() {
  return (
    <section className="relative py-20 md:py-28 lg:py-32 overflow-hidden border-b border-zinc-100 bg-white">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <motion.div 
            className="flex w-full flex-col max-w-2xl"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
                Deterministic Eligibility Engine
              </span>
            </motion.div>
            
            <motion.h1 
              variants={itemVariants}
              className="text-[2.75rem] font-bold leading-[1.05] tracking-tight text-zinc-950 sm:text-6xl lg:text-[4.25rem]"
            >
              Personal loans
              <br />
              engineered for{' '}
              <span className="text-indigo-600">modern life.</span>
            </motion.h1>
            
            <motion.p 
              variants={itemVariants}
              className="mt-6 max-w-md text-lg leading-relaxed text-zinc-500"
            >
              Clear terms, instant eligibility, and a seamless digital application.
            </motion.p>
            
            <motion.div variants={itemVariants} className="mt-10 flex flex-wrap items-center gap-6">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-500 hover:shadow-xl hover:shadow-indigo-600/30 active:scale-[0.98]"
              >
                Apply Now
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="#how-it-works"
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 underline-offset-4 transition-colors hover:text-zinc-950 hover:underline"
              >
                See how it works
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>

            <motion.p variants={itemVariants} className="mt-8 text-xs text-zinc-400">
              No hidden fees. No impact on your credit score to check eligibility.
            </motion.p>
          </motion.div>

          {/* Right column for visual element */}
          <motion.div 
            className="w-full relative mt-12 lg:mt-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            {/* The Gradient Canvas Container */}
            <div className="relative">
              <HeroShaderGradient />
              
              {/* Floating Product Card */}
              <div className="absolute -bottom-12 -left-4 md:-bottom-16 md:-left-12 z-10 w-[95%] md:w-[80%] transform -rotate-3 transition-transform hover:-rotate-2">
                <div 
                  className="rounded-xl overflow-hidden"
                  style={{ boxShadow: '24px 32px 64px -12px rgba(30, 27, 75, 0.35)' }}
                >
                  <EligibilityCard className="!p-6 md:!p-8 !bg-white/95 backdrop-blur-md" />
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}

'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { SectionHeading } from './ui/SectionHeading'
import { CheckCircle2 } from 'lucide-react'
import { EligibilityCard } from './EligibilityCard'

export function EligibilityShowcase() {
  return (
    <section className="py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="max-w-xl">
            <SectionHeading 
              title="Deterministic Eligibility" 
              subtitle="No hidden criteria or black-box algorithms. Our engine evaluates your exact financial history and obligations to determine your maximum eligible loan amount."
            />
            
            <ul className="space-y-4 mt-8">
              {[
                "Income verification",
                "Existing EMI obligation checks",
                "Real-time bureau fetching",
                "Hard DTI (Debt-to-Income) limits"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-zinc-600 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ type: 'spring' as const, stiffness: 100, damping: 20 }}
          >
            <EligibilityCard />
          </motion.div>

        </div>
      </div>
    </section>
  )
}

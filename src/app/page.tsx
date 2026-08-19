import { LandingLayout } from '@/components/landing/LandingLayout'
import { Navbar } from '@/components/landing/Navbar'
import { HeroSection } from '@/components/landing/HeroSection'
import { HowItWorksSection } from '@/components/landing/HowItWorksSection'
import { EligibilityShowcase } from '@/components/landing/EligibilityShowcase'
import { FeatureGrid } from '@/components/landing/FeatureGrid'
import { FinalCTA } from '@/components/landing/FinalCTA'
import { Footer } from '@/components/landing/Footer'
import { Button } from '@/components/landing/ui/Button'
import Link from 'next/link'

export default function Home() {
  return (
    <LandingLayout>
      <Navbar />
      <main>
        <HeroSection />
        
        {/* Trust/Credibility band */}
        <section className="py-12 bg-white border-b border-zinc-100">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-sm uppercase tracking-widest font-semibold text-zinc-400">
              Secure infrastructure. Transparent terms.
            </p>
          </div>
        </section>

        <HowItWorksSection />
        <EligibilityShowcase />
        <FeatureGrid />


        <FinalCTA />

      </main>
      <Footer />
    </LandingLayout>
  )
}

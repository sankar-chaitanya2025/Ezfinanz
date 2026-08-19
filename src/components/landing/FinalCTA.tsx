'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { ArrowRight, Check } from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

type FinalCTAProps = {
  href?: string;
  label?: string;
};

export function FinalCTA({
  href = '/signup',
  label = 'Get Started',
}: FinalCTAProps) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      const content = section.querySelectorAll('[data-cta-reveal]');
      const glow = section.querySelector('[data-cta-glow]');

      if (reducedMotion) {
        gsap.set(content, { autoAlpha: 1, y: 0 });
        gsap.set(glow, { autoAlpha: 1 });
        return;
      }

      gsap.set(content, { autoAlpha: 0, y: 22 });
      gsap.set(glow, { autoAlpha: 0, scale: 0.96 });

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 78%',
          once: true,
        },
      });

      timeline
        .to(glow, {
          autoAlpha: 1,
          scale: 1,
          duration: 1.15,
          ease: 'power2.out',
        })
        .to(
          content,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.68,
            stagger: 0.08,
            ease: 'power3.out',
          },
          '-=0.82'
        );
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="final-cta"
      className="relative isolate overflow-hidden border-t border-white/10 bg-[#09090b] text-white"
      aria-labelledby="final-cta-title"
    >
      <div
        data-cta-glow
        className="cta-ambient-glow pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[620px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(79,70,229,0.32)_0%,rgba(49,46,129,0.16)_34%,transparent_72%)] blur-3xl"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.26)_76%,rgba(0,0,0,0.58)_100%)]"
        aria-hidden="true"
      />

      <div className="mx-auto flex min-h-[460px] max-w-5xl flex-col items-center justify-center px-6 py-28 text-center md:min-h-[520px] md:py-36">
        <p
          data-cta-reveal
          className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300"
        >
          Ready when you are
        </p>

        <h2
          id="final-cta-title"
          data-cta-reveal
          className="mt-6 max-w-3xl text-5xl font-semibold leading-[0.97] tracking-[-0.06em] text-white sm:text-6xl md:text-7xl"
        >
          Ready to begin your application?
        </h2>

        <p
          data-cta-reveal
          className="mt-7 max-w-md text-base leading-7 text-zinc-400 md:text-lg"
        >
          Clear terms. A digital process. No unnecessary friction.
        </p>

        <a
          data-cta-reveal
          href={href}
          className="group mt-10 inline-flex min-h-14 items-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-zinc-950 shadow-[0_12px_40px_-16px_rgba(255,255,255,0.65)] transition-[transform,background-color,box-shadow] duration-200 hover:bg-indigo-50 hover:shadow-[0_16px_48px_-18px_rgba(129,140,248,0.7)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#09090b]"
        >
          <span>{label}</span>

          <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-white transition-transform duration-200 group-hover:translate-x-0.5">
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </a>

        <p
          data-cta-reveal
          className="mt-5 inline-flex items-center gap-2 text-xs text-zinc-500"
        >
          <Check className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
          Review your terms before you commit.
        </p>
      </div>
    </section>
  );
}

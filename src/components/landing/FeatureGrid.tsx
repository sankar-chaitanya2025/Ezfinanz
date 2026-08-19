'use client';

import { useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Check, Eye, ReceiptText } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const TENURES = [12, 24, 36, 48, 60] as const;

type Tenure = (typeof TENURES)[number];

const BAR_HEIGHTS: Record<Tenure, number> = {
  12: 100,
  24: 82,
  36: 68,
  48: 56,
  60: 46,
};

export function FeatureGrid() {
  const sectionRef = useRef<HTMLElement>(null);
  const [selectedTenure, setSelectedTenure] = useState<Tenure>(36);

  const selectedHeight = useMemo(
    () => BAR_HEIGHTS[selectedTenure],
    [selectedTenure]
  );

  useGSAP(
    () => {
      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      if (reducedMotion) return;

      const context = gsap.context(() => {
        const intro = sectionRef.current?.querySelector(
          '[data-financial-intro]'
        );
        const panel = sectionRef.current?.querySelector(
          '[data-financial-panel]'
        );
        const bars = gsap.utils.toArray<HTMLElement>('[data-financial-bar]');

        if (!intro || !panel || bars.length === 0) return;

        gsap.set([intro, panel], {
          autoAlpha: 0,
          y: 24,
        });

        gsap.set(bars, {
          scaleY: 0,
          transformOrigin: 'bottom center',
        });

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 78%',
            once: true,
          },
        });

        timeline
          .to(intro, {
            autoAlpha: 1,
            y: 0,
            duration: 0.65,
            ease: 'power3.out',
          })
          .to(
            panel,
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.7,
              ease: 'power3.out',
            },
            '-=0.42'
          )
          .to(
            bars,
            {
              scaleY: 1,
              duration: 0.7,
              stagger: 0.08,
              ease: 'power3.out',
            },
            '-=0.28'
          );
      }, sectionRef);

      return () => context.revert();
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="financial-structure"
      className="border-y border-zinc-200 bg-white py-24 md:py-32"
      aria-labelledby="financial-structure-title"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
        <div data-financial-intro className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Transparent by design
          </p>

          <h2
            id="financial-structure-title"
            className="mt-5 max-w-md text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-zinc-950 md:text-6xl"
          >
            Clear financial structure.
          </h2>

          <p className="mt-6 max-w-md text-base leading-7 text-zinc-500 md:text-lg">
            We believe in absolute transparency. What you see is exactly what
            you get, calculated before you commit.
          </p>

          <div className="mt-8 flex items-start gap-3 border-t border-zinc-200 pt-5 text-sm text-zinc-600">
            <Eye
              className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600"
              aria-hidden="true"
            />
            <span>Every rate and fee is visible before you continue.</span>
          </div>
        </div>

        <div
          data-financial-panel
          className="rounded-[24px] border border-zinc-200 bg-[#fcfcfd] p-5 shadow-[0_18px_60px_-38px_rgba(24,24,27,0.35)] md:p-7"
        >
          <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                Loan example
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">
                Flexible repayment terms
              </h3>
            </div>

            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Fixed rate
            </span>
          </div>

          <div className="pt-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  Repayment tenure
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Choose the duration that fits your plan.
                </p>
              </div>

              <div
                className="grid grid-cols-5 gap-1 rounded-xl border border-zinc-200 bg-white p-1"
                role="group"
                aria-label="Repayment tenure"
              >
                {TENURES.map((tenure) => {
                  const active = selectedTenure === tenure;

                  return (
                    <button
                      key={tenure}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedTenure(tenure)}
                      className={[
                        'min-w-0 rounded-lg px-2 py-2 text-xs font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950',
                      ].join(' ')}
                    >
                      {tenure}m
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
                    Tenure profile
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                    {selectedTenure} months
                  </p>
                </div>

                <p className="text-right text-xs leading-5 text-zinc-400">
                  Illustrative example
                  <br />
                  not a final offer
                </p>
              </div>

              <div
                className="mt-7 flex h-36 items-end gap-3"
                aria-label="Illustrative tenure comparison"
                role="img"
              >
                {TENURES.map((tenure) => {
                  const active = selectedTenure === tenure;

                  return (
                    <button
                      key={tenure}
                      type="button"
                      onClick={() => setSelectedTenure(tenure)}
                      aria-label={`Select ${tenure} month tenure`}
                      className="group flex h-full flex-1 flex-col items-center justify-end gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                    >
                      <span
                        data-financial-bar
                        className={[
                          'block w-full origin-bottom rounded-t-lg transition-[height,background-color] duration-300',
                          active ? 'bg-indigo-600' : 'bg-indigo-100',
                        ].join(' ')}
                        style={{ height: `${BAR_HEIGHTS[tenure]}%` }}
                      />
                      <span
                        className={[
                          'text-xs font-medium',
                          active
                            ? 'text-indigo-600'
                            : 'text-zinc-400 group-hover:text-zinc-700',
                        ].join(' ')}
                      >
                        {tenure}m
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="Interest rate" value="12% fixed" />
              <Metric label="Processing fee" value="2%" />
              <Metric
                label="Selected tenure"
                value={`${selectedTenure} months`}
              />
            </div>

            <div className="mt-5 flex items-start gap-2 border-t border-zinc-200 pt-4 text-xs leading-5 text-zinc-400">
              <ReceiptText
                className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400"
                aria-hidden="true"
              />
              <p>
                Standard processing fee is shown before commitment. Applicable
                taxes and final terms are disclosed during the application.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

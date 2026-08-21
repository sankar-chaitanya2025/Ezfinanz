'use client';

import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Banknote,
  Camera,
  Check,
  CheckCircle2,
  Circle,
  ShieldCheck,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  {
    title: 'Bank Sync',
    status: 'Secure automated verification',
    description:
      'Connect your account securely so we can verify the information needed for your application.',
    Icon: Banknote,
  },
  {
    title: 'Selfie Capture',
    status: 'Live identity confirmation',
    description: 'Confirm your identity with a quick live selfie.',
    Icon: Camera,
  },
  {
    title: 'Instant Decision',
    status: 'Final approval in seconds',
    description:
      'Receive a clear eligibility decision based on the information provided.',
    Icon: ShieldCheck,
  },
] as const;

type StepIndex = 0 | 1 | 2 | 3;

const statusMessages: Record<StepIndex, string> = {
  0: 'Awaiting bank verification',
  1: 'Bank synced. Awaiting selfie',
  2: 'Verifying identity & eligibility',
  3: 'Decision ready',
};

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState<StepIndex>(0);
  const [statusIndex, setStatusIndex] = useState<StepIndex>(0);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      const setFinalState = () => {
        setActiveStep(3);
        setStatusIndex(3);

        gsap.set(
          [
            '.flow-intro',
            '.flow-track',
            '.flow-step',
            '.flow-status',
          ],
          { autoAlpha: 1, y: 0 }
        );
        gsap.set('.flow-progress', {
          scaleX: 1,
          scaleY: 1,
        });
      };

      if (reducedMotion) {
        setFinalState();
        return;
      }

      const intro = section.querySelector('.flow-intro');
      const track = section.querySelector('.flow-track');
      const progress = section.querySelector('.flow-progress');
      const status = section.querySelector('.flow-status');
      const stepElements = gsap.utils.toArray<HTMLElement>('.flow-step');
      const markers = gsap.utils.toArray<HTMLElement>('.flow-marker');

      if (!intro || !track || !progress || !status) return;

      const isMobile = window.matchMedia('(max-width: 767px)').matches;

      gsap.set([intro, track, status], {
        autoAlpha: 0,
        y: 18,
      });
      gsap.set(stepElements, {
        autoAlpha: 0,
        y: 18,
      });
      gsap.set(markers, {
        scale: 0.92,
      });
      gsap.set(progress, {
        scaleX: 0,
        scaleY: 0,
        transformOrigin: isMobile ? 'center top' : 'left center',
      });

      const timeline = gsap.timeline({
        paused: true,
        onComplete: () => {
          setActiveStep(3);
          setStatusIndex(3);
        },
      });

      timeline
        .to(intro, {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: 'power3.out',
        })
        .to(
          track,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.35,
            ease: 'power2.out',
          },
          '-=0.2'
        )
        .to(
          stepElements,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.08,
            ease: 'power3.out',
          },
          '-=0.12'
        )
        .to(
          markers,
          {
            scale: 1,
            duration: 0.3,
            stagger: 0.08,
            ease: 'power2.out',
          },
          '<'
        );

      const stepDistance = 100 / (steps.length - 1);

      steps.forEach((_, index) => {
        const isLast = index === steps.length - 1;

        timeline.call(
          () => {
            setActiveStep((index + 1) as StepIndex);
            setStatusIndex((index + 1) as StepIndex);
          },
          [],
          isLast ? '+=0.12' : '+=0.08'
        );

        if (!isLast) {
          timeline.to(
            progress,
            isMobile
              ? {
                  scaleY: (index + 1) / (steps.length - 1),
                  duration: 0.45,
                  ease: 'power3.out',
                }
              : {
                  scaleX: ((index + 1) * stepDistance) / 100,
                  duration: 0.45,
                  ease: 'power3.out',
                },
            '+=0.08'
          );
        }
      });

      timeline
        .to(
          status,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.45,
            ease: 'power3.out',
          },
          '-=0.2'
        )
        .play();

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top 78%',
        once: true,
        animation: timeline,
      });

      return () => {
        trigger.kill();
        timeline.kill();
      };
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="overflow-hidden bg-white py-24 md:py-32"
      aria-labelledby="flow-title"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flow-intro mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            How it works
          </p>

          <h2
            id="flow-title"
            className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-zinc-950 md:text-5xl"
          >
            A seamless digital flow.
          </h2>

          <p className="mt-5 text-base leading-7 text-zinc-500 md:text-lg">
            From instant bank verification to live selfie capture, every step
            is designed to remove friction while maintaining strong security.
          </p>
        </div>

        <div className="relative mt-20 md:mt-24">
          <div className="flow-track absolute left-[16.66%] right-[16.66%] top-7 hidden h-px bg-zinc-200 md:block">
            <div className="flow-progress h-full w-full origin-left bg-indigo-600" />
          </div>

          <div className="flow-track absolute bottom-0 left-7 top-7 w-px bg-zinc-200 md:hidden">
            <div className="flow-progress h-full w-full origin-top bg-indigo-600" />
          </div>

          <div className="grid gap-12 md:grid-cols-3 md:gap-10">
            {steps.map(({ title, status, description, Icon }, index) => {
              const completed = activeStep > index;
              const active = activeStep === index + 1;

              return (
                <article
                  key={title}
                  className="flow-step relative pl-16 md:pl-0 md:text-center"
                >
                  <div
                    className={[
                      'flow-marker absolute left-0 top-0 grid h-14 w-14 place-items-center rounded-full border bg-white transition-colors duration-300 md:relative md:mx-auto md:mb-8',
                      active || completed
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-zinc-200 text-zinc-400',
                      active
                        ? 'ring-8 ring-indigo-50'
                        : 'group-hover:bg-zinc-50',
                    ].join(' ')}
                  >
                    {completed ? (
                      <Check className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
                    ) : (
                      <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                    )}
                  </div>

                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                    Step 0{index + 1}
                  </p>

                  <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-950">
                    {title}
                  </h3>

                  <p className="mt-2 text-sm font-medium text-indigo-600">
                    {status}
                  </p>

                  <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-zinc-500">
                    {description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>

        <div
          className="flow-status mx-auto mt-16 flex max-w-2xl items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-[#fcfcfd] px-4 py-3.5 md:mt-20 md:px-5"
          aria-live="polite"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-50 text-indigo-600">
              {statusIndex === 3 ? (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Circle className="h-3 w-3 fill-current" aria-hidden="true" />
              )}
            </span>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Application status
              </p>
              <p className="truncate text-sm font-medium text-zinc-950">
                {statusMessages[statusIndex]}
              </p>
            </div>
          </div>

          <span className="shrink-0 text-xs font-medium text-zinc-400">
            {statusIndex === 3 ? 'Complete' : `Step ${statusIndex + 1} of 3`}
          </span>
        </div>
      </div>
    </section>
  );
}

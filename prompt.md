TASK: Transform ONLY the existing “A Seamless Digital Flow” section of EZFinanz into a premium, animated fintech verification pipeline.

Do not modify the navbar, hero, financial structure section, backend services, routes, or unrelated components.

CURRENT SECTION
The current section contains:
- Heading: “A Seamless Digital Flow”
- Supporting copy about instant bank verification and live selfie capture.
- Three steps:
  1. Bank Sync
  2. Selfie Capture
  3. Instant Decision
- Three circular Lucide-style icons.
- Step 3 currently has an indigo active state.
- The section transitions into a dark final CTA.

PROBLEM
The section is clean but static and too empty. The three icons look like isolated decorative points. Make it feel like a real digital process moving from secure verification to a decision.

DESIGN CONCEPT: “THE DECISION PIPELINE”

Create a precise horizontal pipeline on desktop:
- A thin neutral track behind the three steps.
- An indigo signal/progress line that travels from Bank Sync to Selfie Capture to Instant Decision.
- Each step is a marker connected to the next.
- The active marker has a restrained indigo halo, not a large glowing orb.
- When a step becomes active:
  - Its icon briefly scales from 0.92 to 1.
  - Its border changes to indigo.
  - Its label becomes near-black.
  - Its status line becomes indigo.
- After the sequence completes, the final step remains active and the pipeline settles. No infinite pulsing.

Keep the visual language:
- White/off-white background.
- Near-black typography.
- Zinc-200 borders.
- Signature indigo #4F46E5.
- Subtle shadows only.
- No purple full-section background.
- No generic stock image.
- No random Lottie animation.
- No glassmorphism.
- No neon glow.
- No excessive floating cards.

CONTENT

Use these exact user-facing labels unless existing approved copy differs:
1. Bank Sync
   Status: Secure automated verification
   Description: Connect your account securely so we can verify the information needed for your application.
2. Selfie Capture
   Status: Live identity confirmation
   Description: Confirm your identity with a quick live selfie.
3. Instant Decision
   Status: Final approval in seconds
   Description: Receive a clear eligibility decision based on the information provided.

Do not expose backend names such as bankVerificationService, kycService, selfieVerificationService, or eligibilityEngine in the marketing UI.

ADD A SMALL LIVE STATUS PANEL

Below the pipeline, add a compact status panel aligned with the section container:
- Left: small indigo status dot and label “Application status”.
- Main status text changes during the one-time sequence:
  - “Securely connecting your bank”
  - “Confirming your identity”
  - “Evaluating your application”
  - “Decision ready”
- Right side: a small neutral metadata label:
  - “Step 1 of 3”, “Step 2 of 3”, etc.
- The panel should be a restrained bordered surface:
  - white background
  - zinc-200 border
  - rounded-xl
  - no heavy shadow
- After completion, show a small check icon and “Decision ready”.
- This panel is a visual simulation only. It must not call the backend or imply that a visitor has actually submitted an application.

RESPONSIVE DESIGN

Desktop:
- Three steps in one horizontal row.
- Connecting line behind markers.
- Status panel below the row.

Mobile:
- Convert the pipeline to a vertical timeline.
- The line runs vertically on the left.
- Each marker remains visible and descriptions remain readable.
- Status panel becomes a full-width block.
- Do not use horizontal overflow.
- Do not shrink text excessively to force the desktop layout onto mobile.

MOTION IMPLEMENTATION

Use the project’s existing GSAP, @gsap/react, ScrollTrigger, and lucide-react packages.
Do not add another animation library.

Use GSAP with useGSAP and ScrollTrigger:
- Trigger when the section reaches approximately “top 78%”.
- Run exactly once.
- Do not scrub.
- Do not continuously animate after completion.
- Use power3.out, expo.out, or power2.out. Do not use elastic/bounce easing.

Sequence:
1. Intro fades upward by 18px.
2. Pipeline track fades in.
3. Step 1 activates.
4. Progress signal draws to step 2.
5. Step 2 activates.
6. Progress signal draws to step 3.
7. Step 3 activates.
8. Status panel updates for each step.
9. Final state remains still.

Preferred total duration: approximately 2.4–3 seconds.

IMPORTANT REACT/GSAP RULE
Do not call React state setters directly on every GSAP ticker frame.
Use state updates only at the discrete sequence boundaries:
- onStart/onComplete for each step, or a small timeline callback.
- Do not create a state update loop.

REDUCED MOTION

If window.matchMedia('(prefers-reduced-motion: reduce)').matches:
- Do not create ScrollTrigger or GSAP animations.
- Render the final completed state immediately.
- Show the full progress line.
- Keep all steps visible.
- Show “Decision ready”.
- The section must remain fully understandable and usable.

ACCESSIBILITY

- Use semantic section, article, and heading elements.
- The status panel should have aria-live="polite", but do not announce every animation frame.
- Use aria-hidden="true" on decorative icons.
- Ensure all text meets readable contrast.
- Do not rely on color alone to communicate the completed state; include a check icon or text.
- No interactive behavior is required for the steps.

PERFORMANCE

- Prefer CSS/SVG and Lucide icons over external animation files.
- Do not add a Lottie runtime for this section.
- Do not add a canvas or WebGL effect.
- Do not load remote media.
- Respect reduced motion.
- Clean up GSAP context and ScrollTrigger on unmount.
- Preserve existing Lenis integration if already present; do not create a second smooth-scroll loop.

VALIDATION

Before editing:
- Inspect the existing ApplicationJourney component and package.json.
- Preserve the existing section ID and surrounding page spacing.

After editing:
- Run npm run lint.
- Run npm run build.
- Check desktop and mobile layouts.
- Confirm the sequence runs once.
- Confirm reduced motion shows the completed static state.
- Return changed file paths and a short implementation summary.




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

type StepIndex = 0 | 1 | 2 | 3;

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

const statusMessages = [
  'Securely connecting your bank',
  'Confirming your identity',
  'Evaluating your application',
  'Decision ready',
] as const;

export default function ApplicationFlow() {
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
      <div className="mx-auto max-w-6xl px-6">
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
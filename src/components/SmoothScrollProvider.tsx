'use client';

import React, { useEffect, useState } from 'react';
import { ReactLenis, useLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

type Props = {
  children: React.ReactNode;
};

export default function SmoothScrollProvider({ children }: Props) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // If user prefers reduced motion, avoid Lenis entirely.
  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <ReactLenis
      root
      options={{
        // These are good defaults; tweak as needed.
        lerp: 0.1, // smoothing factor
        duration: 1.2,
        syncTouch: true,
      }}
    >
      <LenisGsapBridge>{children}</LenisGsapBridge>
    </ReactLenis>
  );
}

/**
 * LenisGsapBridge
 * ----------------
 * Hooks Lenis into GSAP's ticker & ScrollTrigger so all scroll-triggered
 * animations stay perfectly in sync with the smoothed scroll.
 */
function LenisGsapBridge({ children }: { children: React.ReactNode }) {
  const lenis = useLenis();

  useEffect(() => {
    if (!lenis) return;

    // Keep ScrollTrigger in sync with Lenis.
    const onScroll = () => {
      ScrollTrigger.update();
    };
    lenis.on('scroll', onScroll);

    // Hook Lenis into GSAP's ticker.
    const update = (time: number) => {
      lenis.raf(time * 1000); // gsap's time is in seconds.
    };
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off('scroll', onScroll);
      gsap.ticker.remove(update);
    };
  }, [lenis]);

  return <>{children}</>;
}

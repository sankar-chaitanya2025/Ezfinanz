'use client';

/**
 * HeroShaderGradient — hardened version
 * ----------------------------------------
 * Guards against the actual failure modes of putting a Three.js/WebGL
 * component in a Next.js app:
 *   1. SSR crash: ShaderGradient touches `window`/WebGL at module load,
 *      which breaks server rendering. Fixed via next/dynamic(ssr:false)
 *      in the wrapper below, so this file itself never runs server-side.
 *   2. No WebGL support / disabled GPU: detected before mount, falls
 *      back to a static CSS gradient that matches the brand palette.
 *   3. Runtime render crash (driver bug, context creation failure):
 *      caught by an Error Boundary, falls back to the same static
 *      gradient instead of white-screening the whole hero.
 *   4. WebGL context loss (tab backgrounded, GPU reset): listened for,
 *      shows the static fallback instead of a frozen/broken canvas.
 *   5. Hydration mismatch: mobile/motion checks run only after mount,
 *      and the very first paint is always the safe static fallback so
 *      server and client markup start identical.
 *
 * INSTALL:
 *   npm i three @react-three/fiber @react-spring/three @shadergradient/react
 *   npm i -D @types/three
 */

import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react';

// Same palette used in the static fallback and the shader, so a crash
// or unsupported-device case still looks intentional, not broken.
const FALLBACK_GRADIENT_STYLE: React.CSSProperties = {
  background:
    'radial-gradient(circle at 30% 20%, #C7D2FE 0%, #4F46E5 45%, #312E81 100%)',
};

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// --- Error boundary: catches render-time crashes from the shader/canvas ---
class ShaderErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.warn('HeroShaderGradient failed to render, showing fallback:', error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function StaticFallback({ className }: { className: string }) {
  return <div className={className} style={FALLBACK_GRADIENT_STYLE} aria-hidden="true" />;
}

export default function HeroShaderGradient({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const [webglSupported, setWebglSupported] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const wrapperClassName = className || 'relative h-[420px] w-full overflow-hidden rounded-3xl md:h-[560px]';

  // Runs once, client-only. Until this flips true, we render nothing
  // dynamic — avoids hydration mismatch and confirms we're in the browser
  // before touching WebGL APIs at all.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWebglSupported(detectWebGL());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [mounted]);

  // Listen for WebGL context loss (GPU driver reset, tab backgrounded on
  // some mobile browsers, etc.) at the container level via event capture.
  useEffect(() => {
    if (!mounted) return;
    const el = containerRef.current;
    if (!el) return;

    const handleLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleRestored = () => setContextLost(false);

    el.addEventListener('webglcontextlost', handleLost, true);
    el.addEventListener('webglcontextrestored', handleRestored, true);
    return () => {
      el.removeEventListener('webglcontextlost', handleLost, true);
      el.removeEventListener('webglcontextrestored', handleRestored, true);
    };
  }, [mounted]);

  // Before mount (SSR + first client paint), or if WebGL is unsupported,
  // or if the context was lost and hasn't recovered: always show the
  // same static gradient. Never let the user see a blank/broken box.
  if (!mounted || !webglSupported || contextLost) {
    return <StaticFallback className={wrapperClassName} />;
  }

  const shouldAnimate = isVisible && !prefersReducedMotion;

  return (
    <div ref={containerRef} className={wrapperClassName} aria-hidden="true">
      <div 
        className="absolute inset-0 z-10 pointer-events-none" 
        style={{ 
          boxShadow: 'inset 0 0 120px 40px rgba(30,27,75,0.4)',
          background: 'radial-gradient(circle at 15% 12%, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 55%)'
        }} 
      />
      <ShaderErrorBoundary fallback={<StaticFallback className={wrapperClassName} />}>
        <ShaderGradientCanvas
          style={{ width: '100%', height: '100%' }}
          pixelDensity={isMobile ? 1 : 1.5}
          fov={45}
        >
          <ShaderGradient
            animate={shouldAnimate ? 'on' : 'off'}
            type="waterPlane"
            color1="#312E81"
            color2="#4F46E5"
            color3="#C7D2FE"
            cAzimuthAngle={180}
            cPolarAngle={90}
            cDistance={3.6}
            cameraZoom={1}
            positionX={-0.6}
            positionY={-0.1}
            positionZ={0}
            rotationX={0}
            rotationY={8}
            rotationZ={0}
            uDensity={1.1}
            uFrequency={5.5}
            uSpeed={isMobile ? 0.15 : 0.3}
            uStrength={2.4}
            wireframe={false}
            lightType="3d"
            envPreset="city"
            brightness={1.15}
            reflection={0.15}
            grain={isMobile ? 'off' : 'on'}
            grainBlending={0.25}
          />
        </ShaderGradientCanvas>
      </ShaderErrorBoundary>
    </div>
  );
}

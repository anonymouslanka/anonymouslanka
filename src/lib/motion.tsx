import { LazyMotion } from 'framer-motion';
import { createElement, ReactNode, useEffect, useRef } from 'react';
import { cx } from './util';

/**
 * Framer Motion is loaded lazily (domAnimation only) and used for the few things CSS can't do well:
 * enter/exit of toasts, install/update bars. Lists, pages and press states are plain CSS — transform/opacity only.
 */
const features = () => import('./motionFeatures').then((m) => m.default);
export function MotionProvider({ children }: { children: ReactNode }) {
  return <LazyMotion features={features}>{children}</LazyMotion>;
}

export const spring = { type: 'spring', stiffness: 420, damping: 36, mass: 0.7 } as const;
export const ease = [0.22, 1, 0.36, 1] as const;

type Tag = 'div' | 'ul' | 'ol' | 'section' | 'li' | 'article';

/** First children fade up in a short sequence (pure CSS, see .stagger in index.css). */
export function Stagger({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: Tag; inView?: boolean }) {
  return createElement(as, { className: cx('stagger', className) }, children);
}
export function StaggerItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: Tag }) {
  return createElement(as, { className }, children);
}
export function Reveal({ children, className }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  return <div className={cx('page-in', className)}>{children}</div>;
}

/** Animated number (count-up) using requestAnimationFrame. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = String(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      el.textContent = String(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span ref={ref} className={className}>0</span>;
}

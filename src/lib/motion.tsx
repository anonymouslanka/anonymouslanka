import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type Variants } from 'framer-motion';
import { ReactNode, useEffect, useRef } from 'react';

/** Shared easing / spring presets so the whole UI moves consistently. */
export const spring = { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 } as const;
export const softSpring = { type: 'spring', stiffness: 220, damping: 26 } as const;
export const ease = [0.22, 1, 0.36, 1] as const;

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 14, filter: 'blur(4px)' },
  enter: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease } },
  exit: { opacity: 0, y: -8, filter: 'blur(3px)', transition: { duration: 0.2, ease: 'easeIn' } },
};

export const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease } },
};

/** Staggered container: children wrapped in <StaggerItem> animate in sequence. */
export function Stagger({ children, className, as = 'div', inView = false }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'section'; inView?: boolean }) {
  const Comp = motion[as] as typeof motion.div;
  return inView ? (
    <Comp className={className} variants={listVariants} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
      {children}
    </Comp>
  ) : (
    <Comp className={className} variants={listVariants} initial="hidden" animate="show">
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' | 'article' }) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp className={className} variants={itemVariants}>
      {children}
    </Comp>
  );
}

/** Fades/slides content in once it scrolls into view. */
export function Reveal({ children, className, delay = 0, y = 24 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.55, ease, delay }}>
      {children}
    </motion.div>
  );
}

/** Wraps a clickable thing with a springy hover/press response. */
export function Pressable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.span className={className} whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.96 }} transition={spring} style={{ display: 'inline-flex' }}>
      {children}
    </motion.span>
  );
}

/** Animated number (count-up) that starts when visible. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.9, ease });
    return () => controls.stop();
  }, [inView, value, reduce, mv]);
  return <motion.span ref={ref} className={className}>{rounded}</motion.span>;
}

/** Slowly drifting colour blobs for hero backgrounds. */
export function FloatingBlob({ className, delay = 0, duration = 14 }: { className: string; delay?: number; duration?: number }) {
  return (
    <motion.div
      aria-hidden="true"
      className={className}
      animate={{ x: [0, 28, -18, 0], y: [0, -22, 16, 0], scale: [1, 1.08, 0.95, 1] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

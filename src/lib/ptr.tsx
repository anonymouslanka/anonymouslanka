import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';

/**
 * Native-style pull-to-refresh for touch devices. Starts only when the page is scrolled to the very top.
 * Returns the current pull distance so a visual indicator can follow the finger.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | unknown) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    let startY = 0;
    let active = false;
    const start = (e: TouchEvent) => {
      if (window.scrollY <= 0 && e.touches[0]) {
        startY = e.touches[0].clientY;
        active = true;
      }
    };
    const move = (e: TouchEvent) => {
      if (!active || !e.touches[0]) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) {
        active = false;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      pullRef.current = Math.min(dy * 0.5, 96);
      setPull(pullRef.current);
    };
    const end = async () => {
      if (!active) return;
      active = false;
      const reached = pullRef.current >= 64;
      pullRef.current = 0;
      setPull(0);
      if (reached) {
        setRefreshing(true);
        try {
          await cb.current();
        } finally {
          setRefreshing(false);
        }
      }
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return () => {
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  }, []);

  return { pull, refreshing };
}

export function PullIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  const visible = pull > 6 || refreshing;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-20 flex justify-center lg:hidden" aria-hidden="true">
      <motion.div
        animate={{ y: refreshing ? 14 : pull * 0.6, opacity: visible ? 1 : 0, scale: visible ? 1 : 0.6 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand-700 shadow-lift"
      >
        <motion.span animate={{ rotate: refreshing ? 360 : pull * 3 }} transition={refreshing ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 0 }}>
          <Icon name="refresh" size={20} />
        </motion.span>
      </motion.div>
    </div>
  );
}

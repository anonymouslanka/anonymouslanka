import { useEffect, useRef, useState } from 'react';
import { haptics } from './haptics';

const THRESHOLD = 64;

/**
 * Native-style pull-to-refresh for touch devices. Starts only when the page is scrolled to the very top.
 * Returns the current pull distance so a visual indicator can follow the finger.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | unknown) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const stepRef = useRef(0); // quarters of the pull already ticked (0 to 3), 4 = threshold reached
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
        stepRef.current = 0;
      }
    };
    const move = (e: TouchEvent) => {
      if (!active || !e.touches[0]) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) {
        active = false;
        pullRef.current = 0;
        stepRef.current = 0;
        setPull(0);
        return;
      }
      pullRef.current = Math.min(dy * 0.5, 96);
      // Haptics only at meaningful points: a light tick at 25 / 50 / 75 %, one firm pulse at the threshold.
      const step = pullRef.current >= THRESHOLD ? 4 : Math.floor((pullRef.current / THRESHOLD) * 4);
      if (step > stepRef.current) {
        if (step === 4) haptics.pullReady();
        else if (step >= 1) haptics.pullTick();
        stepRef.current = step;
      } else if (step < 4 && stepRef.current === 4 && pullRef.current < THRESHOLD * 0.85) {
        stepRef.current = 3; // pulled back above the line: re-arm quietly, the pulse can fire again
      }
      setPull(pullRef.current);
    };
    const end = async () => {
      if (!active) return;
      active = false;
      const reached = pullRef.current >= THRESHOLD;
      pullRef.current = 0;
      stepRef.current = 0;
      setPull(0);
      if (reached) {
        setRefreshing(true);
        try {
          // keep the spinner up for at least a moment so a very fast reload is still noticed
          await Promise.all([cb.current(), new Promise((r) => setTimeout(r, 700))]);
          haptics.refreshed();
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
  const progress = Math.min(1, pull / THRESHOLD);
  const ready = progress >= 1;
  const C = 2 * Math.PI * 13;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(3rem+env(safe-area-inset-top))] z-20 flex justify-center lg:hidden" aria-hidden="true">
      <div
        key={ready && !refreshing ? 'ready' : 'idle'}
        className={`grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white text-brand-700 ${ready && !refreshing ? 'ptr-ready' : ''}`}
        style={{ transform: `translateY(${refreshing ? 12 : Math.min(pull, 80) * 0.55}px)`, opacity: visible ? 1 : 0, transition: pull ? 'none' : 'transform .25s cubic-bezier(.2,.9,.3,1), opacity .2s' }}
      >
        <svg width="30" height="30" viewBox="0 0 30 30" className={refreshing ? 'animate-spin' : ''} style={{ transform: refreshing ? undefined : `rotate(${-90 + pull * 2.5}deg)` }}>
          <circle cx="15" cy="15" r="13" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2.5" />
          <circle cx="15" cy="15" r="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={refreshing ? C * 0.7 : C * (1 - progress)} />
        </svg>
      </div>
    </div>
  );
}

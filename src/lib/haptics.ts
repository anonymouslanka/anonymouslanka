/**
 * Haptic feedback.
 *  - Android / Chromium: navigator.vibrate patterns.
 *  - iPhone / iPad (iOS 18+): Safari has no vibrate API, but toggling an `<input switch>` through its label plays the
 *    system "switch" tick. It only works inside a user gesture, so it is triggered from click handlers.
 * Everything silently does nothing where unsupported, and respects the "reduce motion" setting and an opt-out flag.
 */
const KEY = 'app:haptics';
let label: HTMLLabelElement | null = null;
let last = 0;

const enabled = (): boolean => {
  try {
    if (localStorage.getItem(KEY) === '0') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
};

export const hapticsEnabled = enabled;
export const setHapticsEnabled = (on: boolean): void => {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
};

function iosTick(): void {
  try {
    if (!label) {
      label = document.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.display = 'none';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      label.appendChild(input);
      document.head.appendChild(label);
    }
    label.click();
  } catch {
    /* ignore */
  }
}

function fire(pattern: number | number[], ticks = 1): void {
  if (!enabled()) return;
  const now = Date.now();
  if (now - last < 45) return; // never double-fire for one gesture
  last = now;
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
      return;
    }
  } catch {
    /* ignore */
  }
  iosTick();
  for (let i = 1; i < ticks; i++) setTimeout(iosTick, i * 110);
}

export const haptics = {
  /** Button / link press. */
  tap: () => fire(8),
  /** Toggle, tab, selection change. */
  select: () => fire(6),
  /** Something completed. */
  success: () => fire([10, 45, 16], 2),
  /** Needs attention (confirm a destructive action). */
  warning: () => fire(18),
  /** Failure. */
  error: () => fire([24, 50, 24, 50, 24], 3),
};

/** One delegated listener gives every button, link, tab and switch a tactile tick. */
export function installHaptics(): void {
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>('button, a[href], [role="button"], [role="tab"], [role="switch"], summary, select, input[type="checkbox"], input[type="radio"]');
      if (!el || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.closest('[data-no-haptic]')) return;
      if (el.matches('[role="switch"], [role="tab"], input[type="checkbox"], input[type="radio"], select')) haptics.select();
      else if (el.classList.contains('btn-danger')) haptics.warning();
      else haptics.tap();
    },
    { capture: true, passive: true },
  );
}

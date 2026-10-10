import { useState } from 'react';
import { canVibrate, haptics, hapticsEnabled } from '../lib/haptics';
import { Icon } from './Icon';

/** A tap-to-feel test for the pull-to-refresh haptics, with an honest note about what this device can do. */
export function HapticsCheck() {
  const [ran, setRan] = useState(false);
  const ios = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const vibrate = canVibrate();
  const on = hapticsEnabled();

  const run = () => {
    setRan(true);
    haptics.pullTick();
    setTimeout(() => haptics.pullTick(), 200);
    setTimeout(() => haptics.pullReady(), 450);
    setTimeout(() => haptics.refreshed(), 800);
  };

  return (
    <section className="card mt-4 p-4">
      <h2 className="mb-2 font-mono text-xs tracking-[0.14em] text-ink-soft uppercase">Haptics check</h2>
      <p className="text-sm text-ink-soft">Tap the button. You should feel two light ticks, one firm pulse and two quick taps, the same as when you pull to refresh.</p>
      <button className="btn-secondary mt-3" onClick={run}><Icon name="pulse" size={17} /> Feel it</button>
      <ul className="mt-3 space-y-1 text-xs text-ink-soft">
        <li>Device: {ios ? 'iPhone or iPad' : vibrate ? 'can vibrate (Android or similar)' : 'no vibration support (desktop)'}</li>
        {!on && <li className="font-bold text-amber-700">Haptics are switched off here (the system reduce-motion setting, or the app switch).</li>}
        {ios && <li>On iPhone the app can only use Safari&rsquo;s hidden switch trick. Reports say Apple removed it in iOS 26.5, and it may not play while a finger is dragging. If you feel nothing here, this device does not allow web apps to vibrate.</li>}
        {ran && !ios && !vibrate && <li>Nothing to feel on this device.</li>}
      </ul>
    </section>
  );
}

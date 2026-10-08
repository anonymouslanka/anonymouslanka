import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { Dialog } from './ui';

/**
 * PWA plumbing: service-worker registration + update prompt, install prompt (Chrome/Edge/Android/desktop),
 * iOS "Add to Home Screen" guidance and online/offline awareness.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  online: boolean;
  standalone: boolean;
  isIOS: boolean;
  canInstall: boolean;
  installable: boolean;
  updateReady: boolean;
  install: () => Promise<void>;
  applyUpdate: () => void;
  showIOSHelp: boolean;
  setShowIOSHelp: (v: boolean) => void;
}

const Ctx = createContext<PwaState | null>(null);
export const usePwa = (): PwaState => {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePwa outside PwaProvider');
  return v;
};

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const detectIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function PwaProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [standalone, setStandalone] = useState(isStandalone);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const isIOS = useMemo(detectIOS, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const mq = window.matchMedia('(display-mode: standalone)');
    const mqFn = () => setStandalone(isStandalone());
    mq.addEventListener('change', mqFn);
    const bip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const installed = () => {
      setDeferred(null);
      setStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', bip);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      mq.removeEventListener('change', mqFn);
      window.removeEventListener('beforeinstallprompt', bip);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    let cancelled = false;
    let interval: number | undefined;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        if (cancelled) return;
        const track = (w: ServiceWorker | null) => {
          if (!w) return;
          w.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) setWaiting(w);
          });
        };
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener('updatefound', () => track(reg.installing));
        interval = window.setInterval(() => reg.update().catch(() => undefined), 60 * 60 * 1000);
      } catch {
        /* service workers unavailable (private mode etc.) — the app still works */
      }
    };
    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', register, { once: true });
    let reloading = false;
    const onChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => undefined);
      setDeferred(null);
    } else if (isIOS) {
      setShowIOSHelp(true);
    }
  }, [deferred, isIOS]);

  const applyUpdate = useCallback(() => waiting?.postMessage('SKIP_WAITING'), [waiting]);

  const value: PwaState = {
    online,
    standalone,
    isIOS,
    canInstall: deferred !== null,
    installable: !standalone && (deferred !== null || isIOS),
    updateReady: waiting !== null,
    install,
    applyUpdate,
    showIOSHelp,
    setShowIOSHelp,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <IOSInstallSheet />
    </Ctx.Provider>
  );
}

/** Slim status strip shown when the device is offline. */
export function OfflineBar() {
  const { online } = usePwa();
  if (online) return null;
  return (
    <div role="status" className="bg-ink px-4 py-2 text-center text-xs font-semibold text-white">
      <span className="inline-flex items-center gap-2"><Icon name="offline" size={14} /> You are offline — showing saved case files where available.</span>
    </div>
  );
}

/** Bar offering to reload when a new version of the app has been downloaded. */
export function UpdateToast() {
  const { updateReady, applyUpdate } = usePwa();
  if (!updateReady) return null;
  return (
    <div className="toast-in fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white lg:bottom-6">
      <span>A new version is ready.</span>
      <button className="rounded-xl bg-white/15 px-4 py-2 font-bold active:bg-white/25" onClick={applyUpdate}>
        Update
      </button>
    </div>
  );
}

/** Dismissible install card (home screen). Hidden once installed or dismissed. */
export function InstallCard() {
  const { installable, install, isIOS, canInstall } = usePwa();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('app:install-dismissed') === '1';
    } catch {
      return false;
    }
  });
  const hide = () => {
    setDismissed(true);
    try {
      localStorage.setItem('app:install-dismissed', '1');
    } catch {
      /* ignore */
    }
  };
  if (!(installable && !dismissed && (canInstall || isIOS))) return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-folder-deep/70 bg-folder/50 p-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-folder">
        <Icon name="download" size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Install DetectiveLanka</p>
        <p className="text-xs text-ink-soft">Full-screen app, works offline.</p>
      </div>
      <button className="btn-primary !min-h-10 !px-4" onClick={install}>
        Install
      </button>
      <button className="btn-ghost !min-h-10 !px-2.5" aria-label="Dismiss" onClick={hide}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

function IOSInstallSheet() {
  const { showIOSHelp, setShowIOSHelp } = usePwa();
  return (
    <Dialog open={showIOSHelp} onClose={() => setShowIOSHelp(false)} title="Install on iPhone or iPad">
      <ol className="space-y-4 text-sm text-ink">
        <li className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">1</span>
          <span>
            Open this page in <strong>Safari</strong>, then tap the <strong>Share</strong> button <Icon name="share" size={16} className="-mt-1 inline" /> in the toolbar.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">2</span>
          <span>
            Scroll down and choose <strong>Add to Home Screen</strong> <Icon name="plus" size={16} className="-mt-1 inline" />.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white">3</span>
          <span>
            Tap <strong>Add</strong>. DetectiveLanka opens full-screen from your home screen, like any other app.
          </span>
        </li>
      </ol>
      <button className="btn-primary mt-6 w-full" onClick={() => setShowIOSHelp(false)}>
        Got it
      </button>
    </Dialog>
  );
}

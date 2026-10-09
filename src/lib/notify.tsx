import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, ApiError, deviceStore } from './api';

/* ───────────── unread badge (shared by the top bar, the rail and the notification page) ───────────── */
interface UnreadState {
  count: number;
  refresh: () => void;
  set: (n: number) => void;
}
export const UnreadCtx = createContext<UnreadState>({ count: 0, refresh: () => undefined, set: () => undefined });
export const useUnread = (): UnreadState => useContext(UnreadCtx);

/** Keeps the unread count fresh: on load, when the tab/app comes back, when the network returns and when a push arrives. */
export function useUnreadProvider(): UnreadState {
  const [count, setCount] = useState(0);
  const busy = useRef(false);
  const refresh = useCallback(() => {
    if (!deviceStore.get() || busy.current || document.visibilityState === 'hidden') return; // no device yet = nothing to count
    busy.current = true;
    api
      .unreadCount()
      .then((r) => setCount(r.count))
      .catch(() => undefined)
      .finally(() => {
        busy.current = false;
      });
  }, []);
  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener('focus', on);
    window.addEventListener('online', on);
    document.addEventListener('visibilitychange', on);
    return () => {
      window.removeEventListener('focus', on);
      window.removeEventListener('online', on);
      document.removeEventListener('visibilitychange', on);
    };
  }, [refresh]);
  return { count, refresh, set: setCount };
}

/* ───────────── Web Push helpers ───────────── */
const FLAG = 'app:push-on';

export const pushSupported = (): boolean => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const permission = (): NotificationPermission | 'unsupported' => (pushSupported() ? Notification.permission : 'unsupported');

const keyBytes = (b64: string): BufferSource => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** The app's service worker (it exists only in the production build / installed app). */
async function registration(timeoutMs = 6000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration(2500);
  return reg ? reg.pushManager.getSubscription() : null;
}

export type EnableResult = 'ok' | 'denied' | 'dismissed' | 'unsupported' | 'no-service-worker' | 'unavailable' | 'error';

/**
 * Called ONLY from an explicit button press. Asks the browser for permission, subscribes and registers the subscription with
 * the server. Never invoked automatically, and not at all once the user has blocked notifications.
 */
export async function enablePush(): Promise<EnableResult> {
  if (!pushSupported()) return 'unsupported';
  try {
    const key = await api.pushKey();
    if (!key.enabled || !key.publicKey) return 'unavailable';
    const reg = await registration();
    if (!reg) return 'no-service-worker';
    const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (result === 'denied') return 'denied';
    if (result !== 'granted') return 'dismissed';
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key.publicKey) }));
    const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!j.endpoint || !j.keys?.p256dh || !j.keys.auth) return 'error';
    await api.subscribePush({ endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth } });
    try {
      localStorage.setItem(FLAG, '1');
    } catch {
      /* ignore */
    }
    return 'ok';
  } catch (e) {
    return e instanceof ApiError && e.code === 'PUSH_UNAVAILABLE' ? 'unavailable' : 'error';
  }
}

export async function disablePush(): Promise<void> {
  try {
    localStorage.removeItem(FLAG);
  } catch {
    /* ignore */
  }
  try {
    const sub = await currentSubscription();
    await sub?.unsubscribe();
  } catch {
    /* ignore */
  }
  await api.unsubscribePush().catch(() => undefined);
}

/** If the user had push on but the browser rotated the subscription, quietly register the new one (no prompt). */
export async function resyncPush(): Promise<void> {
  try {
    if (!pushSupported() || Notification.permission !== 'granted' || localStorage.getItem(FLAG) !== '1' || !deviceStore.get()) return;
    if (sessionStorage.getItem('app:push-synced')) return;
    sessionStorage.setItem('app:push-synced', '1');
    await enablePush();
  } catch {
    /* ignore */
  }
}

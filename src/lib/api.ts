import axios, { AxiosError } from 'axios';
import { t } from './i18n';
import type { AnnouncementPublic, Category, DeviceStatus, FollowedCase, NotifPrefs, NotificationItem, OwnerComment, OwnerPost, Page, PageMeta, PostDetail, PostSummary, PublicComment } from './types';

const baseURL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? 'http://localhost:4000/api/v1';

export const API_BASE = baseURL;

const http = axios.create({ baseURL, timeout: 60_000 });

/** Normalised error shown to users. Never contains stack traces or server internals. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fields: Record<string, string[]> = {},
    /** Seconds the server asked us to wait (rate limits / warm-up). */
    public readonly retryAfter = 0,
  ) {
    super(message);
  }
}

const wait = (s: number) => (s >= 3600 ? `${Math.ceil(s / 3600)} hour(s)` : s >= 90 ? `${Math.ceil(s / 60)} minutes` : `${Math.max(1, Math.round(s))} seconds`);

/** Friendly text for every failure the user can hit. The server's own message is used only where it is already user-safe. */
const FRIENDLY: Record<string, string> = {
  RATE_LIMITED: 'You are doing that too often. Please wait a little and try again.',
  UPLOAD_FAILED: 'Your photos could not be uploaded. Nothing was saved, please try again.',
  UPLOADS_UNAVAILABLE: 'Photo uploads are temporarily unavailable. You can submit without photos.',
  INVALID_IMAGE: 'One of the files is not a valid image.',
  UNSUPPORTED_FILE_TYPE: 'Only JPEG, PNG and WebP photos are allowed.',
  PAYLOAD_TOO_LARGE: 'That is too large to send. Try fewer or smaller photos.',
  DATABASE_UNAVAILABLE: 'The service is busy right now. Please try again in a moment.',
  SERVICE_UNAVAILABLE: 'The service is busy right now. Please try again in a moment.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
};

function normalize(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const e = err as AxiosError<{ error?: { code?: string; message?: string; details?: { field: string; messages: string[] }[] } }>;
  if (e.response) {
    const body = e.response.data?.error;
    const fields: Record<string, string[]> = {};
    body?.details?.forEach?.((d) => (fields[d.field] = d.messages));
    const status = e.response.status;
    const code = body?.code ?? (status === 502 || status === 503 || status === 504 ? 'SERVICE_UNAVAILABLE' : 'ERROR');
    const retryAfter = Number(e.response.headers?.['retry-after']) || 0;
    let message = body?.message ?? 'Something went wrong. Please try again.';
    if (code === 'RATE_LIMITED') message = retryAfter ? `You are doing that too often. Please try again in ${wait(retryAfter)}.` : FRIENDLY.RATE_LIMITED!;
    else if (status >= 500 || FRIENDLY[code]) message = FRIENDLY[code] ?? FRIENDLY.INTERNAL_ERROR!;
    return new ApiError(message, status, code, fields, retryAfter);
  }
  if (e.code === 'ECONNABORTED') return new ApiError(t('The server took too long to answer. Please try again.'), 0, 'TIMEOUT');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new ApiError(t('You are offline. Check your connection and try again.'), 0, 'NETWORK_ERROR');
  return new ApiError(t('Cannot reach the server. Check your connection and try again.'), 0, 'NETWORK_ERROR');
}

/* ───── slow-request tracking: lets the UI say "waking up the server" instead of looking frozen ───── */
let pending = 0;
let slowTimer: ReturnType<typeof setTimeout> | undefined;
const slowListeners = new Set<(slow: boolean) => void>();
const emitSlow = (v: boolean) => slowListeners.forEach((fn) => fn(v));
export const subscribeSlow = (fn: (slow: boolean) => void): (() => void) => {
  slowListeners.add(fn);
  return () => slowListeners.delete(fn);
};
http.interceptors.request.use((config) => {
  if (pending++ === 0) slowTimer = setTimeout(() => emitSlow(true), 4000);
  return config;
});
const settled = () => {
  if (--pending <= 0) {
    pending = 0;
    clearTimeout(slowTimer);
    emitSlow(false);
  }
};

/** Safe GETs retry on network failures / gateway errors with backoff (covers the free host's cold start). */
http.interceptors.response.use(
  (res) => {
    settled();
    return res;
  },
  async (error: AxiosError) => {
    const cfg = error.config as (typeof error.config & { __try?: number }) | undefined;
    const status = error.response?.status ?? 0;
    const transient = !error.response ? error.code !== 'ECONNABORTED' : [502, 503, 504].includes(status);
    if (cfg && cfg.method === 'get' && transient && (cfg.__try ?? 0) < 3 && navigator.onLine !== false) {
      cfg.__try = (cfg.__try ?? 0) + 1;
      await new Promise((r) => setTimeout(r, 1200 * cfg.__try!));
      settled(); // the retry registers itself again
      return http.request(cfg);
    }
    settled();
    throw error;
  },
);

async function call<T>(req: Promise<{ data: { data: T; meta?: PageMeta } }>): Promise<T> {
  try {
    return (await req).data.data;
  } catch (e) {
    throw normalize(e);
  }
}

async function callPage<T>(req: Promise<{ data: { data: T[]; meta?: PageMeta } }>): Promise<Page<T>> {
  try {
    const { data } = await req;
    return { items: data.data, meta: data.meta ?? { hasMore: false, nextCursor: null, limit: data.data.length } };
  } catch (e) {
    throw normalize(e);
  }
}

const keyHeader = (key: string) => ({ headers: { 'X-Edit-Key': key } });

/**
 * Offline reading: successful PUBLIC reads (case lists, case files, case types, statements) are mirrored into
 * localStorage so the installed app can still show recently viewed content without a connection.
 * Nothing private is ever stored here, edit-key (owner) endpoints bypass this cache entirely.
 */
const CACHE_INDEX = 'app:cache-index';
const CACHE_MAX = 40;
function cacheRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem('app:cache:' + key);
    return raw ? (JSON.parse(raw) as { d: T }).d : null;
  } catch {
    return null;
  }
}
function cacheWrite(key: string, data: unknown): void {
  try {
    localStorage.setItem('app:cache:' + key, JSON.stringify({ t: Date.now(), d: data }));
    const index: string[] = JSON.parse(localStorage.getItem(CACHE_INDEX) ?? '[]');
    const next = [key, ...index.filter((k) => k !== key)];
    for (const old of next.slice(CACHE_MAX)) localStorage.removeItem('app:cache:' + old);
    localStorage.setItem(CACHE_INDEX, JSON.stringify(next.slice(0, CACHE_MAX)));
  } catch {
    /* storage full or blocked: offline cache is a nicety, never required */
  }
}
const isOffline = (e: unknown) => e instanceof ApiError && (e.code === 'NETWORK_ERROR' || e.code === 'TIMEOUT');

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  try {
    const data = await load();
    cacheWrite(key, data);
    return data;
  } catch (e) {
    if (isOffline(e)) {
      const hit = cacheRead<T>(key);
      if (hit !== null) return hit;
    }
    throw e;
  }
}

export interface FeedParams {
  cursor?: string | null;
  q?: string;
  category?: string;
  tag?: string;
  sort?: 'newest' | 'oldest';
  exhibits?: boolean;
  limit?: number;
}

// ───────── anonymous device (no account): a random token kept in this browser, sent only as X-Device-Token ─────────
const DEVICE_KEY = 'app:device';
export const deviceStore = {
  get(): string | null {
    try {
      return localStorage.getItem(DEVICE_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(DEVICE_KEY, token);
    } catch {
      /* ignore */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(DEVICE_KEY);
    } catch {
      /* ignore */
    }
  },
};

let creating: Promise<string> | null = null;
async function ensureDevice(): Promise<string> {
  const existing = deviceStore.get();
  if (existing) return existing;
  creating ??= call<{ token: string }>(http.post('/devices'))
    .then((r) => {
      deviceStore.set(r.token);
      return r.token;
    })
    .finally(() => {
      creating = null;
    });
  return creating;
}

type DeviceHeaders = { headers: Record<string, string> };
/** Runs a device-authenticated request. `create` = register the device first if this browser has none yet. */
async function withDevice<T>(run: (h: DeviceHeaders) => Promise<T>, create = true): Promise<T> {
  let token = create ? await ensureDevice() : deviceStore.get();
  if (!token) throw new ApiError(t('This device has no notification settings yet.'), 0, 'NO_DEVICE');
  try {
    return await run({ headers: { 'X-Device-Token': token } });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'DEVICE_REQUIRED') {
      deviceStore.clear(); // the server forgot this device (e.g. it was unused for months)
      if (!create) throw e;
      token = await ensureDevice();
      return run({ headers: { 'X-Device-Token': token } });
    }
    throw e;
  }
}

export const api = {
  // notifications
  pushKey: () => call<{ enabled: boolean; publicKey: string | null }>(http.get('/push/key')),
  deviceMe: () => withDevice((h) => call<DeviceStatus>(http.get('/devices/me', h))),
  setPrefs: (p: Partial<NotifPrefs>) => withDevice((h) => call<{ prefs: NotifPrefs }>(http.patch('/devices/me', p, h))),
  forgetDevice: async () => {
    await withDevice((h) => call<{ deleted: true }>(http.delete('/devices/me', h)), false).catch(() => undefined);
    deviceStore.clear();
  },
  subscribePush: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) => withDevice((h) => call<{ subscribed: true }>(http.post('/devices/me/push', sub, h))),
  unsubscribePush: () => withDevice((h) => call<{ subscribed: false }>(http.delete('/devices/me/push', h)), false),
  testPush: () => withDevice((h) => call<{ sent: boolean }>(http.post('/devices/me/push/test', {}, h))),
  notifications: (cursor?: string | null) => withDevice((h) => callPage<NotificationItem>(http.get('/notifications', { ...h, params: { cursor: cursor || undefined } }))),
  unreadCount: () => withDevice((h) => call<{ count: number }>(http.get('/notifications/unread-count', h)), false),
  markRead: (ids: string[]) => withDevice((h) => call<{ ok: true }>(http.post('/notifications/read', { ids }, h)), false),
  markAllRead: () => withDevice((h) => call<{ ok: true }>(http.post('/notifications/read-all', {}, h))),
  votes: (id: string) => call<{ total: number; counts: Record<string, number> }>(http.get(`/posts/${id}/votes`)),
  vote: (id: string, choice: string) => withDevice((h) => call<{ total: number; counts: Record<string, number> }>(http.put(`/posts/${id}/vote`, { choice }, h))),
  follows: () => withDevice((h) => call<FollowedCase[]>(http.get('/follows', h)), false),
  follow: (id: string) => withDevice((h) => call<{ following: true }>(http.put(`/posts/${id}/follow`, {}, h))),
  unfollow: (id: string) => withDevice((h) => call<{ following: false }>(http.delete(`/posts/${id}/follow`, h)), false),
  announcement: (id: string) => cached(`announcement:${id}`, () => call<AnnouncementPublic>(http.get(`/announcements/${id}`))),


  categories: () => cached('categories', () => call<Category[]>(http.get('/categories'))),

  listPosts: (p: FeedParams) =>
    cached(`feed:${p.cursor ?? ''}:${p.q ?? ''}:${p.category ?? ''}:${p.tag ?? ''}:${p.sort ?? ''}:${p.exhibits ? 1 : 0}`, () =>
      callPage<PostSummary>(
        http.get('/posts', { params: { cursor: p.cursor || undefined, q: p.q || undefined, category: p.category || undefined, tag: p.tag || undefined, sort: p.sort && p.sort !== 'newest' ? p.sort : undefined, exhibits: p.exhibits ? 'true' : undefined, limit: p.limit } }),
      ),
    ),
  getPost: (id: string) => cached(`case:${id}`, () => call<PostDetail>(http.get(`/posts/${id}`))),
  createPost: (form: FormData, onProgress?: (pct: number) => void) =>
    call<{ post: OwnerPost; editKey: string }>(http.post('/posts', form, { timeout: 120_000, onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)) })),
  getOwnerPost: (id: string, key: string) => call<OwnerPost>(http.get(`/posts/${id}/owner`, keyHeader(key))),
  updatePost: (id: string, key: string, form: FormData) => call<OwnerPost>(http.patch(`/posts/${id}`, form, keyHeader(key))),
  deletePost: (id: string, key: string) => call<{ deleted: true }>(http.delete(`/posts/${id}`, keyHeader(key))),

  listComments: (postId: string, cursor?: string | null) =>
    cached(`statements:${postId}:${cursor ?? ''}`, () => callPage<PublicComment>(http.get(`/posts/${postId}/comments`, { params: { cursor: cursor || undefined } }))),
  createComment: (postId: string, form: FormData, onProgress?: (pct: number) => void) =>
    call<{ comment: OwnerComment; editKey: string }>(http.post(`/posts/${postId}/comments`, form, { timeout: 120_000, onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)) })),
  reportPost: (id: string) => call<{ reported: true; hidden: boolean; duplicate?: boolean }>(http.post(`/posts/${id}/report`)),
  reportComment: (id: string) => call<{ reported: true; hidden: boolean; duplicate?: boolean }>(http.post(`/comments/${id}/report`)),
  getOwnerComment: (id: string, key: string) => call<OwnerComment>(http.get(`/comments/${id}/owner`, keyHeader(key))),
  updateComment: (id: string, key: string, form: FormData) => call<OwnerComment>(http.patch(`/comments/${id}`, form, keyHeader(key))),
  deleteComment: (id: string, key: string) => call<{ deleted: true }>(http.delete(`/comments/${id}`, keyHeader(key))),
};

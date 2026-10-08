import axios, { AxiosError } from 'axios';
import type { Category, OwnerComment, OwnerPost, Page, PageMeta, PostDetail, PostSummary, PublicComment } from './types';

const baseURL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') ?? 'http://localhost:4000/api/v1';

const http = axios.create({ baseURL, timeout: 45_000 });

/** Normalised error shown to users. Never contains stack traces or server internals. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

function normalize(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const e = err as AxiosError<{ error?: { code?: string; message?: string; details?: { field: string; messages: string[] }[] } }>;
  if (e.response) {
    const body = e.response.data?.error;
    const fields: Record<string, string[]> = {};
    body?.details?.forEach?.((d) => (fields[d.field] = d.messages));
    return new ApiError(body?.message ?? 'Something went wrong. Please try again.', e.response.status, body?.code ?? 'ERROR', fields);
  }
  if (e.code === 'ECONNABORTED') return new ApiError('The request timed out. Please try again.', 0, 'TIMEOUT');
  return new ApiError('Cannot reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR');
}

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
 * Nothing private is ever stored here — edit-key (owner) endpoints bypass this cache entirely.
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

export const api = {
  categories: () => cached('categories', () => call<Category[]>(http.get('/categories'))),

  listPosts: (p: FeedParams) =>
    cached(`feed:${p.cursor ?? ''}:${p.q ?? ''}:${p.category ?? ''}:${p.tag ?? ''}:${p.sort ?? ''}:${p.exhibits ? 1 : 0}`, () =>
      callPage<PostSummary>(
        http.get('/posts', { params: { cursor: p.cursor || undefined, q: p.q || undefined, category: p.category || undefined, tag: p.tag || undefined, sort: p.sort && p.sort !== 'newest' ? p.sort : undefined, exhibits: p.exhibits ? 'true' : undefined, limit: p.limit } }),
      ),
    ),
  getPost: (id: string) => cached(`case:${id}`, () => call<PostDetail>(http.get(`/posts/${id}`))),
  createPost: (form: FormData) => call<{ post: OwnerPost; editKey: string }>(http.post('/posts', form)),
  getOwnerPost: (id: string, key: string) => call<OwnerPost>(http.get(`/posts/${id}/owner`, keyHeader(key))),
  updatePost: (id: string, key: string, form: FormData) => call<OwnerPost>(http.patch(`/posts/${id}`, form, keyHeader(key))),
  deletePost: (id: string, key: string) => call<{ deleted: true }>(http.delete(`/posts/${id}`, keyHeader(key))),

  listComments: (postId: string, cursor?: string | null) =>
    cached(`statements:${postId}:${cursor ?? ''}`, () => callPage<PublicComment>(http.get(`/posts/${postId}/comments`, { params: { cursor: cursor || undefined } }))),
  createComment: (postId: string, form: FormData) =>
    call<{ comment: OwnerComment; editKey: string }>(http.post(`/posts/${postId}/comments`, form)),
  getOwnerComment: (id: string, key: string) => call<OwnerComment>(http.get(`/comments/${id}/owner`, keyHeader(key))),
  updateComment: (id: string, key: string, form: FormData) => call<OwnerComment>(http.patch(`/comments/${id}`, form, keyHeader(key))),
  deleteComment: (id: string, key: string) => call<{ deleted: true }>(http.delete(`/comments/${id}`, keyHeader(key))),
};

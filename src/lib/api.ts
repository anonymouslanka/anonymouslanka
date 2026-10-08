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

export interface FeedParams {
  cursor?: string | null;
  q?: string;
  category?: string;
  tag?: string;
  limit?: number;
}

export const api = {
  categories: () => call<Category[]>(http.get('/categories')),

  listPosts: (p: FeedParams) =>
    callPage<PostSummary>(
      http.get('/posts', { params: { cursor: p.cursor || undefined, q: p.q || undefined, category: p.category || undefined, tag: p.tag || undefined, limit: p.limit } }),
    ),
  getPost: (id: string) => call<PostDetail>(http.get(`/posts/${id}`)),
  createPost: (form: FormData) => call<{ post: OwnerPost; editKey: string }>(http.post('/posts', form)),
  getOwnerPost: (id: string, key: string) => call<OwnerPost>(http.get(`/posts/${id}/owner`, keyHeader(key))),
  updatePost: (id: string, key: string, form: FormData) => call<OwnerPost>(http.patch(`/posts/${id}`, form, keyHeader(key))),
  deletePost: (id: string, key: string) => call<{ deleted: true }>(http.delete(`/posts/${id}`, keyHeader(key))),

  listComments: (postId: string, cursor?: string | null) =>
    callPage<PublicComment>(http.get(`/posts/${postId}/comments`, { params: { cursor: cursor || undefined } })),
  createComment: (postId: string, content: string) =>
    call<{ comment: OwnerComment; editKey: string }>(http.post(`/posts/${postId}/comments`, { content })),
  getOwnerComment: (id: string, key: string) => call<OwnerComment>(http.get(`/comments/${id}/owner`, keyHeader(key))),
  updateComment: (id: string, key: string, content: string) => call<OwnerComment>(http.patch(`/comments/${id}`, { content }, keyHeader(key))),
  deleteComment: (id: string, key: string) => call<{ deleted: true }>(http.delete(`/comments/${id}`, keyHeader(key))),
};

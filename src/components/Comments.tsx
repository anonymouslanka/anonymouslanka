import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { storage } from '../lib/storage';
import type { OwnerComment, PublicComment } from '../lib/types';
import { timeAgo } from '../lib/util';
import { EditKeyDialog } from './EditKeyDialog';
import { ConfirmDialog, ErrorState, FieldError, Skeleton, Spinner, StatusBadge, useToast } from './ui';

/**
 * Public approved comments + the visitor's own (possibly pending) comments,
 * recovered from this device's localStorage. Each comment has its own independent edit key.
 */
export function Comments({ postId }: { postId: string }) {
  const toast = useToast();
  const [items, setItems] = useState<PublicComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const [mine, setMine] = useState<OwnerComment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErr, setFieldErr] = useState<string[]>();
  const [newKey, setNewKey] = useState<{ key: string; saved: boolean } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [toDelete, setToDelete] = useState<OwnerComment | null>(null);

  const load = useCallback(
    async (next?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const page = await api.listComments(postId, next);
        setItems((prev) => (next ? [...prev, ...page.items] : page.items));
        setCursor(page.meta.nextCursor);
        setHasMore(page.meta.hasMore);
      } catch (e) {
        setError(e as ApiError);
      } finally {
        setLoading(false);
      }
    },
    [postId],
  );

  const loadMine = useCallback(async () => {
    const results = await Promise.all(
      storage.listCommentIds(postId).map(async (id) => {
        const key = storage.getCommentKey(id);
        if (!key) return null;
        try {
          return await api.getOwnerComment(id, key);
        } catch (e) {
          if (e instanceof ApiError && (e.status === 404 || e.code === 'INVALID_EDIT_KEY')) storage.removeComment(postId, id);
          return null;
        }
      }),
    );
    setMine(results.filter((c): c is OwnerComment => c !== null));
  }, [postId]);

  useEffect(() => {
    void load();
    void loadMine();
  }, [load, loadMine]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFieldErr(undefined);
    try {
      const { comment, editKey } = await api.createComment(postId, text);
      const saved = storage.saveCommentKey(postId, comment.id, editKey);
      setText('');
      setNewKey({ key: editKey, saved });
      await loadMine();
    } catch (err) {
      const ae = err as ApiError;
      if (ae.fields.content) setFieldErr(ae.fields.content);
      else toast('error', ae.message);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (c: OwnerComment) => {
    const key = storage.getCommentKey(c.id);
    if (!key) return;
    setBusy(true);
    try {
      await api.updateComment(c.id, key, editText);
      toast('success', 'Comment updated. It will be reviewed again before it appears.');
      setEditing(null);
      await Promise.all([loadMine(), load()]);
    } catch (err) {
      toast('error', (err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const key = storage.getCommentKey(toDelete.id);
    setBusy(true);
    try {
      if (key) await api.deleteComment(toDelete.id, key);
      storage.removeComment(postId, toDelete.id);
      toast('success', 'Comment deleted.');
      setToDelete(null);
      await Promise.all([loadMine(), load()]);
    } catch (err) {
      toast('error', (err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="comments-h" className="mt-12">
      <h2 id="comments-h" className="font-display text-2xl font-semibold">Comments</h2>

      <form onSubmit={submit} className="card mt-5 p-4 sm:p-5">
        <label htmlFor="comment" className="label">Add a comment — anonymous, reviewed before publishing</label>
        <textarea id="comment" className="input min-h-24" maxLength={2000} required minLength={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share what you know. Do not include personal contact details." />
        <FieldError messages={fieldErr} />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-stone-500">{text.length}/2000</span>
          <button className="btn-primary" disabled={busy || text.trim().length < 2}>{busy && <Spinner />}Post comment</button>
        </div>
      </form>

      {mine.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold text-stone-600 dark:text-stone-400">Your comments on this device</h3>
          {mine.map((c) => (
            <div key={c.id} className="card border-dashed p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <StatusBadge status={c.status} />
                <span className="text-xs text-stone-500">{timeAgo(c.createdAt)}</span>
              </div>
              {editing === c.id ? (
                <div className="space-y-2">
                  <textarea className="input min-h-20" value={editText} maxLength={2000} onChange={(e) => setEditText(e.target.value)} aria-label="Edit comment" />
                  <div className="flex justify-end gap-2">
                    <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                    <button className="btn-primary" disabled={busy || editText.trim().length < 2} onClick={() => saveEdit(c)}>Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="prose-plain text-sm">{c.content}</p>
                  {c.status === 'REJECTED' && c.rejectionReason && <p className="mt-2 text-xs text-red-600">Reason: {c.rejectionReason}</p>}
                  <div className="mt-3 flex gap-2">
                    <button className="btn-ghost !min-h-8 !px-2.5 !text-xs" onClick={() => { setEditing(c.id); setEditText(c.content); }}>Edit</button>
                    <button className="btn-ghost !min-h-8 !px-2.5 !text-xs !text-red-600" onClick={() => setToDelete(c)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 space-y-4">
        {items.map((c) => (
          <article key={c.id} className="border-b border-stone-200 pb-4 last:border-0 dark:border-stone-800">
            <p className="prose-plain text-[0.95rem]">{c.content}</p>
            <p className="mt-1.5 text-xs text-stone-500">Anonymous · {timeAgo(c.createdAt)}</p>
          </article>
        ))}
        {loading && [0, 1].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        {error && <ErrorState message={error.message} onRetry={() => load(cursor)} />}
        {!loading && !error && items.length === 0 && <p className="text-sm text-stone-500">No comments yet. Be the first to add one.</p>}
        {hasMore && !loading && <button className="btn-secondary" onClick={() => load(cursor)}>Load more comments</button>}
      </div>

      <EditKeyDialog open={newKey !== null} editKey={newKey?.key ?? ''} kind="comment" savedLocally={newKey?.saved ?? false} onDone={() => { setNewKey(null); toast('info', 'Your comment is awaiting review.'); }} />
      <ConfirmDialog open={toDelete !== null} title="Delete comment?" message="This permanently removes your comment." confirmLabel="Delete" danger busy={busy} onConfirm={confirmDelete} onClose={() => setToDelete(null)} />
    </section>
  );
}

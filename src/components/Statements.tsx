import { AnimatePresence, motion } from 'framer-motion';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { spring, Stagger, StaggerItem } from '../lib/motion';
import { storage } from '../lib/storage';
import type { ImageDto, OwnerComment, PublicComment } from '../lib/types';
import { timeAgo } from '../lib/util';
import { EditKeyDialog } from './EditKeyDialog';
import { Icon } from './Icon';
import { ImagePicker, MAX_COMMENT_IMAGES } from './ImagePicker';
import { Lightbox } from './Lightbox';
import { ConfirmDialog, ErrorState, FieldError, haptic, Skeleton, Spinner, StatusBadge, useToast } from './ui';

function Exhibits({ images, onOpen }: { images: ImageDto[]; onOpen: (i: number) => void }) {
  if (!images.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {images.map((img, i) => (
        <motion.button key={img.id} whileHover={{ y: -2 }} whileTap={{ scale: 0.94 }} transition={spring} onClick={() => onOpen(i)} className="relative h-20 w-20 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-sm" aria-label={`Open exhibit ${String.fromCharCode(65 + i)}`}>
          <img src={img.thumb} alt="" crossOrigin="anonymous" loading="lazy" className="h-full w-full rounded-lg object-cover" />
          <span className="absolute bottom-1.5 left-1.5 rounded bg-ink/80 px-1 font-mono text-[0.55rem] font-bold text-white">{String.fromCharCode(65 + i)}</span>
        </motion.button>
      ))}
    </div>
  );
}

/**
 * Statements on a case: public (approved) ones, plus the visitor's own — recovered from this device's
 * localStorage. Each statement has its own independent key and may carry up to two photo exhibits.
 */
export function Statements({ postId }: { postId: string }) {
  const toast = useToast();
  const [items, setItems] = useState<PublicComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const [mine, setMine] = useState<OwnerComment[]>([]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [fieldErr, setFieldErr] = useState<string[]>();
  const [newKey, setNewKey] = useState<{ key: string; saved: boolean } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editRemoved, setEditRemoved] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<OwnerComment | null>(null);
  const [viewer, setViewer] = useState<{ images: ImageDto[]; index: number } | null>(null);

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
      const fd = new FormData();
      fd.append('content', text);
      files.forEach((f) => fd.append('images', f));
      const { comment, editKey } = await api.createComment(postId, fd);
      const saved = storage.saveCommentKey(postId, comment.id, editKey);
      setText('');
      setFiles([]);
      setResetKey((k) => k + 1);
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
      const fd = new FormData();
      if (editText !== c.content) fd.append('content', editText);
      editRemoved.forEach((id) => fd.append('removeImageIds', id));
      await api.updateComment(c.id, key, fd);
      toast('success', 'Statement updated. It will be reviewed again before it appears.');
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
      toast('success', 'Statement withdrawn.');
      setToDelete(null);
      await Promise.all([loadMine(), load()]);
    } catch (err) {
      toast('error', (err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="statements-h" className="mt-10">
      <div className="mb-4 flex items-end justify-between">
        <h2 id="statements-h" className="font-display text-2xl font-bold">Statements</h2>
        <span className="font-mono text-xs font-bold tracking-[0.14em] text-[#9b7621] uppercase">{items.length}{hasMore ? '+' : ''} on file</span>
      </div>

      <form onSubmit={submit} className="card p-4 sm:p-5">
        <label htmlFor="statement" className="label">Add a statement</label>
        <textarea id="statement" className="input min-h-24" maxLength={2000} required minLength={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you know about this case? Attach a photo as an exhibit if you have one. No personal details." />
        <FieldError messages={fieldErr} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <ImagePicker compact slots={MAX_COMMENT_IMAGES} onChange={setFiles} onError={(m) => toast('error', m)} resetKey={resetKey} />
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-soft">{text.length}/2000</span>
            <motion.button whileTap={{ scale: 0.95 }} transition={spring} className="btn-navy" disabled={busy || text.trim().length < 2}>
              {busy ? <Spinner /> : <Icon name="file" size={17} />} File statement
            </motion.button>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-soft"><Icon name="lock" size={13} /> Anonymous. Reviewed by a moderator before it appears.</p>
      </form>

      <AnimatePresence initial={false}>
        {mine.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-6 space-y-3 overflow-hidden">
            <h3 className="font-mono text-xs font-bold tracking-[0.14em] text-ink-soft uppercase">Your statements on this device</h3>
            {mine.map((c) => (
              <motion.div layout key={c.id} className="card border-dashed p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <StatusBadge status={c.status} />
                  <span className="text-xs text-ink-soft">{timeAgo(c.createdAt)}</span>
                </div>
                {editing === c.id ? (
                  <div className="space-y-3">
                    <textarea className="input min-h-20" value={editText} maxLength={2000} onChange={(e) => setEditText(e.target.value)} aria-label="Edit statement" />
                    {c.images.filter((i) => !editRemoved.includes(i.id)).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {c.images.filter((i) => !editRemoved.includes(i.id)).map((img) => (
                          <div key={img.id} className="relative h-16 w-16 overflow-hidden rounded-xl border border-stone-200">
                            <img src={img.thumb} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />
                            <button type="button" onClick={() => setEditRemoved((r) => [...r, img.id])} aria-label="Remove exhibit" className="absolute top-0.5 right-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink/80 text-white"><Icon name="x" size={11} strokeWidth={2.6} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
                      <button className="btn-navy" disabled={busy || editText.trim().length < 2} onClick={() => saveEdit(c)}>Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="prose-plain text-sm">{c.content}</p>
                    <Exhibits images={c.images} onOpen={(i) => setViewer({ images: c.images, index: i })} />
                    {c.status === 'REJECTED' && c.rejectionReason && <p className="mt-2 text-xs text-red-600">Reason: {c.rejectionReason}</p>}
                    <div className="mt-3 flex gap-1">
                      <button className="btn-ghost !min-h-9 !px-3 !text-xs" onClick={() => { setEditing(c.id); setEditText(c.content); setEditRemoved([]); }}><Icon name="edit" size={15} /> Edit</button>
                      <button className="btn-ghost !min-h-9 !px-3 !text-xs !text-red-600" onClick={() => { haptic(8); setToDelete(c); }}><Icon name="trash" size={15} /> Withdraw</button>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8">
        {items.length > 0 && (
          <Stagger inView className="relative space-y-4 border-l-2 border-folder-deep/70 pl-5">
            {items.map((c, i) => (
              <StaggerItem key={c.id}>
                <article className="relative">
                  <span className="absolute top-1.5 -left-[1.72rem] h-3 w-3 rounded-full border-2 border-folder-deep bg-paper" aria-hidden="true" />
                  <p className="font-mono text-[0.68rem] font-bold tracking-[0.14em] text-[#9b7621] uppercase">Statement {i + 1} · {timeAgo(c.createdAt)}</p>
                  <p className="prose-plain mt-1 text-[0.95rem]">{c.content}</p>
                  <Exhibits images={c.images} onOpen={(idx) => setViewer({ images: c.images, index: idx })} />
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        )}
        {loading && <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}
        {error && <ErrorState message={error.message} onRetry={() => load(cursor)} />}
        {!loading && !error && items.length === 0 && <p className="text-sm text-ink-soft">No statements on file yet. Add the first one.</p>}
        {hasMore && !loading && <button className="btn-secondary mt-5" onClick={() => load(cursor)}>Load more statements</button>}
      </div>

      <EditKeyDialog open={newKey !== null} editKey={newKey?.key ?? ''} kind="statement" savedLocally={newKey?.saved ?? false} onDone={() => { setNewKey(null); toast('info', 'Your statement is under review.'); }} />
      <ConfirmDialog open={toDelete !== null} title="Withdraw statement?" message="This permanently removes your statement and its photos." confirmLabel="Withdraw" danger busy={busy} onConfirm={confirmDelete} onClose={() => setToDelete(null)} />
      <Lightbox images={viewer?.images ?? []} index={viewer ? viewer.index : null} onIndex={(i) => setViewer((v) => (v ? { ...v, index: i } : v))} onClose={() => setViewer(null)} />
    </section>
  );
}


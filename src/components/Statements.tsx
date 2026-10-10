import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Stagger, StaggerItem } from '../lib/motion';
import { storage } from '../lib/storage';
import { MAX_COMMENT_FILES, viewerItems, ViewerItem } from '../lib/files';
import { haptics } from '../lib/haptics';
import { useT } from '../lib/i18n';
import type { FileDto, ImageDto, OwnerComment, PublicComment } from '../lib/types';
import { timeAgo } from '../lib/util';
import { EditKeyDialog } from './EditKeyDialog';
import { PrivacyTip } from './PrivacyTip';
import { Icon } from './Icon';
import { FilePicker, FileRow } from './FilePicker';
import { ImagePicker, MAX_COMMENT_IMAGES } from './ImagePicker';
import { Viewer } from './Viewer';
import { ConfirmDialog, Dialog, ErrorState, FieldError, haptic, Skeleton, Spinner, StatusBadge, useToast } from './ui';

function Exhibits({ images, files, onOpen }: { images: ImageDto[]; files: FileDto[]; onOpen: (i: number) => void }) {
  const t = useT();
  if (!images.length && !files.length) return null;
  return (
    <div className="mt-3 space-y-2">
    <div className="flex flex-wrap gap-2">
      {images.map((img, i) => (
        <button key={img.id} onClick={() => onOpen(i)} className="relative h-20 w-20 overflow-hidden rounded-xl border border-black/10 bg-white p-1 transition-transform duration-100 active:scale-95" aria-label={t('Open exhibit {x}', { x: String.fromCharCode(65 + i) })}>
          <img src={img.thumb} alt="" crossOrigin="anonymous" loading="lazy" className="h-full w-full rounded-lg object-cover" />
          <span className="absolute bottom-1.5 left-1.5 rounded bg-ink/85 px-1 font-mono text-[0.55rem] text-white">{String.fromCharCode(65 + i)}</span>
        </button>
      ))}
    </div>
      {files.map((f, j) => <FileRow key={f.id} file={f} onOpen={() => onOpen(images.length + j)} />)}
    </div>
  );
}

/**
 * Statements on a case. They are published immediately. Anyone can report one; after 10 reports it is hidden and an
 * admin decides. Each statement has its own independent key and may carry up to two photo exhibits.
 */
export function Statements({ postId, composerOpen, setComposerOpen }: { postId: string; composerOpen: boolean; setComposerOpen: (v: boolean) => void }) {
  const toast = useToast();
  const t = useT();
  const [items, setItems] = useState<PublicComment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const [mine, setMine] = useState<OwnerComment[]>([]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [docs, setDocs] = useState<File[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [fieldErr, setFieldErr] = useState<string[]>();
  const [newKey, setNewKey] = useState<{ key: string; saved: boolean; id: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editRemoved, setEditRemoved] = useState<string[]>([]);
  const [editRemovedFiles, setEditRemovedFiles] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<OwnerComment | null>(null);
  const [toReport, setToReport] = useState<PublicComment | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [viewer, setViewer] = useState<{ items: ViewerItem[]; index: number } | null>(null);

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
    if (navigator.onLine === false) return toast('error', t('You are offline. Try again when you are back online.'));
    setBusy(true);
    setProgress(null);
    setFieldErr(undefined);
    try {
      const fd = new FormData();
      fd.append('content', text);
      files.forEach((f) => fd.append('images', f));
      docs.forEach((f) => fd.append('files', f));
      const { comment, editKey } = await api.createComment(postId, fd, setProgress);
      const saved = storage.saveCommentKey(postId, comment.id, editKey);
      setText('');
      setFiles([]);
      setDocs([]);
      haptics.success();
      setResetKey((k) => k + 1);
      setComposerOpen(false);
      setNewKey({ key: editKey, saved, id: comment.id });
      await Promise.all([loadMine(), load()]);
    } catch (err) {
      const ae = err as ApiError;
      if (ae.fields.content) setFieldErr(ae.fields.content);
      else toast('error', ae.message);
    } finally {
      setBusy(false);
      setProgress(null);
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
      editRemovedFiles.forEach((id) => fd.append('removeFileIds', id));
      await api.updateComment(c.id, key, fd);
      toast('success', t('Statement updated.'));
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
      toast('success', t('Statement withdrawn.'));
      setToDelete(null);
      await Promise.all([loadMine(), load()]);
    } catch (err) {
      toast('error', (err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmReport = async () => {
    if (!toReport) return;
    const id = toReport.id;
    setBusy(true);
    try {
      const r = await api.reportComment(id);
      storage.markReported(id);
      setReported((s) => new Set(s).add(id));
      toast('success', r.hidden ? t('Thanks, this statement was hidden and sent to a moderator.') : t('Thanks, your report was recorded.'));
      setToReport(null);
      if (r.hidden) await load();
    } catch (err) {
      toast('error', (err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const hiddenMine = mine.filter((c) => c.status !== 'APPROVED');

  return (
    <section aria-labelledby="statements-h" className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 id="statements-h" className="font-display text-2xl font-bold">{t('Statements')}</h2>
        <span className="font-mono text-xs tracking-[0.12em] text-[#9b7621] uppercase">{t('{n} on file', { n: `${items.length}${hasMore ? '+' : ''}` })}</span>
      </div>

      <p className="mb-3 text-sm text-ink-soft">{t('Discuss the facts and say what punishment would be fair. Stay respectful: no names of private people and no calls for violence.')}</p>
      <button className="btn-secondary mb-5 w-full !justify-start !rounded-2xl !py-3.5" onClick={() => setComposerOpen(true)}>
        <Icon name="chat" size={20} /> <span className="text-ink-soft">{t('Add your statement…')}</span>
      </button>

      {hiddenMine.length > 0 && (
        <div className="mb-6 space-y-3">
          {hiddenMine.map((c) => (
            <div key={c.id} className="card border-dashed p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <StatusBadge status={c.status} />
                <span className="text-xs text-ink-soft">{t('Your statement was reported and is hidden for review')}</span>
              </div>
              <p className="prose-plain text-sm">{c.content}</p>
              {c.rejectionReason && <p className="mt-2 text-xs text-red-600">{t('Reason: {reason}', { reason: c.rejectionReason })}</p>}
            </div>
          ))}
        </div>
      )}

      {mine.filter((c) => c.status === 'APPROVED').length > 0 && (
        <div className="mb-6 space-y-3">
          <h3 className="font-mono text-xs tracking-[0.12em] text-ink-soft uppercase">{t('Your statements on this device')}</h3>
          {mine.filter((c) => c.status === 'APPROVED').map((c) => (
            <div key={c.id} className="card border-l-[5px] border-l-brand-300 p-4">
              {editing === c.id ? (
                <div className="space-y-3">
                  <textarea className="input min-h-24" value={editText} maxLength={2000} onChange={(e) => setEditText(e.target.value)} aria-label={t('Edit statement')} />
                  {c.images.filter((i) => !editRemoved.includes(i.id)).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {c.images.filter((i) => !editRemoved.includes(i.id)).map((img) => (
                        <div key={img.id} className="relative h-16 w-16 overflow-hidden rounded-xl border border-black/10">
                          <img src={img.thumb} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />
                          <button type="button" onClick={() => setEditRemoved((r) => [...r, img.id])} aria-label={t('Remove exhibit')} className="absolute top-0.5 right-0.5 grid h-6 w-6 place-items-center rounded-full bg-ink/85 text-white"><Icon name="x" size={12} strokeWidth={2.8} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {c.files.filter((d) => !editRemovedFiles.includes(d.id)).map((d) => <FileRow key={d.id} file={d} onRemove={() => setEditRemovedFiles((r) => [...r, d.id])} />)}
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn-secondary" onClick={() => setEditing(null)}>{t('Cancel')}</button>
                    <button className="btn-primary" disabled={busy || editText.trim().length < 2} onClick={() => saveEdit(c)}>{t('Save')}</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="prose-plain text-sm">{c.content}</p>
                  <Exhibits images={c.images} files={c.files} onOpen={(i) => setViewer({ items: viewerItems(c.images, c.files), index: i })} />
                  <div className="mt-3 flex gap-2">
                    <button className="btn-secondary !min-h-10 !px-3.5 !text-[0.82rem]" onClick={() => { setEditing(c.id); setEditText(c.content); setEditRemoved([]); setEditRemovedFiles([]); }}><Icon name="edit" size={16} /> {t('Edit')}</button>
                    <button className="btn-ghost !min-h-10 !px-3.5 !text-[0.82rem] !text-red-600" onClick={() => { haptic(8); setToDelete(c); }}><Icon name="trash" size={16} /> {t('Withdraw')}</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <Stagger className="relative space-y-5 border-l-2 border-folder-deep/80 pl-5">
          {items.map((c) => {
            const isMine = Boolean(storage.getCommentKey(c.id));
            const done = reported.has(c.id) || storage.hasReported(c.id);
            return (
              <StaggerItem key={c.id}>
                <article className="relative">
                  <span className="absolute top-1.5 -left-[1.72rem] h-3 w-3 rounded-full border-2 border-folder-deep bg-paper" aria-hidden="true" />
                  <p className="font-mono text-[0.7rem] tracking-[0.12em] text-[#9b7621] uppercase">{t('Statement')} · {timeAgo(c.createdAt)}{c.origin === 'AI' ? ' · DL-ai' : c.origin === 'STAFF' ? ` · ${t('Moderation team')}` : ''}</p>
                  <p className="prose-plain mt-1 text-[0.95rem]">{c.content}</p>
                  <Exhibits images={c.images} files={c.files} onOpen={(idx) => setViewer({ items: viewerItems(c.images, c.files), index: idx })} />
                  {!isMine && (
                    <button className="btn-ghost mt-2 !min-h-9 !rounded-lg !px-2.5 !text-xs" disabled={done} onClick={() => setToReport(c)}>
                      <Icon name="flag" size={15} /> {done ? t('Reported') : t('Report')}
                    </button>
                  )}
                </article>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
      {loading && <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}
      {error && <ErrorState message={error.message} onRetry={() => load(cursor)} />}
      {!loading && !error && items.length === 0 && <p className="text-sm text-ink-soft">{t('No statements on file yet. Add the first one.')}</p>}
      {hasMore && !loading && (
        <button className="chrome mx-auto mt-5 flex min-h-11 items-center gap-1 px-3 text-xs font-bold text-brand-700 underline underline-offset-4" onClick={() => load(cursor)}>
          {t('Load 5 more')}
        </button>
      )}

      <Dialog open={composerOpen} onClose={() => !busy && setComposerOpen(false)} title={t('Add a statement')}>
        <form onSubmit={submit} className="space-y-4">
          <PrivacyTip />
          <div>
            <label htmlFor="statement" className="label">{t('Your statement')}</label>
            <textarea id="statement" className="input min-h-32" maxLength={2000} required minLength={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('What do you know about this case? No personal details.')} />
            <FieldError messages={fieldErr} />
            <p className="mt-1 text-right text-xs text-ink-soft">{text.length}/2000</p>
          </div>
          <div className="space-y-2.5">
            <ImagePicker compact slots={MAX_COMMENT_IMAGES} onChange={setFiles} onError={(m) => toast('error', m)} resetKey={resetKey} />
            <FilePicker compact slots={MAX_COMMENT_FILES} onChange={setDocs} onError={(m) => toast('error', m)} resetKey={resetKey} />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-ink-soft"><Icon name="lock" size={13} /> {t('Anonymous. Published immediately; anyone can report it.')}</p>
          <button className="btn-primary w-full" disabled={busy || text.trim().length < 2}>
            {busy ? <Spinner /> : <Icon name="file" size={19} />}
            {busy ? (progress != null && progress < 100 && (files.length || docs.length) ? t('Uploading {n}%', { n: progress }) : t('Filing…')) : t('File statement')}
          </button>
        </form>
      </Dialog>

      <EditKeyDialog open={newKey !== null} editKey={newKey?.key ?? ''} kind="statement" refId={newKey?.id ?? ''} postId={postId} savedLocally={newKey?.saved ?? false} onDone={() => { setNewKey(null); toast('success', t('Your statement is on file.')); }} />
      <ConfirmDialog open={toDelete !== null} title={t('Withdraw statement?')} message={t('This permanently removes your statement, its photos and documents.')} confirmLabel={t('Withdraw')} danger busy={busy} onConfirm={confirmDelete} onClose={() => setToDelete(null)} />
      <ConfirmDialog open={toReport !== null} title={t('Report this statement?')} message={t('Use this for abuse, private personal details, threats or false claims. After 10 reports a statement is hidden and a moderator reviews it.')} confirmLabel={t('Report')} danger busy={busy} onConfirm={confirmReport} onClose={() => setToReport(null)} />
      <Viewer items={viewer?.items ?? []} index={viewer ? viewer.index : null} onIndex={(i) => setViewer((v) => (v ? { ...v, index: i } : v))} onClose={() => setViewer(null)} />
    </section>
  );
}

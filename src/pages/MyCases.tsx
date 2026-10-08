import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CaseTracker } from '../components/CaseTracker';
import { Icon } from '../components/Icon';
import { EmptyState, Skeleton, Spinner, StatusBadge, useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { Stagger, StaggerItem } from '../lib/motion';
import { storage } from '../lib/storage';
import type { OwnerComment, OwnerPost } from '../lib/types';
import { caseNo, formatDate, timeAgo, usePageMeta } from '../lib/util';

type Row = { id: string; post?: OwnerPost; problem?: string };

export default function MyCases() {
  usePageMeta({ title: 'My cases', description: 'Cases and statements saved on this device.', noindex: true });
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [statements, setStatements] = useState<OwnerComment[] | null>(null);
  const [importId, setImportId] = useState('');
  const [importKey, setImportKey] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const ids = storage.listPostIds();
    const result = await Promise.all(
      ids.map(async (id): Promise<Row> => {
        const key = storage.getPostKey(id);
        if (!key) return { id, problem: 'The key for this case is missing on this device.' };
        try {
          return { id, post: await api.getOwnerPost(id, key) };
        } catch (e) {
          const err = e as ApiError;
          if (err.status === 404) return { id, problem: 'This case no longer exists.' };
          if (err.code === 'EDIT_KEY_EXPIRED') return { id, problem: 'The edit window for this case has expired.' };
          if (err.code === 'INVALID_EDIT_KEY') return { id, problem: 'The saved key is not valid for this case.' };
          return { id, problem: err.message };
        }
      }),
    );
    setRows(result);

    const sts = await Promise.all(
      storage.listAllComments().slice(0, 20).map(async ({ postId, commentId }) => {
        const key = storage.getCommentKey(commentId);
        if (!key) return null;
        try {
          return await api.getOwnerComment(commentId, key);
        } catch (e) {
          if (e instanceof ApiError && (e.status === 404 || e.code === 'INVALID_EDIT_KEY')) storage.removeComment(postId, commentId);
          return null;
        }
      }),
    );
    setStatements(sts.filter((c): c is OwnerComment => c !== null));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addExisting = async (e: FormEvent) => {
    e.preventDefault();
    const id = importId.trim().split('/').pop()?.toLowerCase() ?? '';
    setBusy(true);
    try {
      await api.getOwnerPost(id, importKey.trim());
      storage.savePostKey(id, importKey.trim());
      setImportId('');
      setImportKey('');
      toast('success', 'Case added to this device.');
      await load();
    } catch (err) {
      toast('error', (err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">My cases</h1>
      <p className="mt-1.5 text-sm text-ink-soft">Cases and statements filed from this device, with live progress. Their keys live only here — they cannot be recovered if you clear your browser data.</p>

      <div className="mt-6">
        {rows === null && <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full !rounded-2xl" />)}</div>}
        {rows?.length === 0 && <EmptyState icon="folders" title="No cases on this device" message="Cases you open here will show up with their review progress." action={<Link to="/open-case" className="btn-primary"><Icon name="folderPlus" size={20} /> Open a case</Link>} />}
        {rows && rows.length > 0 && (
          <Stagger className="space-y-3">
            {rows.map((r) => (
              <StaggerItem key={r.id}>
                <div className="card space-y-3.5 border-l-[5px] border-l-folder-deep p-4">
                  {r.post ? (
                    <>
                      <div className="min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-center gap-3">
                          <span className="font-mono text-[0.72rem] tracking-[0.1em] text-[#7a5a14]">{caseNo(r.id)}</span>
                          <StatusBadge status={r.post.status} />
                          <span className="text-xs text-ink-soft">Filed {formatDate(r.post.createdAt)}</span>
                        </div>
                        <h2 className="truncate font-display text-lg font-bold">{r.post.title}</h2>
                        {r.post.status === 'REJECTED' && r.post.rejectionReason && <p className="mt-1 text-xs text-red-600">Reason: {r.post.rejectionReason}</p>}
                      </div>
                      <CaseTracker status={r.post.status} />
                      <div className="grid grid-cols-2 gap-2">
                        {r.post.status === 'APPROVED' ? <Link to={`/case/${r.id}`} className="btn-secondary">View case</Link> : <span className="btn-secondary pointer-events-none opacity-50">Not public yet</span>}
                        <Link to={`/edit/${r.id}`} className="btn-primary"><Icon name="edit" size={18} /> Manage</Link>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-ink-soft">{caseNo(r.id)} — {r.problem}</p>
                      <button className="btn-secondary" onClick={() => { storage.removePost(r.id); void load(); }}>Remove from device</button>
                    </div>
                  )}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>

      {statements && statements.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-bold">My statements</h2>
          <div className="space-y-3">
            {statements.map((c) => (
              <Link key={c.id} to={`/case/${c.postId}`} className="card flex items-start gap-3 p-4 transition-transform duration-100 active:scale-[0.99]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-folder text-[#7a5a14]"><Icon name="chat" size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                    <span className="font-mono text-[0.7rem] tracking-[0.1em] text-[#7a5a14]">{caseNo(c.postId)}</span>
                    {c.status !== 'APPROVED' && <StatusBadge status={c.status} />}
                    <span>{timeAgo(c.createdAt)}</span>
                  </span>
                  <span className="line-clamp-2 block text-sm">{c.content}</span>
                  {c.status === 'PENDING' && <span className="mt-1 block text-xs text-amber-700">Hidden after reports — a moderator is reviewing it.</span>}
                </span>
                <Icon name="chevronRight" size={20} className="mt-2 shrink-0 text-stone-400" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={addExisting} className="card mt-10 space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Icon name="key" size={20} /> Track a case from another device</h2>
        <p className="text-sm text-ink-soft">Paste the case link (or its ID) and your key. It is verified, then saved only in this browser so you can follow its progress here.</p>
        <input className="input" required placeholder="Case link or ID" value={importId} onChange={(e) => setImportId(e.target.value)} autoComplete="off" autoCapitalize="none" />
        <input className="input font-code" required placeholder="Case key" value={importKey} onChange={(e) => setImportKey(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} />
        <button className="btn-primary" disabled={busy}>{busy && <Spinner />} Track case</button>
      </form>
    </div>
  );
}

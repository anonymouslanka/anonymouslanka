import { FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CaseForm } from '../components/CaseForm';
import { CaseTracker } from '../components/CaseTracker';
import { Icon } from '../components/Icon';
import { ConfirmDialog, EmptyState, ErrorState, Skeleton, StatusBadge, useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { storage } from '../lib/storage';
import { caseNo, formatDate, usePageMeta } from '../lib/util';

export default function EditCase() {
  const { id = '' } = useParams();
  usePageMeta({ title: 'Update case file', noindex: true });
  const navigate = useNavigate();
  const toast = useToast();
  const [key, setKey] = useState<string | null>(() => storage.getPostKey(id));
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: post, error, loading, reload, setData } = useAsync(async () => (key ? api.getOwnerPost(id, key) : null), [id, key]);

  if (!key) {
    const useKey = (e: FormEvent) => {
      e.preventDefault();
      setKey(keyInput.trim());
    };
    return (
      <div className="mx-auto max-w-md">
        <form onSubmit={useKey} className="card space-y-4 p-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-folder text-[#7a5a14]"><Icon name="key" size={24} /></span>
          <h1 className="font-display text-2xl font-bold">Enter your case key</h1>
          <p className="text-sm text-ink-soft">This device doesn’t have the key for this case. Paste the key you saved when you opened it.</p>
          <input className="input font-code" required value={keyInput} onChange={(e) => setKeyInput(e.target.value)} aria-label="Case key" autoComplete="off" autoCapitalize="none" spellCheck={false} />
          <button className="btn-primary w-full">Continue</button>
        </form>
      </div>
    );
  }

  if (loading) return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64 w-full !rounded-2xl" /></div>;

  if (error || !post) {
    const forgotten = error?.code === 'INVALID_EDIT_KEY' || error?.code === 'EDIT_KEY_EXPIRED' || error?.status === 404;
    return (
      <div className="mx-auto max-w-xl">
        {forgotten ? (
          <EmptyState
            icon="key"
            title={error?.code === 'EDIT_KEY_EXPIRED' ? 'Edit window expired' : error?.status === 404 ? 'This case no longer exists' : 'That key doesn’t work'}
            message={error?.message}
            action={
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => { storage.removePost(id); setKey(null); }}>Forget this key</button>
                <Link to="/my-cases" className="btn-primary">My cases</Link>
              </div>
            }
          />
        ) : (
          <ErrorState message={error?.message ?? 'Could not load your case.'} onRetry={reload} />
        )}
      </div>
    );
  }

  const save = async (form: FormData) => {
    setBusy(true);
    setSaveError(null);
    try {
      const updated = await api.updatePost(id, key, form);
      storage.savePostKey(id, key);
      setData(updated);
      toast('success', 'Case file updated. It will be reviewed again before it is public.');
      navigate('/my-cases');
    } catch (e) {
      const err = e as ApiError;
      setSaveError(err);
      toast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.deletePost(id, key);
      storage.removePost(id);
      toast('success', 'Your case was withdrawn.');
      navigate('/my-cases');
    } catch (e) {
      toast('error', (e as ApiError).message);
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/my-cases" className="chrome mb-3 hidden items-center gap-1 py-1 text-sm font-bold text-ink-soft lg:inline-flex"><Icon name="chevronLeft" size={18} /> My cases</Link>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">Update case file</h1>
        <StatusBadge status={post.status} />
      </div>
      <p className="font-mono text-xs font-bold tracking-[0.14em] text-[#9b7621] uppercase">{caseNo(post.id)} · filed {formatDate(post.createdAt)} · key valid until {formatDate(post.editExpiresAt)}</p>

      <div className="mt-4"><CaseTracker status={post.status} /></div>
      {post.status === 'REJECTED' && post.rejectionReason && (
        <p role="note" className="mt-4 flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900"><Icon name="alert" size={18} className="mt-0.5 shrink-0" /> <span><strong>Moderator note:</strong> {post.rejectionReason}</span></p>
      )}
      <p className="mt-4 mb-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900"><Icon name="info" size={18} className="mt-0.5 shrink-0" /> Any change sends your case back to moderation, and it stays hidden from the public until cleared again.</p>

      <CaseForm initial={post} busy={busy} progress={progress} error={saveError} submitLabel="Save changes" onSubmit={save} />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-white p-5">
        <div>
          <h2 className="font-bold">Withdraw this case</h2>
          <p className="text-sm text-ink-soft">Permanently removes the case, its exhibits and all statements.</p>
        </div>
        <button className="btn-danger" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={17} /> Withdraw</button>
      </div>

      <ConfirmDialog open={confirmDelete} title="Withdraw this case?" message="This cannot be undone. The case, its exhibits and all statements will be removed." confirmLabel="Withdraw case" danger busy={busy} onConfirm={remove} onClose={() => setConfirmDelete(false)} />
    </div>
  );
}

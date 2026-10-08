import { FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PostForm } from '../components/PostForm';
import { ConfirmDialog, EmptyState, ErrorState, Skeleton, StatusBadge, useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { storage } from '../lib/storage';
import { formatDate, usePageMeta } from '../lib/util';

export default function EditPost() {
  const { id = '' } = useParams();
  usePageMeta({ title: 'Edit your report', noindex: true });
  const navigate = useNavigate();
  const toast = useToast();
  const [key, setKey] = useState<string | null>(() => storage.getPostKey(id));
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
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
          <h1 className="font-display text-2xl font-bold">Enter your edit key</h1>
          <p className="text-sm text-stone-600">This device doesn’t have the key for this post. Paste the key you saved when you submitted it.</p>
          <input className="input font-mono text-xs" required value={keyInput} onChange={(e) => setKeyInput(e.target.value)} aria-label="Edit key" autoComplete="off" spellCheck={false} />
          <button className="btn-primary w-full">Continue</button>
        </form>
      </div>
    );
  }

  if (loading) return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-64 w-full" /></div>;

  if (error || !post) {
    const forgotten = error?.code === 'INVALID_EDIT_KEY' || error?.code === 'EDIT_KEY_EXPIRED' || error?.status === 404;
    return (
      <div className="mx-auto max-w-xl">
        {forgotten ? (
          <EmptyState
            title={error?.code === 'EDIT_KEY_EXPIRED' ? 'Edit window expired' : error?.status === 404 ? 'This post no longer exists' : 'That edit key doesn’t work'}
            message={error?.message}
            action={
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => { storage.removePost(id); setKey(null); }}>Forget this key</button>
                <Link to="/my-posts" className="btn-primary">My posts</Link>
              </div>
            }
          />
        ) : (
          <ErrorState message={error?.message ?? 'Could not load your post.'} onRetry={reload} />
        )}
      </div>
    );
  }

  const save = async (form: FormData) => {
    setBusy(true);
    setSaveError(null);
    try {
      const updated = await api.updatePost(id, key, form);
      storage.savePostKey(id, key); // ensure the key is remembered on this device
      setData(updated);
      toast('success', 'Saved. Your post will be reviewed again before it is public.');
      navigate('/my-posts');
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
      toast('success', 'Your post was deleted.');
      navigate('/my-posts');
    } catch (e) {
      toast('error', (e as ApiError).message);
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">Edit your report</h1>
        <StatusBadge status={post.status} />
      </div>
      <p className="text-sm text-stone-500">Submitted {formatDate(post.createdAt, true)} · edit key valid until {formatDate(post.editExpiresAt)}</p>
      {post.status === 'REJECTED' && post.rejectionReason && (
        <p role="note" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <strong>Moderator note:</strong> {post.rejectionReason}
        </p>
      )}
      <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        Any change sends your post back to moderation, and it will be hidden from the public until approved again.
      </p>

      <div className="card mt-6 p-5 sm:p-7">
        <PostForm initial={post} busy={busy} error={saveError} submitLabel="Save changes" onSubmit={save} />
      </div>

      <div className="mt-8 flex items-center justify-between rounded-2xl border border-red-200 p-5">
        <div>
          <h2 className="font-semibold">Delete this post</h2>
          <p className="text-sm text-stone-500">Permanently removes the post, its images and comments.</p>
        </div>
        <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
      </div>

      <ConfirmDialog open={confirmDelete} title="Delete this post?" message="This cannot be undone. The post, its images and all comments will be removed." confirmLabel="Delete post" danger busy={busy} onConfirm={remove} onClose={() => setConfirmDelete(false)} />
    </div>
  );
}

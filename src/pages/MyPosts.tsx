import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, Skeleton, StatusBadge, useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { storage } from '../lib/storage';
import type { OwnerPost } from '../lib/types';
import { formatDate, usePageMeta } from '../lib/util';

type Row = { id: string; post?: OwnerPost; problem?: string };

export default function MyPosts() {
  usePageMeta({ title: 'My posts', description: 'Posts saved on this device.', noindex: true });
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [importId, setImportId] = useState('');
  const [importKey, setImportKey] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const ids = storage.listPostIds();
    const result = await Promise.all(
      ids.map(async (id): Promise<Row> => {
        const key = storage.getPostKey(id);
        if (!key) return { id, problem: 'The key for this post is missing on this device.' };
        try {
          return { id, post: await api.getOwnerPost(id, key) };
        } catch (e) {
          const err = e as ApiError;
          if (err.status === 404) return { id, problem: 'This post no longer exists.' };
          if (err.code === 'EDIT_KEY_EXPIRED') return { id, problem: 'The edit window for this post has expired.' };
          if (err.code === 'INVALID_EDIT_KEY') return { id, problem: 'The saved key is not valid for this post.' };
          return { id, problem: err.message };
        }
      }),
    );
    setRows(result);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addExisting = async (e: FormEvent) => {
    e.preventDefault();
    const id = importId.trim().split('/').pop()?.toLowerCase() ?? '';
    setBusy(true);
    try {
      await api.getOwnerPost(id, importKey.trim()); // verify before saving
      storage.savePostKey(id, importKey.trim());
      setImportId('');
      setImportKey('');
      toast('success', 'Post added to this device.');
      await load();
    } catch (err) {
      toast('error', (err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-bold">My posts</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">
        These posts were created from this browser. Their edit keys live only on this device — we cannot recover them if you clear your browser data.
      </p>

      <div className="mt-8 space-y-3">
        {rows === null && [0, 1].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        {rows?.length === 0 && <EmptyState title="Nothing here yet" message="Posts you submit from this device will show up here, along with their review status." action={<Link to="/new" className="btn-primary">Share a report</Link>} />}
        {rows?.map((r) => (
          <div key={r.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            {r.post ? (
              <>
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2"><StatusBadge status={r.post.status} /><span className="text-xs text-stone-500">{formatDate(r.post.createdAt)}</span></div>
                  <h2 className="truncate font-semibold">{r.post.title}</h2>
                  {r.post.status === 'REJECTED' && r.post.rejectionReason && <p className="text-xs text-red-600">Reason: {r.post.rejectionReason}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {r.post.status === 'APPROVED' && <Link to={`/post/${r.id}`} className="btn-secondary">View</Link>}
                  <Link to={`/edit/${r.id}`} className="btn-primary">Edit</Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-stone-600 dark:text-stone-400">{r.problem}</p>
                <button className="btn-secondary shrink-0" onClick={() => { storage.removePost(r.id); void load(); }}>Remove from device</button>
              </>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={addExisting} className="card mt-10 space-y-3 p-5">
        <h2 className="font-semibold">Add a post from another device</h2>
        <p className="text-sm text-stone-500">Paste the post link (or its ID) and your edit key. The key is verified and then saved only in this browser.</p>
        <input className="input" required placeholder="Post link or ID" value={importId} onChange={(e) => setImportId(e.target.value)} autoComplete="off" />
        <input className="input font-mono text-xs" required placeholder="Edit key" value={importKey} onChange={(e) => setImportKey(e.target.value)} autoComplete="off" spellCheck={false} />
        <button className="btn-secondary" disabled={busy}>Add post</button>
      </form>
    </div>
  );
}

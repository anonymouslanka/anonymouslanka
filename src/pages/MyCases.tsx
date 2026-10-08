import { motion } from 'framer-motion';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { EmptyState, Skeleton, Spinner, StatusBadge, useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { spring, Stagger, StaggerItem } from '../lib/motion';
import { storage } from '../lib/storage';
import type { OwnerPost } from '../lib/types';
import { caseNo, formatDate, usePageMeta } from '../lib/util';

type Row = { id: string; post?: OwnerPost; problem?: string };

export default function MyCases() {
  usePageMeta({ title: 'My cases', description: 'Cases saved on this device.', noindex: true });
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
      <p className="mt-1.5 text-sm text-ink-soft">Cases opened from this device. Their keys live only here — they cannot be recovered if you clear your browser data.</p>

      <div className="mt-6">
        {rows === null && <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-24 w-full !rounded-2xl" />)}</div>}
        {rows?.length === 0 && <EmptyState icon="folders" title="No cases on this device" message="Cases you open here will show up with their review status." action={<Link to="/open-case" className="btn-primary"><Icon name="folderPlus" size={18} /> Open a case</Link>} />}
        {rows && rows.length > 0 && (
          <Stagger className="space-y-3">
            {rows.map((r) => (
              <StaggerItem key={r.id}>
                <div className="card flex flex-col gap-3 border-l-[5px] border-l-folder-deep p-4 sm:flex-row sm:items-center sm:justify-between">
                  {r.post ? (
                    <>
                      <div className="min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-center gap-3">
                          <span className="font-mono text-[0.68rem] font-bold tracking-[0.12em] text-[#7a5a14]">{caseNo(r.id)}</span>
                          <StatusBadge status={r.post.status} />
                          <span className="text-xs text-ink-soft">{formatDate(r.post.createdAt)}</span>
                        </div>
                        <h2 className="truncate font-display text-lg font-bold">{r.post.title}</h2>
                        {r.post.status === 'REJECTED' && r.post.rejectionReason && <p className="mt-1 text-xs text-red-600">Reason: {r.post.rejectionReason}</p>}
                        {r.post.status === 'PENDING' && <p className="mt-1 text-xs text-ink-soft">Waiting for a moderator to clear this case file.</p>}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {r.post.status === 'APPROVED' && <Link to={`/case/${r.id}`} className="btn-secondary">View</Link>}
                        <Link to={`/edit/${r.id}`} className="btn-navy"><Icon name="edit" size={16} /> Manage</Link>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-ink-soft">{caseNo(r.id)} — {r.problem}</p>
                      <button className="btn-secondary shrink-0" onClick={() => { storage.removePost(r.id); void load(); }}>Remove from device</button>
                    </>
                  )}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </div>

      <motion.form initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={spring} onSubmit={addExisting} className="card mt-10 space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Icon name="key" size={19} /> Add a case from another device</h2>
        <p className="text-sm text-ink-soft">Paste the case link (or its ID) and your key. It is verified, then saved only in this browser.</p>
        <input className="input" required placeholder="Case link or ID" value={importId} onChange={(e) => setImportId(e.target.value)} autoComplete="off" autoCapitalize="none" />
        <input className="input font-mono !text-xs" required placeholder="Case key" value={importKey} onChange={(e) => setImportKey(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} />
        <button className="btn-navy" disabled={busy}>{busy && <Spinner />} Add case</button>
      </motion.form>
    </div>
  );
}

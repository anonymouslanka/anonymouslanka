import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CaseTracker } from '../components/CaseTracker';
import { Icon } from '../components/Icon';
import { Dialog, EmptyState, Skeleton, Spinner, StatusBadge, useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useT } from '../lib/i18n';
import { Stagger, StaggerItem } from '../lib/motion';
import { KeyFileError, ParsedKeyFile, readKeyFile } from '../lib/keyfile';
import { storage } from '../lib/storage';
import type { OwnerComment, OwnerPost } from '../lib/types';
import { caseNo, formatDate, timeAgo, usePageMeta } from '../lib/util';

type Row = { id: string; post?: OwnerPost; problem?: string };

export default function MyCases() {
  usePageMeta({ title: 'My cases', description: 'Cases and statements saved on this device.', noindex: true });
  const toast = useToast();
  const t = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [statements, setStatements] = useState<OwnerComment[] | null>(null);
  const [importId, setImportId] = useState('');
  const [importKey, setImportKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ParsedKeyFile | null>(null);
  const [filePw, setFilePw] = useState('');

  const load = useCallback(async () => {
    const ids = storage.listPostIds();
    const result = await Promise.all(
      ids.map(async (id): Promise<Row> => {
        const key = storage.getPostKey(id);
        if (!key) return { id, problem: t('The key for this case is missing on this device.') };
        try {
          return { id, post: await api.getOwnerPost(id, key) };
        } catch (e) {
          const err = e as ApiError;
          if (err.status === 404) return { id, problem: t('This case no longer exists.') };
          if (err.code === 'EDIT_KEY_EXPIRED') return { id, problem: t('The edit window for this case has expired.') };
          if (err.code === 'INVALID_EDIT_KEY') return { id, problem: t('The saved key is not valid for this case.') };
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

  /** Reads an access file in the browser (it is never uploaded), unseals the key and checks it with the owner request. */
  const finishImport = async (parsed: ParsedKeyFile, password?: string) => {
    setBusy(true);
    try {
      const p = await parsed.open(password);
      if (p.kind === 'case') {
        await api.getOwnerPost(p.id, p.key);
        storage.savePostKey(p.id, p.key);
        toast('success', t('Case added to this device.'));
      } else {
        const c = await api.getOwnerComment(p.id, p.key);
        storage.saveCommentKey(c.postId, p.id, p.key);
        toast('success', t('Statement added to this device.'));
      }
      setPending(null);
      setFilePw('');
      await load();
    } catch (err) {
      if (err instanceof KeyFileError) toast('error', t(err.message));
      else toast('error', (err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = await readKeyFile(file);
      if (parsed.passwordProtected) {
        setPending(parsed);
        setFilePw('');
      } else await finishImport(parsed);
    } catch (err) {
      toast('error', err instanceof KeyFileError ? t(err.message) : t('This file could not be read.'));
    }
  };

  const addExisting = async (e: FormEvent) => {
    e.preventDefault();
    const id = importId.trim().split('/').pop()?.toLowerCase() ?? '';
    setBusy(true);
    try {
      await api.getOwnerPost(id, importKey.trim());
      storage.savePostKey(id, importKey.trim());
      setImportId('');
      setImportKey('');
      toast('success', t('Case added to this device.'));
      await load();
    } catch (err) {
      toast('error', (err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl xl:max-w-6xl">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('My cases')}</h1>
      <p className="mt-1.5 text-sm text-ink-soft">{t('Cases and statements filed from this device, with live progress. Their keys live only here, they cannot be recovered if you clear your browser data.')}</p>

      <div className="mt-6">
        {rows === null && <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28 w-full !rounded-2xl" />)}</div>}
        {rows?.length === 0 && <EmptyState icon="folders" title={t('No cases on this device')} message={t('Cases you open here will show up with their review progress.')} action={<Link to="/open-case" className="btn-primary"><Icon name="folderPlus" size={20} /> {t('Open a case')}</Link>} />}
        {rows && rows.length > 0 && (
          <Stagger className="space-y-3 xl:grid xl:grid-cols-2 xl:gap-3 xl:space-y-0">
            {rows.map((r) => (
              <StaggerItem key={r.id}>
                <div className="card space-y-3.5 border-l-[5px] border-l-folder-deep p-4">
                  {r.post ? (
                    <>
                      <div className="min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-center gap-3">
                          <span className="font-mono text-[0.72rem] tracking-[0.1em] text-[#7a5a14]">{caseNo(r.id)}</span>
                          <StatusBadge status={r.post.status} />
                          <span className="text-xs text-ink-soft">{t('Filed {date}', { date: formatDate(r.post.createdAt) })}</span>
                        </div>
                        <h2 className="truncate font-display text-lg font-bold">{r.post.title}</h2>
                        {r.post.status === 'REJECTED' && r.post.rejectionReason && <p className="mt-1 text-xs text-red-600">{t('Reason: {reason}', { reason: r.post.rejectionReason })}</p>}
                      </div>
                      <CaseTracker status={r.post.status} />
                      <div className="grid grid-cols-2 gap-2">
                        {r.post.status === 'APPROVED' ? <Link to={`/case/${r.id}`} className="btn-secondary">{t('View case')}</Link> : <span className="btn-secondary pointer-events-none opacity-50">{t('Not public yet')}</span>}
                        <Link to={`/edit/${r.id}`} className="btn-primary"><Icon name="edit" size={18} /> {t('Manage')}</Link>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-ink-soft">{caseNo(r.id)}, {r.problem}</p>
                      <button className="btn-secondary" onClick={() => { storage.removePost(r.id); void load(); }}>{t('Remove from device')}</button>
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
          <h2 className="mb-3 font-display text-xl font-bold">{t('My statements')}</h2>
          <div className="space-y-3 xl:grid xl:grid-cols-2 xl:gap-3 xl:space-y-0">
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
                  {c.status === 'PENDING' && <span className="mt-1 block text-xs text-amber-700">{t('Hidden after reports, a moderator is reviewing it.')}</span>}
                </span>
                <Icon name="chevronRight" size={20} className="mt-2 shrink-0 text-stone-400" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card mt-10 space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Icon name="key" size={20} /> {t('Use your access file on this device')}</h2>
        <p className="text-sm text-ink-soft">{t('Choose the access file you downloaded when you posted. It is read inside this browser and is never uploaded.')}</p>
        <label className="btn-primary cursor-pointer">
          <Icon name="upload" size={18} /> {t('Import access file')}
          <input type="file" accept=".txt,text/plain" className="sr-only" onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      </section>

      <form onSubmit={addExisting} className="card mt-4 space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Icon name="key" size={20} /> {t('Track a case from another device')}</h2>
        <p className="text-sm text-ink-soft">{t('Paste the case link (or its ID) and your key. It is verified, then saved only in this browser so you can follow its progress here.')}</p>
        <input className="input" required placeholder={t('Case link or ID')} value={importId} onChange={(e) => setImportId(e.target.value)} autoComplete="off" autoCapitalize="none" />
        <input className="input font-code" required placeholder={t('Case key')} value={importKey} onChange={(e) => setImportKey(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} />
        <button className="btn-primary" disabled={busy}>{busy && <Spinner />} {t('Track case')}</button>
      </form>
      <Dialog open={pending !== null} onClose={() => { setPending(null); setFilePw(''); }} title={t('This file has a password')}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (pending) void finishImport(pending, filePw); }}>
          <p className="text-sm text-ink-soft">{t('Type the password you chose when you downloaded it.')}</p>
          <input className="input" type="password" autoComplete="current-password" autoFocus required value={filePw} onChange={(e) => setFilePw(e.target.value)} aria-label={t('Password')} />
          <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner />} {t('Unlock')}</button>
        </form>
      </Dialog>
    </div>
  );
}

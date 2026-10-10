import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useT } from '../lib/i18n';
import { KeyFileError, ParsedKeyFile, readKeyFile } from '../lib/keyfile';
import { storage } from '../lib/storage';
import { Icon } from './Icon';
import { Dialog, Spinner, useToast } from './ui';

/**
 * "Import access file": reads the file inside the browser (it is never uploaded), unseals the key, proves it with the
 * normal owner request and only then saves it on this device. Handles the optional password.
 */
export function ImportAccessFile({ onImported, expectCase, className = 'btn-primary' }: { onImported: (r: { kind: 'case' | 'statement'; id: string; postId?: string }) => void; expectCase?: string; className?: string }) {
  const t = useT();
  const toast = useToast();
  const [pending, setPending] = useState<ParsedKeyFile | null>(null);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = async (parsed: ParsedKeyFile, password?: string) => {
    setBusy(true);
    try {
      const p = await parsed.open(password);
      if (expectCase && !(p.kind === 'case' && p.id === expectCase)) throw new KeyFileError('BAD_FORMAT', 'This access file belongs to a different case.');
      if (p.kind === 'case') {
        await api.getOwnerPost(p.id, p.key);
        storage.savePostKey(p.id, p.key);
        toast('success', t('Case added to this device.'));
        onImported({ kind: 'case', id: p.id });
      } else {
        const c = await api.getOwnerComment(p.id, p.key);
        storage.saveCommentKey(c.postId, p.id, p.key);
        toast('success', t('Statement added to this device.'));
        onImported({ kind: 'statement', id: p.id, postId: c.postId });
      }
      setPending(null);
      setPw('');
    } catch (err) {
      toast('error', err instanceof KeyFileError ? t(err.message) : (err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = await readKeyFile(file);
      if (parsed.passwordProtected) {
        setPending(parsed);
        setPw('');
      } else await finish(parsed);
    } catch (err) {
      toast('error', err instanceof KeyFileError ? t(err.message) : t('This file could not be read.'));
    }
  };

  return (
    <>
      <label className={`${className} cursor-pointer`}>
        <Icon name="upload" size={18} /> {t('Import access file')}
        <input type="file" accept=".txt,text/plain" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      <Dialog open={pending !== null} onClose={() => { setPending(null); setPw(''); }} title={t('This file has a password')}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (pending) void finish(pending, pw); }}>
          <p className="text-sm text-ink-soft">{t('Type the password you chose when you downloaded it.')}</p>
          <input className="input" type="password" autoComplete="current-password" autoFocus required value={pw} onChange={(e) => setPw(e.target.value)} aria-label={t('Password')} />
          <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner />} {t('Unlock')}</button>
        </form>
      </Dialog>
    </>
  );
}

import { useState } from 'react';
import { useT } from '../lib/i18n';
import { sealKeyFile, saveBlob } from '../lib/keyfile';
import { Icon } from './Icon';
import { PrivacyTip } from './PrivacyTip';
import { Dialog, haptic, useToast } from './ui';

/**
 * Shown ONCE after a case or statement is created. Instead of a key to copy, the person gets a sealed access file
 * to keep. This device already remembers it, so the file is only needed to manage the item from somewhere else.
 * The server stores only a one-way verifier, there is no recovery.
 */
export function EditKeyDialog({
  open,
  editKey,
  kind,
  refId,
  postId,
  savedLocally,
  onDone,
}: {
  open: boolean;
  editKey: string;
  kind: 'case' | 'statement';
  refId: string;
  postId?: string;
  savedLocally: boolean;
  onDone: () => void;
}) {
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const t = useT();

  const download = async () => {
    if (usePassword && password.length < 6) {
      toast('error', t('Use at least 6 characters for the password.'));
      return;
    }
    setBusy(true);
    try {
      const { name, blob } = await sealKeyFile({ kind, id: refId, postId, key: editKey }, usePassword ? password : undefined);
      saveBlob(name, blob);
      setDownloaded(name);
      haptic(12);
    } catch {
      toast('error', t('Could not create the file. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(editKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast('error', t('Could not copy automatically. Select the key and copy it manually.'));
    }
  };

  return (
    <Dialog open={open} onClose={() => undefined} title={kind === 'case' ? t('Your case access file') : t('Your statement access file')} dismissable={false}>
      <div className="space-y-4 text-sm">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900">
          <Icon name="alert" size={20} className="mt-0.5 shrink-0" />
          <p>
            <strong>{t('Download this file now.')}</strong>{' '}
            {kind === 'case'
              ? t('It is the only way to manage this case from another device. We do not keep a copy and cannot recover it.')
              : t('It is the only way to manage this statement from another device. We do not keep a copy and cannot recover it.')}
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-black/5 p-3.5">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand-600)]" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} />
          <span>
            <span className="font-bold">{t('Protect the file with a password')}</span>
            <span className="block text-ink-soft">{t('Recommended. Without a password anyone who gets the file can manage this.')}</span>
          </span>
        </label>
        {usePassword && (
          <input className="input" type="password" autoComplete="new-password" placeholder={t('Choose a password (6 or more characters)')} value={password} onChange={(e) => setPassword(e.target.value)} aria-label={t('Password')} />
        )}

        <button className="btn-primary w-full" onClick={download} disabled={busy}>
          <Icon name={downloaded ? 'check' : 'download'} size={19} /> {downloaded ? t('Download again') : t('Download access file')}
        </button>
        {downloaded && <p className="break-all rounded-lg bg-emerald-50 p-2.5 font-mono text-xs text-emerald-900">{downloaded}</p>}

        <PrivacyTip />

        <p className="text-ink-soft">
          {savedLocally
            ? t('This device remembers it already, so you do not need the file here. Clearing site data removes that, so keep the file.')
            : t('We could not save a copy on this device (storage is blocked). Keep the file somewhere safe.')}
        </p>

        <details className="rounded-xl border border-black/10 p-3">
          <summary className="cursor-pointer font-bold">{t('Advanced: show the raw key')}</summary>
          <div className="mt-3 space-y-2">
            <input readOnly value={editKey} onFocus={(e) => e.currentTarget.select()} className="input font-code" aria-label={t('Key')} />
            <button className="btn-secondary" onClick={copyKey}><Icon name={copied ? 'check' : 'copy'} size={17} /> {copied ? t('Copied') : t('Copy key')}</button>
          </div>
        </details>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-black/5 p-3.5">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand-600)]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>{t('I saved the file and understand it cannot be recovered.')}</span>
        </label>
        <button className="btn-primary w-full" disabled={!confirmed || !downloaded} onClick={onDone}>
          {t('Continue')}
        </button>
      </div>
    </Dialog>
  );
}

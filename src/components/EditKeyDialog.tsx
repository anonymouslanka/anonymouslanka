import { useState } from 'react';
import { Icon } from './Icon';
import { Dialog, haptic, useToast } from './ui';

/**
 * Shows a freshly generated case key ONCE. The user cannot dismiss it without confirming
 * they have saved it. There is no recovery: the server only stores a one-way verifier.
 */
export function EditKeyDialog({
  open,
  editKey,
  kind,
  savedLocally,
  onDone,
}: {
  open: boolean;
  editKey: string;
  kind: 'case' | 'statement';
  savedLocally: boolean;
  onDone: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(editKey);
      setCopied(true);
      haptic(12);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast('error', 'Could not copy automatically. Select the key and copy it manually.');
    }
  };

  const download = () => {
    const blob = new Blob([`DetectiveLanka — case key for your ${kind}\n\n${editKey}\n\nKeep this secret. Anyone with this key can edit or delete your ${kind}.\nIt cannot be recovered if lost.\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detectivelanka-${kind}-key.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onClose={() => undefined} title={kind === 'case' ? 'Your case key' : 'Your statement key'} dismissable={false}>
      <div className="space-y-4 text-sm">
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900">
          <Icon name="alert" size={20} className="mt-0.5 shrink-0" />
          <p><strong>This is the only time you will see this key.</strong> We store just a one-way fingerprint of it, so it cannot be shown again or recovered. Lose it and you lose the ability to edit or withdraw this {kind}.</p>
        </div>
        <div>
          <label className="label" htmlFor="edit-key">Key</label>
          <input id="edit-key" readOnly value={editKey} onFocus={(e) => e.currentTarget.select()} className="input font-code" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={copy}>
            <Icon name={copied ? 'check' : 'copy'} size={18} /> {copied ? 'Copied' : 'Copy key'}
          </button>
          <button className="btn-secondary" onClick={download}>
            <Icon name="download" size={18} /> Save file
          </button>
        </div>
        <p className="text-ink-soft">
          {savedLocally
            ? 'A copy was also saved on this device only, so you can manage it from here. Clearing site data removes it — keep your own backup.'
            : 'We could not save a copy on this device (storage is blocked). Keep the key somewhere safe.'}
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-black/5 p-3.5">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand-600)]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>I have saved my key and understand it cannot be recovered.</span>
        </label>
        <button className="btn-primary w-full" disabled={!confirmed} onClick={onDone}>
          Continue
        </button>
      </div>
    </Dialog>
  );
}

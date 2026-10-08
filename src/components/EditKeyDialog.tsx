import { useState } from 'react';
import { Dialog, useToast } from './ui';

/**
 * Shows a freshly generated edit key ONCE. The user cannot dismiss it without confirming
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
  kind: 'post' | 'comment';
  savedLocally: boolean;
  onDone: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const toast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(editKey);
      toast('success', 'Edit key copied to clipboard.');
    } catch {
      toast('error', 'Could not copy automatically. Select the key and copy it manually.');
    }
  };

  const download = () => {
    const blob = new Blob([`Anonymous Lanka — edit key for your ${kind}\n\n${editKey}\n\nKeep this secret. Anyone with this key can edit or delete your ${kind}.\nIt cannot be recovered if lost.\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anonymous-lanka-${kind}-edit-key.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onClose={() => undefined} title={`Save your ${kind} edit key`} dismissable={false}>
      <div className="space-y-4 text-sm">
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
          <strong>This is the only time you will see this key.</strong> We store just a one-way fingerprint of it, so we cannot show it again or
          recover it. If you lose it, you lose the ability to edit or delete this {kind}.
        </p>
        <div>
          <label className="label" htmlFor="edit-key">Your edit key</label>
          <input id="edit-key" readOnly value={editKey} onFocus={(e) => e.currentTarget.select()} className="input font-mono text-xs" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={copy}>Copy key</button>
          <button className="btn-secondary" onClick={download}>Download .txt</button>
        </div>
        <p className="text-stone-600">
          {savedLocally
            ? 'A copy was also saved in this browser only, so you can edit from this device. Clearing site data removes it — keep your own backup.'
            : 'We could not save a copy in this browser (storage is blocked). Keep the key somewhere safe.'}
        </p>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-brand-700)]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span>I have saved my edit key and understand it cannot be recovered.</span>
        </label>
        <div className="flex justify-end">
          <button className="btn-primary" disabled={!confirmed} onClick={onDone}>Continue</button>
        </div>
      </div>
    </Dialog>
  );
}

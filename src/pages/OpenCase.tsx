import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaseForm, clearCaseDraft } from '../components/CaseForm';
import { EditKeyDialog } from '../components/EditKeyDialog';
import { Icon } from '../components/Icon';
import { useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { storage } from '../lib/storage';
import { usePageMeta } from '../lib/util';

export default function OpenCase() {
  usePageMeta({ title: 'Open a case', description: 'File an anonymous case. No account needed.', path: '/open-case', noindex: true });
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [created, setCreated] = useState<{ id: string; key: string; saved: boolean } | null>(null);

  const submit = async (form: FormData) => {
    setBusy(true);
    setError(null);
    try {
      const { post, editKey } = await api.createPost(form, setProgress);
      clearCaseDraft();
      const saved = storage.savePostKey(post.id, editKey);
      setCreated({ id: post.id, key: editKey, saved });
    } catch (e) {
      const err = e as ApiError;
      setError(err);
      toast('error', err.status === 429 ? 'You are filing too quickly. Please wait a while and try again.' : err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => navigate(-1)} className="chrome mb-3 inline-flex items-center gap-1 py-1 text-sm font-bold text-ink-soft">
        <Icon name="chevronLeft" size={18} /> Back
      </button>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Open a case</h1>
      <p className="mt-1.5 mb-6 text-sm text-ink-soft">Your case file is reviewed by a moderator and appears publicly only once it is cleared. You will receive a secret case key — keep it safe.</p>
      <CaseForm busy={busy} progress={progress} error={error} submitLabel="Open case" onSubmit={submit} />

      <EditKeyDialog
        open={created !== null}
        editKey={created?.key ?? ''}
        kind="case"
        savedLocally={created?.saved ?? false}
        onDone={() => {
          toast('success', 'Case filed. A moderator will review it shortly.');
          navigate('/my-cases');
        }}
      />
    </div>
  );
}

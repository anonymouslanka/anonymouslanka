import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EditKeyDialog } from '../components/EditKeyDialog';
import { PostForm } from '../components/PostForm';
import { useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { storage } from '../lib/storage';
import { usePageMeta } from '../lib/util';

export default function NewPost() {
  usePageMeta({ title: 'Share a report', description: 'Submit an anonymous report. No account needed.', path: '/new', noindex: true });
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [created, setCreated] = useState<{ id: string; key: string; saved: boolean } | null>(null);

  const submit = async (form: FormData) => {
    setBusy(true);
    setError(null);
    try {
      const { post, editKey } = await api.createPost(form);
      const saved = storage.savePostKey(post.id, editKey);
      setCreated({ id: post.id, key: editKey, saved });
    } catch (e) {
      const err = e as ApiError;
      setError(err);
      toast('error', err.status === 429 ? 'You’re posting too quickly. Please wait a while and try again.' : err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold">Share a report</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">
        No account, name or email. Your report is reviewed by a moderator and only appears publicly once approved. You will receive a secret edit key — keep it safe.
      </p>
      <div className="card mt-8 p-5 sm:p-7">
        <PostForm busy={busy} error={error} submitLabel="Submit for review" onSubmit={submit} />
      </div>

      <EditKeyDialog
        open={created !== null}
        editKey={created?.key ?? ''}
        kind="post"
        savedLocally={created?.saved ?? false}
        onDone={() => {
          toast('success', 'Submitted! A moderator will review your report.');
          navigate('/my-posts');
        }}
      />
    </div>
  );
}

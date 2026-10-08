import { FormEvent, useState } from 'react';
import { ApiError } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { api } from '../lib/api';
import type { ImageDto, OwnerPost } from '../lib/types';
import { ImagePicker, MAX_IMAGES } from './ImagePicker';
import { FieldError, Spinner, useToast } from './ui';

const splitTags = (s: string) => [...new Set(s.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean))];

/**
 * Shared create/edit form. In edit mode only CHANGED fields are sent (fewer surprises for moderation).
 */
export function PostForm({
  initial,
  busy,
  error,
  submitLabel,
  onSubmit,
}: {
  initial?: OwnerPost;
  busy: boolean;
  error: ApiError | null;
  submitLabel: string;
  onSubmit: (form: FormData) => void;
}) {
  const toast = useToast();
  const categories = useAsync(() => api.categories(), []);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [category, setCategory] = useState(initial?.category?.slug ?? '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [agree, setAgree] = useState(Boolean(initial));
  const edit = Boolean(initial);
  const existing: ImageDto[] = (initial?.images ?? []).filter((i) => !removed.includes(i.id));
  const slots = MAX_IMAGES - existing.length;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    const tagList = splitTags(tags);
    if (!initial) {
      fd.append('title', title);
      fd.append('content', content);
      if (category) fd.append('category', category);
      if (tagList.length) fd.append('tags', tagList.join(','));
    } else {
      if (title !== initial.title) fd.append('title', title);
      if (content !== initial.content) fd.append('content', content);
      if (category !== (initial.category?.slug ?? '')) fd.append('category', category);
      if (tagList.join(',') !== initial.tags.join(',')) fd.append('tags', tagList.join(','));
      removed.forEach((id) => fd.append('removeImageIds', id));
    }
    files.forEach((f) => fd.append('images', f));
    onSubmit(fd);
  };

  const f = error?.fields ?? {};

  return (
    <form onSubmit={submit} className="space-y-6" noValidate={false}>
      {error && !Object.keys(f).length && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">{error.message}</p>
      )}

      <div>
        <label htmlFor="title" className="label">Title</label>
        <input id="title" className="input" required minLength={5} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A clear, factual headline" />
        <FieldError messages={f.title} />
      </div>

      <div>
        <label htmlFor="content" className="label">What happened?</label>
        <textarea id="content" className="input min-h-56" required minLength={20} maxLength={10000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Describe what you know: what, where, when. Stick to facts you have seen or can show." />
        <div className="mt-1 flex justify-between text-xs text-stone-500"><FieldError messages={f.content} /><span className="ml-auto">{content.length}/10000</span></div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="label">Category</label>
          <select id="category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">No category</option>
            {categories.data?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <FieldError messages={f.category} />
        </div>
        <div>
          <label htmlFor="tags" className="label">Tags <span className="font-normal text-stone-500">(up to 5, comma separated)</span></label>
          <input id="tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="colombo, fraud, online" />
          <FieldError messages={f.tags} />
        </div>
      </div>

      <fieldset>
        <legend className="label">Images <span className="font-normal text-stone-500">(optional)</span></legend>
        {existing.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {existing.map((img) => (
              <div key={img.id} className="relative aspect-square overflow-hidden rounded-xl border border-stone-200 dark:border-stone-700">
                <img src={img.thumb} alt="" className="h-full w-full object-cover" />
                <button type="button" aria-label="Remove this image" onClick={() => setRemoved((r) => [...r, img.id])} className="absolute top-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-full bg-stone-950/75 text-white hover:bg-red-600">✕</button>
              </div>
            ))}
          </div>
        )}
        {slots > 0 ? <ImagePicker slots={slots} onChange={setFiles} onError={(m) => toast('error', m)} /> : <p className="text-sm text-stone-500">Maximum images reached.</p>}
        <FieldError messages={f.images} />
      </fieldset>

      {!edit && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-stone-100 p-4 text-sm dark:bg-stone-900">
          <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--color-brand-700)]" />
          <span>I have read the <a href="/guidelines" target="_blank" className="font-semibold text-brand-700 underline dark:text-brand-300">guidelines</a>. This report is truthful to the best of my knowledge and contains no private personal data (home addresses, phone numbers, ID numbers) of private individuals.</span>
        </label>
      )}

      <div className="flex justify-end">
        <button className="btn-primary min-w-40" disabled={busy || !agree}>
          {busy && <Spinner />}
          {busy ? 'Working…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

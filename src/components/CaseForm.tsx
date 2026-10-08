import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { MAX_FILES } from '../lib/files';
import type { FileDto, ImageDto, OwnerPost } from '../lib/types';
import { Icon, IconName } from './Icon';
import { FilePicker, FileRow } from './FilePicker';
import { ImagePicker, MAX_IMAGES } from './ImagePicker';
import { FieldError, Spinner, useToast } from './ui';

const splitTags = (s: string) => [...new Set(s.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean))];

const DRAFT_KEY = 'app:draft:case';
interface Draft { title: string; content: string; category: string; tags: string }
const readDraft = (): Draft | null => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
    return d && typeof d.title === 'string' ? d : null;
  } catch {
    return null;
  }
};
export const clearCaseDraft = (): void => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
};

function Section({ n, icon, title, hint, children }: { n: number; icon: IconName; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-folder text-[#7a5a14]"><Icon name={icon} size={21} /></span>
        <div>
          <p className="font-mono text-[0.62rem] tracking-[0.16em] text-[#9b7621] uppercase">Section {n}</p>
          <h2 className="font-display text-lg leading-tight font-bold">{title}</h2>
        </div>
      </div>
      {hint && <p className="-mt-1 mb-4 text-sm text-ink-soft">{hint}</p>}
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/**
 * Shared "open a case" / "update case file" form. In edit mode only CHANGED fields are sent.
 * No personal information is requested anywhere. A draft is kept on this device while typing (cleared on success).
 */
export function CaseForm({
  initial,
  busy,
  progress,
  error,
  submitLabel,
  onSubmit,
}: {
  initial?: OwnerPost;
  busy: boolean;
  progress?: number | null;
  error: ApiError | null;
  submitLabel: string;
  onSubmit: (form: FormData) => void;
}) {
  const toast = useToast();
  const categories = useAsync(() => api.categories(), []);
  const draft = useRef(initial ? null : readDraft());
  const [title, setTitle] = useState(initial?.title ?? draft.current?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? draft.current?.content ?? '');
  const [category, setCategory] = useState(initial?.category?.slug ?? draft.current?.category ?? '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? draft.current?.tags ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [docs, setDocs] = useState<File[]>([]);
  const [removedDocs, setRemovedDocs] = useState<string[]>([]);
  const [agree, setAgree] = useState(Boolean(initial));
  const edit = Boolean(initial);
  const existing: ImageDto[] = (initial?.images ?? []).filter((i) => !removed.includes(i.id));
  const slots = MAX_IMAGES - existing.length;
  const existingDocs: FileDto[] = (initial?.files ?? []).filter((d) => !removedDocs.includes(d.id));
  const docSlots = MAX_FILES - existingDocs.length;

  // Autosave the draft (create mode only).
  useEffect(() => {
    if (edit) return;
    const t = setTimeout(() => {
      try {
        if (title || content || tags) localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content, category, tags }));
      } catch {
        /* ignore */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [edit, title, content, category, tags]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast('error', 'You are offline. Your draft is saved on this device — try again when you are back online.');
      return;
    }
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
      removedDocs.forEach((id) => fd.append('removeFileIds', id));
    }
    files.forEach((f) => fd.append('images', f));
    docs.forEach((f) => fd.append('files', f));
    onSubmit(fd);
  };

  const f = error?.fields ?? {};

  return (
    <form onSubmit={submit} className="space-y-4">
      {!edit && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          <Icon name="shieldCheck" size={22} className="mt-0.5 shrink-0" />
          <p><strong>No personal information needed.</strong> No name, email or phone number — ever. You get a secret case key instead of an account, and photo location data is stripped automatically.</p>
        </div>
      )}
      {draft.current && !edit && (
        <p className="flex items-center gap-2 rounded-xl bg-folder/50 px-3.5 py-2.5 text-xs font-semibold text-[#7a5a14]">
          <Icon name="file" size={15} /> Restored your unsent draft from this device.
          <button type="button" className="ml-auto underline" onClick={() => { clearCaseDraft(); setTitle(''); setContent(''); setCategory(''); setTags(''); draft.current = null; }}>Discard</button>
        </p>
      )}

      {error && !Object.keys(f).length && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900"><Icon name="alert" size={18} className="mt-0.5 shrink-0" /> {error.message}</p>
      )}

      <Section n={1} icon="file" title="The case" hint="Stick to facts you saw or can show: what happened, where and when.">
        <div>
          <label htmlFor="title" className="label">Case title</label>
          <input id="title" className="input" required minLength={5} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A short, factual headline" enterKeyHint="next" />
          <FieldError messages={f.title} />
        </div>
        <div>
          <label htmlFor="content" className="label">Summary of events</label>
          <textarea id="content" className="input min-h-52" required minLength={20} maxLength={10000} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Describe the events in your own words. Do not include private details about private individuals." />
          <div className="mt-1 flex justify-between text-xs text-ink-soft"><FieldError messages={f.content} /><span className="ml-auto">{content.length}/10000</span></div>
        </div>
      </Section>

      <Section n={2} icon="tag" title="Classification">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className="label">Case type</label>
            <select id="category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Not specified</option>
              {categories.data?.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <FieldError messages={f.category} />
          </div>
          <div>
            <label htmlFor="tags" className="label">Keywords (max 5)</label>
            <input id="tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="colombo, online, sms" autoCapitalize="none" />
            <FieldError messages={f.tags} />
          </div>
        </div>
      </Section>

      <Section n={3} icon="image" title="Exhibits" hint="Photos that support the case (optional).">
        {existing.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {existing.map((img, i) => (
              <div key={img.id} className="relative aspect-square overflow-hidden rounded-2xl border border-black/10 bg-white p-1.5">
                <img src={img.thumb} alt="" crossOrigin="anonymous" className="h-full w-full rounded-xl object-cover" />
                <span className="absolute bottom-2.5 left-2.5 rounded-md bg-ink/85 px-1.5 py-0.5 font-mono text-[0.6rem] tracking-widest text-white uppercase">Exhibit {String.fromCharCode(65 + i)}</span>
                <button type="button" aria-label="Remove this exhibit" onClick={() => setRemoved((r) => [...r, img.id])} className="absolute top-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full bg-ink/85 text-white active:bg-red-600"><Icon name="x" size={16} strokeWidth={2.6} /></button>
              </div>
            ))}
          </div>
        )}
        {slots > 0 ? <ImagePicker slots={slots} onChange={setFiles} onError={(m) => toast('error', m)} /> : <p className="text-sm text-ink-soft">Maximum exhibits reached.</p>}
        <FieldError messages={f.images} />
      </Section>

      <Section n={4} icon="file" title="Documents" hint="PDF or Office files that back up the case (optional).">
        {existingDocs.length > 0 && (
          <div className="space-y-2.5">
            {existingDocs.map((d) => <FileRow key={d.id} file={d} onRemove={() => setRemovedDocs((r) => [...r, d.id])} />)}
          </div>
        )}
        {docSlots > 0 ? <FilePicker slots={docSlots} onChange={setDocs} onError={(m) => toast('error', m)} /> : <p className="text-sm text-ink-soft">Maximum documents reached.</p>}
        <FieldError messages={f.files} />
      </Section>

      {!edit && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-black/10 bg-white p-4 text-sm">
          <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand-600)]" />
          <span>I have read the <a href="/guidelines" target="_blank" className="font-bold text-brand-700 underline">code of conduct</a>. This case is truthful to the best of my knowledge and contains no private personal data (addresses, phone or ID numbers) of private individuals.</span>
        </label>
      )}

      <div className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10">
        <button className="btn-primary w-full !min-h-14 !rounded-2xl text-base" disabled={busy || !agree}>
          {busy ? <Spinner /> : <Icon name={edit ? 'check' : 'folderPlus'} size={22} />}
          {busy ? (progress != null && progress < 100 && (files.length || docs.length) ? `Uploading ${progress}%` : 'Filing…') : submitLabel}
        </button>
      </div>
    </form>
  );
}

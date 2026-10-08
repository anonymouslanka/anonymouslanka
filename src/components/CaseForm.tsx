import { AnimatePresence, motion } from 'framer-motion';
import { FormEvent, ReactNode, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { ease, spring } from '../lib/motion';
import type { ImageDto, OwnerPost } from '../lib/types';
import { Icon, IconName } from './Icon';
import { ImagePicker, MAX_IMAGES } from './ImagePicker';
import { FieldError, Spinner, useToast } from './ui';

const splitTags = (s: string) => [...new Set(s.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean))];

function Section({ n, icon, title, hint, children }: { n: number; icon: IconName; title: string; hint?: string; children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, ease }} className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-folder text-[#7a5a14]"><Icon name={icon} size={19} /></span>
        <div>
          <p className="font-mono text-[0.62rem] font-bold tracking-[0.16em] text-[#9b7621] uppercase">Section {n}</p>
          <h2 className="font-display text-lg leading-tight font-bold">{title}</h2>
        </div>
      </div>
      {hint && <p className="-mt-1 mb-4 text-sm text-ink-soft">{hint}</p>}
      <div className="space-y-5">{children}</div>
    </motion.section>
  );
}

/**
 * Shared "open a case" / "update case file" form. In edit mode only CHANGED fields are sent.
 * No personal information is requested anywhere.
 */
export function CaseForm({
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
    <form onSubmit={submit} className="space-y-5">
      {!edit && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <Icon name="shieldCheck" size={22} className="mt-0.5 shrink-0" />
          <p><strong>No personal information needed.</strong> No name, email or phone number — ever. You get a secret case key instead of an account, and photo location data is stripped automatically.</p>
        </motion.div>
      )}

      <AnimatePresence>
        {error && !Object.keys(f).length && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="overflow-hidden rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error.message}</motion.p>
        )}
      </AnimatePresence>

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
            <label htmlFor="tags" className="label">Keywords <span className="font-normal tracking-normal normal-case">(max 5)</span></label>
            <input id="tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="colombo, online, sms" autoCapitalize="none" />
            <FieldError messages={f.tags} />
          </div>
        </div>
      </Section>

      <Section n={3} icon="image" title="Exhibits" hint="Photos that support the case (optional).">
        {existing.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {existing.map((img, i) => (
              <div key={img.id} className="relative aspect-square overflow-hidden rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm">
                <img src={img.thumb} alt="" crossOrigin="anonymous" className="h-full w-full rounded-xl object-cover" />
                <span className="absolute bottom-2.5 left-2.5 rounded-md bg-ink/80 px-1.5 py-0.5 font-mono text-[0.6rem] font-bold tracking-widest text-white uppercase">Exhibit {String.fromCharCode(65 + i)}</span>
                <button type="button" aria-label="Remove this exhibit" onClick={() => setRemoved((r) => [...r, img.id])} className="absolute top-2.5 right-2.5 grid h-8 w-8 place-items-center rounded-full bg-ink/80 text-white hover:bg-red-600"><Icon name="x" size={15} strokeWidth={2.4} /></button>
              </div>
            ))}
          </div>
        )}
        {slots > 0 ? <ImagePicker slots={slots} onChange={setFiles} onError={(m) => toast('error', m)} /> : <p className="text-sm text-ink-soft">Maximum exhibits reached.</p>}
        <FieldError messages={f.images} />
      </Section>

      {!edit && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-sm">
          <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand-700)]" />
          <span>I have read the <a href="/guidelines" target="_blank" className="font-bold text-brand-700 underline">code of conduct</a>. This case is truthful to the best of my knowledge and contains no private personal data (addresses, phone or ID numbers) of private individuals.</span>
        </label>
      )}

      <motion.div whileTap={{ scale: 0.98 }} transition={spring} className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10">
        <button className="btn-primary w-full !min-h-14 !rounded-2xl text-base" disabled={busy || !agree}>
          {busy ? <Spinner /> : <Icon name={edit ? 'check' : 'folderPlus'} size={20} />}
          {busy ? 'Filing…' : submitLabel}
        </button>
      </motion.div>
    </form>
  );
}

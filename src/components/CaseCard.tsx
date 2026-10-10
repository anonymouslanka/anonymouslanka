import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n';
import type { PostSummary } from '../lib/types';
import { caseNo, timeAgo } from '../lib/util';
import { Icon } from './Icon';

/** One case file in the list. Plain CSS press feedback, no hover effects, no shadows. */
export function CaseCard({ post }: { post: PostSummary }) {
  const t = useT();
  const img = post.images[0];
  return (
    <article className="case-card">
      <Link
        to={`/case/${post.id}`}
        aria-label={t('{title}, case {no}', { title: post.title, no: caseNo(post.id) })}
        className="card flex gap-4 overflow-hidden border-l-[5px] border-l-folder-deep p-4 transition-transform duration-100 active:scale-[0.985]"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-mono text-[0.72rem] tracking-[0.1em] text-[#7a5a14]">{caseNo(post.id)}</span>
            {post.category && <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[0.68rem] font-bold text-brand-800">{post.category.name}</span>}
          </div>
          <h3 className="font-display text-[1.06rem] leading-snug font-bold text-ink">{post.title}</h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-ink-soft">{post.excerpt}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
            <span className="inline-flex items-center gap-1.5"><Icon name="clock" size={14} /> <time dateTime={post.publishedAt ?? undefined}>{timeAgo(post.publishedAt)}</time></span>
            {post.imageCount > 0 && <span className="inline-flex items-center gap-1.5"><Icon name="image" size={14} /> {post.imageCount === 1 ? t('1 exhibit') : t('{n} exhibits', { n: post.imageCount })}</span>}
            <span className="inline-flex items-center gap-1.5"><Icon name="chat" size={14} /> {post.commentCount}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between gap-2">
          {img ? (
            <div className="h-24 w-24 overflow-hidden rounded-xl bg-stone-200 sm:h-28 sm:w-28">
              <img src={img.thumb} alt="" crossOrigin="anonymous" width={224} height={224} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="grid h-24 w-24 place-items-center rounded-xl bg-folder/55 text-[#9b7621] sm:h-28 sm:w-28" aria-hidden="true">
              <Icon name="file" size={32} />
            </div>
          )}
          {post.origin === 'AI' && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.68rem] font-bold text-emerald-900"><Icon name="shieldCheck" size={11} /> DL-ai</span>}
        </div>
      </Link>
    </article>
  );
}

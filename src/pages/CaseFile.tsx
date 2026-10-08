import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Lightbox } from '../components/Lightbox';
import { ShareButton } from '../components/ShareButton';
import { Statements } from '../components/Statements';
import { EmptyState, ErrorState, Skeleton, StatusBadge } from '../components/ui';
import { api } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { storage } from '../lib/storage';
import { caseNo, formatDate, usePageMeta } from '../lib/util';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[0.64rem] tracking-[0.14em] text-[#9b7621] uppercase">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-bold text-ink">{children}</dd>
    </div>
  );
}

export default function CaseFile() {
  const { id = '' } = useParams();
  const { data: post, error, loading, reload } = useAsync(() => api.getPost(id), [id]);
  const [viewer, setViewer] = useState<number | null>(null);
  const [composer, setComposer] = useState(false);

  usePageMeta({
    title: post ? `${post.title} (${caseNo(post.id)})` : 'Case file',
    description: post?.excerpt,
    image: post?.images[0]?.large,
    path: `/case/${id}`,
    noindex: !post,
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 w-full !rounded-2xl" />
        <Skeleton className="h-40 w-full !rounded-2xl" />
      </div>
    );
  }
  if (error?.status === 404) {
    return <EmptyState icon="folder" title="This case file isn’t available" message="It may still be under review, may have been withdrawn, or the link may be wrong." action={<Link to="/" className="btn-primary">Back to case files</Link>} />;
  }
  if (error || !post) return <ErrorState message={error?.message ?? 'Could not load this case file.'} onRetry={reload} />;

  const mine = Boolean(storage.getPostKey(post.id));

  return (
    <article className="pb-24 lg:pb-0">
      <Link to="/" className="chrome mb-4 inline-flex items-center gap-1 py-1 text-sm font-bold text-ink-soft">
        <Icon name="chevronLeft" size={18} /> Case files
      </Link>

      <div>
        <div className="folder-tab ml-1"><Icon name="folder" size={13} /> Case file · {caseNo(post.id)}</div>
        <div className="card relative rounded-tl-none border-folder-deep/70 bg-[#fffdf8] p-5 sm:p-7">
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6"><StatusBadge status="APPROVED" /></div>
          <h1 className="max-w-[82%] font-display text-[1.65rem] leading-tight font-bold sm:text-4xl">{post.title}</h1>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-dashed border-folder-deep py-4 sm:grid-cols-4">
            <Fact label="Filed">{formatDate(post.publishedAt)}</Fact>
            <Fact label="Case type">{post.category?.name ?? 'Not specified'}</Fact>
            <Fact label="Exhibits">{post.images.length}</Fact>
            <Fact label="Statements">{post.commentCount}</Fact>
          </dl>
          {/* Desktop actions (phones use the bottom action bar) */}
          <div className="mt-4 hidden flex-wrap items-center gap-2.5 lg:flex">
            <button className="btn-primary" onClick={() => setComposer(true)}><Icon name="chat" size={19} /> Add statement</button>
            <ShareButton postId={post.id} title={post.title} />
            {mine && <Link to={`/edit/${post.id}`} className="btn-secondary"><Icon name="edit" size={18} /> Manage my case</Link>}
          </div>
        </div>
      </div>

      <section className="mt-6 page-in">
        <h2 className="mb-2 font-mono text-xs tracking-[0.14em] text-ink-soft uppercase">Summary of events</h2>
        <div className="card p-5 sm:p-6"><div className="prose-plain text-[1.02rem]" data-selectable>{post.content}</div></div>
      </section>

      {post.images.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-mono text-xs tracking-[0.14em] text-ink-soft uppercase">Exhibits</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {post.images.map((img, i) => (
              <button key={img.id} onClick={() => setViewer(i)} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/10 bg-white p-1.5 text-left transition-transform duration-100 active:scale-[0.97]" aria-label={`Open exhibit ${String.fromCharCode(65 + i)}`}>
                <img src={img.medium} alt={`Exhibit ${String.fromCharCode(65 + i)}`} crossOrigin="anonymous" width={img.width} height={img.height} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" className="h-full w-full rounded-xl object-cover" />
                <span className="absolute bottom-3 left-3 rounded-md bg-ink/85 px-2 py-0.5 font-mono text-[0.62rem] tracking-[0.12em] text-white uppercase">Exhibit {String.fromCharCode(65 + i)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {post.tags.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Icon name="tag" size={16} className="text-ink-soft" />
          {post.tags.map((t) => <Link key={t} className="chip" to={`/?tag=${encodeURIComponent(t)}`}>#{t}</Link>)}
        </div>
      )}

      <div className="mt-6 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
        <Icon name="scale" size={20} className="mt-0.5 shrink-0" />
        <p><strong>Notice.</strong> This is an anonymous, public-submitted case file that was reviewed by a moderator but not independently verified. If you believe it contains an error or private information, file a statement. In an emergency call <strong>119</strong>.</p>
      </div>

      <Statements postId={post.id} composerOpen={composer} setComposerOpen={setComposer} />

      {/* Phone action bar: always one tap away from adding a statement, sharing or managing your case */}
      <div className="fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 border-t border-black/10 bg-[#f8f4ea] px-3 py-2.5 lg:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <button className="btn-primary flex-1" onClick={() => setComposer(true)}><Icon name="chat" size={19} /> Add statement</button>
          <ShareButton postId={post.id} title={post.title} iconOnly />
          {mine && <Link to={`/edit/${post.id}`} className="btn-secondary !px-3.5" aria-label="Manage my case"><Icon name="edit" size={20} /></Link>}
        </div>
      </div>

      <Lightbox images={post.images} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
    </article>
  );
}

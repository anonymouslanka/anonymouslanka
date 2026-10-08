import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Comments } from '../components/Comments';
import { ShareButton } from '../components/ShareButton';
import { Dialog, EmptyState, ErrorState, Skeleton } from '../components/ui';
import { api } from '../lib/api';
import { ease, Reveal, spring } from '../lib/motion';
import { useAsync } from '../lib/hooks';
import { storage } from '../lib/storage';
import { formatDate, usePageMeta } from '../lib/util';

export default function PostDetail() {
  const { id = '' } = useParams();
  const { data: post, error, loading, reload } = useAsync(() => api.getPost(id), [id]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [active, setActive] = useState(0);

  usePageMeta({
    title: post?.title ?? 'Report',
    description: post?.excerpt,
    image: post?.images[0]?.large,
    path: `/post/${id}`,
    noindex: !post,
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }
  if (error?.status === 404) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState title="This report isn’t available" message="It may still be under review, may have been removed, or the link may be incorrect." action={<Link to="/" className="btn-primary">Back to reports</Link>} />
      </div>
    );
  }
  if (error || !post) return <ErrorState message={error?.message ?? 'Could not load this report.'} onRetry={reload} />;

  const mine = Boolean(storage.getPostKey(post.id));
  const hero = post.images[active];

  return (
    <article className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm">
        <Link to="/" className="text-stone-500 hover:text-brand-700">← All reports</Link>
      </nav>

      <header>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-stone-500">
          {post.category && (
            <Link to={`/?category=${post.category.slug}`} className="rounded-full bg-brand-50 px-3 py-0.5 text-xs font-semibold text-brand-800">{post.category.name}</Link>
          )}
          <time dateTime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt)}</time>
        </div>
        <h1 className="font-display text-3xl leading-tight font-bold sm:text-4xl">{post.title}</h1>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <ShareButton postId={post.id} title={post.title} />
          {mine && <Link to={`/edit/${post.id}`} className="btn-secondary">Edit my post</Link>}
        </div>
      </header>

      {hero && (
        <figure className="mt-7">
          <button type="button" onClick={() => setLightbox(active)} className="block w-full overflow-hidden rounded-2xl bg-stone-100" aria-label="Open image full size">
            <motion.img key={hero.id} initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease }} src={hero.large} alt={`Image ${active + 1} of ${post.images.length} attached to this report`} width={hero.width} height={hero.height} className="max-h-[32rem] w-full object-contain" decoding="async" />
          </button>
          {post.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Images">
              {post.images.map((img, i) => (
                <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.94 }} transition={spring} key={img.id} role="tab" aria-selected={i === active} onClick={() => setActive(i)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${i === active ? 'border-brand-700' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                  <img src={img.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                </motion.button>
              ))}
            </div>
          )}
        </figure>
      )}

      <Reveal><div className="prose-plain mt-8 text-[1.05rem]">{post.content}</div></Reveal>

      {post.tags.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {post.tags.map((t) => <Link key={t} className="chip" to={`/?tag=${encodeURIComponent(t)}`}>#{t}</Link>)}
        </div>
      )}

      <p className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        This is an anonymous, user-submitted report that was reviewed by a moderator but not independently verified. If you believe it contains an error or private information, please comment below or contact the authorities. In an emergency call 119.
      </p>

      <Comments postId={post.id} />

      <Dialog open={lightbox !== null} onClose={() => setLightbox(null)} title="Image" size="xl">
        {lightbox !== null && post.images[lightbox] && <img src={post.images[lightbox].large} alt="" className="max-h-[75vh] w-full object-contain" />}
      </Dialog>
    </article>
  );
}

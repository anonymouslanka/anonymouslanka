import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { itemVariants, spring } from '../lib/motion';
import type { PostSummary } from '../lib/types';
import { timeAgo } from '../lib/util';

/** Card used inside a <Stagger> grid: animates in with its siblings and lifts on hover. */
export function PostCard({ post }: { post: PostSummary }) {
  const img = post.images[0];
  return (
    <motion.article
      variants={itemVariants}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.985 }}
      transition={spring}
      className="card group relative flex flex-col overflow-hidden transition-shadow duration-300 hover:shadow-lift"
    >
      <Link to={`/post/${post.id}`} className="flex flex-1 flex-col focus-visible:rounded-2xl" aria-label={post.title}>
        {img ? (
          <div className="relative aspect-[16/10] overflow-hidden bg-stone-100">
            <img
              src={img.thumb}
              alt=""
              width={480}
              height={Math.round((480 * img.height) / img.width)}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.06]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            {post.imageCount > 1 && (
              <span className="absolute right-2 bottom-2 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-stone-700 shadow-sm backdrop-blur">+{post.imageCount - 1}</span>
            )}
          </div>
        ) : (
          <div className="h-1.5 bg-gradient-to-r from-brand-500 via-gold to-teal-400" aria-hidden="true" />
        )}
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
            {post.category && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-semibold text-brand-700">{post.category.name}</span>}
            <time dateTime={post.publishedAt ?? undefined}>{timeAgo(post.publishedAt)}</time>
          </div>
          <h3 className="font-display text-lg leading-snug font-semibold transition-colors group-hover:text-brand-700">{post.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm text-stone-600">{post.excerpt}</p>
          <div className="mt-auto flex items-center justify-between pt-4 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1">💬 {post.commentCount}</span>
            {post.tags.length > 0 && <span className="truncate pl-3 text-teal-700">{post.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}</span>}
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

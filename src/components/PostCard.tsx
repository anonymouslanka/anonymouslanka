import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { PostSummary } from '../lib/types';
import { timeAgo } from '../lib/util';

export function PostCard({ post, index = 0 }: { post: PostSummary; index?: number }) {
  const img = post.images[0];
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.04 }}
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <Link to={`/post/${post.id}`} className="flex flex-1 flex-col focus-visible:rounded-2xl" aria-label={post.title}>
        {img ? (
          <div className="relative aspect-[16/10] overflow-hidden bg-stone-100 dark:bg-stone-800">
            <img
              src={img.thumb}
              alt=""
              width={480}
              height={Math.round((480 * img.height) / img.width)}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
            {post.imageCount > 1 && (
              <span className="absolute right-2 bottom-2 rounded-full bg-stone-950/70 px-2 py-0.5 text-xs font-medium text-white">+{post.imageCount - 1}</span>
            )}
          </div>
        ) : (
          <div className="h-1.5 bg-gradient-to-r from-brand-700 to-gold" aria-hidden="true" />
        )}
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-2 flex flex-wrap items-center gap-x-2 text-xs text-stone-500 dark:text-stone-400">
            {post.category && <span className="font-semibold text-brand-700 dark:text-brand-300">{post.category.name}</span>}
            {post.category && <span aria-hidden="true">·</span>}
            <time dateTime={post.publishedAt ?? undefined}>{timeAgo(post.publishedAt)}</time>
          </div>
          <h3 className="font-display text-lg leading-snug font-semibold group-hover:text-brand-700 dark:group-hover:text-brand-300">{post.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm text-stone-600 dark:text-stone-400">{post.excerpt}</p>
          <div className="mt-auto flex items-center justify-between pt-4 text-xs text-stone-500 dark:text-stone-400">
            <span>💬 {post.commentCount}</span>
            {post.tags.length > 0 && <span className="truncate pl-3">{post.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}</span>}
          </div>
        </div>
      </Link>
    </motion.article>
  );
}

import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { api } from '../lib/api';
import { useAsync } from '../lib/hooks';
import { formatDate, usePageMeta } from '../lib/util';

/** A published moderator announcement (opened from the notification centre or a push notification). */
export default function Announcement() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useAsync(() => api.announcement(id), [id]);
  usePageMeta({ title: data?.title ?? 'Announcement', noindex: true });

  if (loading) return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-40 w-full !rounded-2xl" /></div>;
  if (error?.status === 404) return <EmptyState icon="megaphone" title="This announcement isn’t available" message="It may have been withdrawn by the moderators." action={<Link to="/notifications" className="btn-primary">Back to notifications</Link>} />;
  if (error || !data) return <ErrorState message={error?.message ?? 'Could not load this announcement.'} onRetry={reload} />;

  return (
    <article className="mx-auto max-w-2xl">
      <Link to="/notifications" className="chrome mb-3 hidden items-center gap-1 py-1 text-sm font-bold text-ink-soft lg:inline-flex"><Icon name="chevronLeft" size={18} /> Notifications</Link>
      <p className="flex items-center gap-2 font-mono text-xs tracking-[0.14em] text-[#9b7621] uppercase"><Icon name="megaphone" size={15} /> Announcement · {formatDate(data.publishedAt)}</p>
      <h1 className="mt-2 font-display text-3xl leading-tight font-bold break-words sm:text-4xl">{data.title}</h1>
      <div className="card mt-5 p-5 sm:p-6"><p className="prose-plain text-[1.02rem]">{data.body}</p></div>
    </article>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileRow } from '../components/FilePicker';
import { Icon } from '../components/Icon';
import { ShareButton } from '../components/ShareButton';
import { Statements } from '../components/Statements';
import { ConfirmDialog, EmptyState, ErrorState, Skeleton, StatusBadge, useToast } from '../components/ui';
import { Viewer } from '../components/Viewer';
import { api, ApiError, deviceStore } from '../lib/api';
import { viewerItems } from '../lib/files';
import { haptics } from '../lib/haptics';
import { useT } from '../lib/i18n';
import { PunishmentPoll } from '../components/PunishmentPoll';
import { useAsync } from '../lib/hooks';
import { storage } from '../lib/storage';
import { caseNo, cx, formatDate, usePageMeta } from '../lib/util';

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
  const toast = useToast();
  const t = useT();
  const { data: post, error, loading, reload } = useAsync(() => api.getPost(id), [id], api.peekPost(id));
  const [viewer, setViewer] = useState<number | null>(null);
  const [composer, setComposer] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reported, setReported] = useState(() => storage.hasReported(`case-${id}`));
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [pushOn, setPushOn] = useState(true); // assume on until we know, so the hint never flashes

  // Follow state lives on the server, per anonymous device. Nothing is created until the user taps Follow.
  useEffect(() => {
    if (!deviceStore.get()) {
      setFollowing(false);
      setPushOn(false);
      return;
    }
    let dead = false;
    api.follows().then((l) => !dead && setFollowing(l.some((f) => f.id === id))).catch(() => undefined);
    api.deviceMe().then((s) => !dead && setPushOn(s.push.subscribed)).catch(() => undefined);
    return () => {
      dead = true;
    };
  }, [id]);

  usePageMeta({
    title: post ? `${post.title} (${caseNo(post.id)})` : 'Case file',
    description: post?.excerpt,
    image: post?.images[0]?.large,
    path: `/case/${id}`,
    noindex: !post,
  });

  const items = useMemo(() => (post ? viewerItems(post.images, post.files) : []), [post]);

  // Structured data for search engines (a public case file is an anonymous forum-style post).
  useEffect(() => {
    if (!post) return;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = 'ld-case';
    el.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'DiscussionForumPosting',
      headline: post.title,
      articleBody: post.excerpt,
      datePublished: post.publishedAt ?? undefined,
      url: `${location.origin}/case/${post.id}`,
      inLanguage: 'en',
      keywords: [post.category?.name, ...post.tags].filter(Boolean).join(', '),
      author: { '@type': 'Organization', name: 'Anonymous contributor' },
      interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/CommentAction', userInteractionCount: post.commentCount },
      image: post.images[0]?.large,
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [post]);

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
    return <EmptyState icon="folder" title={t('This case file isn’t available')} message={t('It may still be under review, may have been withdrawn, or the link may be wrong.')} action={<Link to="/" className="btn-primary">{t('Back to case files')}</Link>} />;
  }
  if (error || !post) return <ErrorState message={error?.message ?? t('Could not load this case file.')} onRetry={reload} />;

  const mine = Boolean(storage.getPostKey(post.id));

  const toggleFollow = async () => {
    setFollowBusy(true);
    try {
      if (following) {
        await api.unfollow(post.id);
        setFollowing(false);
        toast('info', t('You will no longer get alerts about this case.'));
      } else {
        await api.follow(post.id);
        setFollowing(true);
        const s = await api.deviceMe().catch(() => null);
        setPushOn(s?.push.subscribed ?? false);
        toast('success', t('You are following this case. New statements will appear in your notifications.'));
      }
    } catch (e) {
      toast('error', (e as ApiError).message);
    } finally {
      setFollowBusy(false);
    }
  };

  const report = async () => {
    setBusy(true);
    try {
      const r = await api.reportPost(post.id);
      storage.markReported(`case-${post.id}`);
      setReported(true);
      setReporting(false);
      toast('success', r.hidden ? t('Thanks, this case was hidden and sent to a moderator.') : t('Thanks, your report was recorded.'));
      if (r.hidden) reload();
    } catch (e) {
      haptics.error();
      toast('error', (e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <Link to="/" className="chrome mb-4 hidden items-center gap-1 py-1 text-sm font-bold text-ink-soft lg:inline-flex">
        <Icon name="chevronLeft" size={18} /> {t('Case files')}
      </Link>

      <div>
        <div className="folder-tab ml-1"><Icon name="folder" size={13} /> {t('Case file')} · {caseNo(post.id)}</div>
        <div className="card relative rounded-tl-none border-folder-deep/70 bg-[#fffdf8] p-5 sm:p-7">
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6"><StatusBadge status="APPROVED" /></div>
          <h1 className="max-w-[82%] font-display text-[1.65rem] leading-tight font-bold sm:text-4xl">{post.title}</h1>
          {post.origin && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-folder px-3 py-1 text-xs font-bold text-[#7a5a14]">
              <Icon name="info" size={14} /> {post.origin === 'AI' ? t('Added and managed by DL-ai · compiled from public sources') : t('Written by the moderation team')}
            </p>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-dashed border-folder-deep py-4 sm:grid-cols-4">
            <Fact label={t('Filed')}>{formatDate(post.publishedAt)}</Fact>
            <Fact label={t('Case type')}>{post.category ? t(post.category.name) : t('Not specified')}</Fact>
            <Fact label={t('Exhibits')}>{post.images.length + post.files.length}</Fact>
            <Fact label={t('Statements')}>{post.commentCount}</Fact>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button className={cx('btn-secondary !min-h-11', following && '!border-brand-300 !bg-brand-50 !text-brand-800')} aria-pressed={following} onClick={toggleFollow} disabled={followBusy}>
              <Icon name={following ? 'check' : 'bell'} size={18} /> {following ? t('Following') : t('Follow this case')}
            </button>
            {following && !pushOn && <Link to="/notifications/settings" className="text-xs font-bold text-brand-700 underline underline-offset-4">{t('Turn on phone alerts')}</Link>}
          </div>
        </div>
      </div>

      <div className="xl:grid xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start xl:gap-8">
      <div>
      <section className="mt-6 page-in">
        <h2 className="mb-2 font-mono text-xs tracking-[0.14em] text-ink-soft uppercase">{t('Summary of events')}</h2>
        <div className="card p-5 sm:p-6"><div className="prose-plain text-[1.02rem]">{post.content}</div></div>
      </section>

      {post.images.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-mono text-xs tracking-[0.14em] text-ink-soft uppercase">{t('Exhibits')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {post.images.map((img, i) => (
              <button key={img.id} onClick={() => setViewer(i)} className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-black/10 bg-white p-1.5 text-left transition-transform duration-100 active:scale-[0.97]" aria-label={t('Open exhibit {x}', { x: String.fromCharCode(65 + i) })}>
                <img src={img.medium} srcSet={`${img.thumb} 480w, ${img.medium} 960w`} sizes="(min-width: 640px) 33vw, 50vw" alt={t('Exhibit {x}', { x: String.fromCharCode(65 + i) })} crossOrigin="anonymous" width={img.width} height={img.height} loading={i === 0 ? 'eager' : 'lazy'} decoding="async" className="h-full w-full rounded-xl object-cover" />
                <span className="absolute bottom-3 left-3 rounded-md bg-ink/85 px-2 py-0.5 font-mono text-[0.62rem] tracking-[0.12em] text-white uppercase">{t('Exhibit {x}', { x: String.fromCharCode(65 + i) })}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {post.files.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 font-mono text-xs tracking-[0.14em] text-ink-soft uppercase">{t('Documents')}</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {post.files.map((f, j) => <FileRow key={f.id} file={f} onOpen={() => setViewer(post.images.length + j)} />)}
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
        <p><strong>{t('Notice.')}</strong> {t('This is an anonymous, public-submitted case file that was reviewed by a moderator but not independently verified. If you believe it contains an error or private information, file a statement or report the case.')} {t('In an emergency call')} <strong>119</strong>.</p>
      </div>

      </div>
      <div>
      <PunishmentPoll postId={post.id} />

      <Statements postId={post.id} composerOpen={composer} setComposerOpen={setComposer} />
      </div>
      </div>

      {/* Fixed action bar on every screen size: add a statement, share, manage your case or report it */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-[#f8f4ea] px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:left-72">
        <div className="mx-auto flex max-w-lg gap-2 lg:max-w-5xl lg:px-7">
          <button className="btn-primary flex-1 lg:flex-none lg:px-8" onClick={() => setComposer(true)}><Icon name="chat" size={19} /> {t('Add statement')}</button>
          <ShareButton postId={post.id} title={post.title} excerpt={post.excerpt} />
          {mine ? (
            <Link to={`/edit/${post.id}`} className="btn-secondary !px-3.5" aria-label={t('Manage my case')}><Icon name="edit" size={20} /> <span className="hidden sm:inline">{t('Edit')}</span></Link>
          ) : (
            <button className="btn-secondary !px-3.5" disabled={reported} onClick={() => setReporting(true)} aria-label={reported ? t('Case reported') : t('Report this case')}>
              <Icon name="flag" size={20} /> <span className="hidden sm:inline">{reported ? t('Reported') : t('Report')}</span>
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={reporting}
        title={t('Report this case?')}
        message={t('Use this for false claims, abuse, threats or private personal details. After 10 reports a case is hidden and a moderator reviews it again.')}
        confirmLabel={t('Report case')}
        danger
        busy={busy}
        onConfirm={report}
        onClose={() => setReporting(false)}
      />
      <Viewer items={items} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
    </article>
  );
}

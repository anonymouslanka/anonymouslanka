import { useState } from 'react';
import { Icon } from './Icon';
import { Dialog, useToast } from './ui';

/** Shares only the public case URL (`/case/<publicId>`) — never keys or tokens. */
export function ShareButton({ postId, title, iconOnly = false }: { postId: string; title: string; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const url = `${location.origin}/case/${postId}`;
  const enc = encodeURIComponent;

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
      }
    }
    setOpen(true);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('success', 'Link copied.');
      setOpen(false);
    } catch {
      toast('error', 'Could not copy the link.');
    }
  };
  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm font-bold active:bg-black/5';

  return (
    <>
      <button className={iconOnly ? 'btn-secondary !px-3.5' : 'btn-secondary'} onClick={share} aria-label="Share this case">
        <Icon name="share" size={20} /> {!iconOnly && 'Share'}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Share this case file">
        <div className="-mx-1 space-y-1">
          <button className={item} onClick={copy}><Icon name="copy" size={19} /> Copy link</button>
          <a className={item} href={`https://wa.me/?text=${enc(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={19} /> WhatsApp</a>
          <a className={item} href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener noreferrer"><Icon name="share" size={19} /> Facebook</a>
          <a className={item} href={`https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer"><Icon name="share" size={19} /> X</a>
        </div>
      </Dialog>
    </>
  );
}

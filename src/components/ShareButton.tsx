import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { spring } from '../lib/motion';
import { useToast } from './ui';

/** Shares only the public post URL (`/post/<publicId>`) — never keys or tokens. */
export function ShareButton({ postId, title }: { postId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const url = `${location.origin}/post/${postId}`;
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
    setOpen((o) => !o);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('success', 'Link copied.');
    } catch {
      toast('error', 'Could not copy the link.');
    }
  };

  return (
    <div className="relative">
      <button className="btn-secondary" onClick={share} aria-haspopup="true" aria-expanded={open}>
        <span aria-hidden="true">↗</span> Share
      </button>
      <AnimatePresence>
      {open && (
        <motion.div role="menu" initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }} transition={spring} style={{ originY: 0 }} className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 text-sm shadow-xl">
          <button role="menuitem" className="w-full rounded-lg px-3 py-2 text-left hover:bg-stone-100" onClick={copy}>Copy link</button>
          <a role="menuitem" className="block rounded-lg px-3 py-2 hover:bg-stone-100" href={`https://wa.me/?text=${enc(`${title} ${url}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a role="menuitem" className="block rounded-lg px-3 py-2 hover:bg-stone-100" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
          <a role="menuitem" className="block rounded-lg px-3 py-2 hover:bg-stone-100" href={`https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`} target="_blank" rel="noopener noreferrer">X (Twitter)</a>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

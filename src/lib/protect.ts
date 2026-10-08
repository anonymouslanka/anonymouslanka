/**
 * Friction against casual copying and saving: no text selection, no right-click / long-press menus ("Save image"),
 * no dragging images out, no copy / cut, no Save / Print / View-source shortcuts. Form fields and anything marked
 * data-selectable stay normal.
 *
 * This is NOT a security boundary — whatever a screen shows can still be screenshotted — so nothing sensitive depends
 * on it. The real protection is server-side (private documents, signed image URLs, moderation, rate limits).
 */
const free = (target: EventTarget | null): boolean => target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], [data-selectable]') !== null;

export function installProtection(): void {
  const block = (e: Event) => {
    if (!free(e.target)) e.preventDefault();
  };
  for (const type of ['contextmenu', 'dragstart', 'selectstart', 'copy', 'cut']) document.addEventListener(type, block, true);
  document.addEventListener(
    'keydown',
    (e) => {
      if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'u'].includes(e.key.toLowerCase())) e.preventDefault();
    },
    true,
  );
}

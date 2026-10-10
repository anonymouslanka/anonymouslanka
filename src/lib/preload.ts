/**
 * Warms the page chunks right after the app is idle, so tapping a tab or the bell opens the page at once
 * instead of waiting for its code to download.
 */
const loaders = [
  () => import('../pages/Notifications'),
  () => import('../pages/MyCases'),
  () => import('../pages/Info'),
  () => import('../pages/CaseFile'),
  () => import('../pages/OpenCase'),
  () => import('../pages/NotificationSettings'),
];
let started = false;
export function preloadPages(): void {
  if (started) return;
  started = true;
  const run = () => loaders.forEach((l, i) => setTimeout(() => void l().catch(() => undefined), i * 150));
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (ric) ric(run, { timeout: 3000 });
  else setTimeout(run, 1500);
}

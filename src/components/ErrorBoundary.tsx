import { Component, ReactNode } from 'react';
import { t } from '../lib/i18n';
import { Icon } from './Icon';

/** Last line of defence: a render crash shows a friendly screen with a reload button instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(): void {
    /* nothing is logged or sent anywhere, the app collects no data about its users */
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center bg-paper p-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-600"><Icon name="alert" size={30} /></div>
          <h1 className="font-display text-2xl font-bold">{t('That did not load properly')}</h1>
          <p className="mt-2 text-sm text-ink-soft">{t('Something unexpected happened. Your saved cases and keys on this device are safe.')}</p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button className="btn-primary" onClick={() => location.reload()}>{t('Reload')}</button>
            <a className="btn-secondary" href="/">{t('Go home')}</a>
          </div>
        </div>
      </div>
    );
  }
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { installHaptics } from './lib/haptics';
import { I18nProvider } from './lib/i18n';
import { installProtection } from './lib/protect';

installHaptics();
installProtection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);

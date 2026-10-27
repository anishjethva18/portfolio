import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

// Remove the legacy PWA worker and its cache from previous deployments.
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.getRegistrations()
      .then(async (registrations) => {
        const appRegistrations = registrations.filter((registration) => {
          const workerUrl = registration.active?.scriptURL
            || registration.waiting?.scriptURL
            || registration.installing?.scriptURL;
          return workerUrl ? new URL(workerUrl).pathname === '/sw.js' : false;
        });
        await Promise.all(appRegistrations.map((registration) => registration.unregister()));
        await caches.delete('win11-os-v2');
      })
      .catch((error: unknown) => {
        console.error('Could not remove the legacy service worker:', error);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

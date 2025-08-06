import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

// Service Worker cleanup for development
async function unregisterAllServiceWorkers() {
  if (!('serviceWorker' in navigator)) return;

  try {
    // Unregister every SW
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(r => r.unregister()));

    // Delete every cache bucket
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
    console.info('[SW] All service-workers and caches cleared');
  } catch (err) {
    console.error('[SW] Error while clearing workers:', err);
  }
}

// Clear service workers in development mode
if (import.meta.env.DEV) {
  unregisterAllServiceWorkers();
}

// Initialize React app
const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

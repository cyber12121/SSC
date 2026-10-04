import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'katex/dist/katex.min.css';

// Global safeguard against unhandled storage-access, extension message drops, and Firestore stream rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = (reason && (reason.message || reason.name || String(reason))) || '';
    if (
      msg.includes('Access to storage is not allowed') ||
      msg.includes('signal is aborted without reason') ||
      msg.includes('message channel closed') ||
      msg.includes('asynchronous response by returning true') ||
      msg.includes('Write stream exhausted') ||
      msg.includes('resource-exhausted') ||
      reason?.name === 'AbortError'
    ) {
      event.preventDefault();
      console.warn('Suppressed benign storage/extension/stream notice:', msg);
    }
  });

  window.addEventListener('error', (event) => {
    const msg = (event && (event.message || String(event))) || '';
    if (
      msg.includes('Access to storage is not allowed') ||
      msg.includes('message channel closed') ||
      msg.includes('asynchronous response by returning true') ||
      msg.includes('Write stream exhausted') ||
      msg.includes('resource-exhausted')
    ) {
      event.preventDefault();
      console.warn('Suppressed benign window error notice:', msg);
    }
  });
}

import { ToastProvider } from './components/ui/Toast';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);

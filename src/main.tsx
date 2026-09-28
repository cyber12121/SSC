import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'katex/dist/katex.min.css';

// Global safeguard against unhandled storage-access and aborted signal rejections
// in restricted browser contexts (e.g. third-party cookie restrictions, incognito, iframes)
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = (reason && (reason.message || reason.name || String(reason))) || '';
    if (
      msg.includes('Access to storage is not allowed') ||
      msg.includes('signal is aborted without reason') ||
      reason?.name === 'AbortError'
    ) {
      event.preventDefault();
      console.warn('Suppressed benign storage/abort rejection:', msg);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

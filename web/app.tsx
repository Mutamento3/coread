import React from 'react';
import { createRoot } from 'react-dom/client';
import StudyApp from './StudyApp';

const root = createRoot(document.getElementById('root')!);
root.render(<StudyApp />);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/coread/service-worker.js', { scope: '/coread/' }).catch(() => {});
  });
}

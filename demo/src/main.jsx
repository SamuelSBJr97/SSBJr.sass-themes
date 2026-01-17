import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// PWA: registra service worker (gerado pelo vite-plugin-pwa)
import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

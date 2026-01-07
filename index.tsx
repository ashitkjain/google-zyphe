import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("Critical Failure: Root element not found in DOM.");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error("Render Error:", err);
    if (rootElement) {
      rootElement.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">Failed to render application. Check console for details.</div>`;
    }
  }
}
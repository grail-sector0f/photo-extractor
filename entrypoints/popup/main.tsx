// Entry point for the extension popup.
// WXT picks this up automatically because it lives in entrypoints/popup/
// and is referenced by index.html.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

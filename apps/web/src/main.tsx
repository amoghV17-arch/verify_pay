import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tokens.css';
import { AppRouter } from './router.js';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <AppRouter />
    </React.StrictMode>,
  );
}

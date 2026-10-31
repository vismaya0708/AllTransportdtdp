import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`)
    .catch(error => console.warn('Offline support unavailable:', error.message));
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Rejestracja Service Workera dla pełnej obsługi gry offline
if ('serviceWorker' in navigator && (import.meta as any).env?.PROD) {
  window.addEventListener('load', () => {
    const baseUrl = (import.meta as any).env?.BASE_URL || '/';
    navigator.serviceWorker.register(`${baseUrl}sw.js`)
      .then((reg) => {
        console.log('Service Worker zarejestrowany pomyślnie:', reg.scope);
      })
      .catch((err) => {
        console.error('Błąd rejestracji Service Workera:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

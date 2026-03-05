console.log("Renderer: main.jsx loaded");

window.addEventListener('error', (event) => {
  console.error("RENDERER ERROR:", event.error?.message || event.message);
  console.error("Stack:", event.error?.stack);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error("UNHANDLED PROMISE REJECTION:", event.reason);
});

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

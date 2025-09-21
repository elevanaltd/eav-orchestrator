// Context7: consulted for react
// Context7: consulted for react-dom/client
// Context7: consulted for @sentry/react
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize Sentry for error monitoring
import { initSentry } from './lib/monitoring/sentry'

// Initialize Sentry before React app
initSentry();

// Toggle StrictMode for testing - in production, always use StrictMode
const USE_STRICT_MODE = true; // Set to false to test without StrictMode

ReactDOM.createRoot(document.getElementById('root')!).render(
  USE_STRICT_MODE ? (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ) : (
    <App />
  ),
)
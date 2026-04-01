import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { inject } from '@vercel/analytics'
import App from './App.jsx'
import './index.css'

// Vercel Web Analytics – cookie-free, DSGVO-konform, erfasst alle Besucher
inject()

// Render immediately — don't block on Sentry (357 KB)
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
)

// Load Sentry after initial render (non-blocking, ~357 KB saved from critical path)
import('./lib/sentryInit.js')

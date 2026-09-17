import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { inject } from '@vercel/analytics'
import App from './App.jsx'
import './index.css'

// Vercel Web Analytics aggregates cookie-free page views. Strip query strings
// so campaign click IDs, search terms and checkout parameters are never sent.
inject({
  beforeSend(event) {
    try {
      const url = new URL(event.url)
      url.search = ''
      url.hash = ''
      return { ...event, url: url.toString() }
    } catch {
      return event
    }
  },
})

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

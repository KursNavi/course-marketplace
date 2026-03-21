import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import * as Sentry from '@sentry/react'
import { inject } from '@vercel/analytics'
import App from './App.jsx'
import './index.css'

// Vercel Web Analytics – cookie-free, DSGVO-konform, erfasst alle Besucher
inject()

Sentry.init({
  dsn: "https://439090a4b3545a20fa5da1db2fe87637@o4511039333859328.ingest.de.sentry.io/4511039348277328",
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
)

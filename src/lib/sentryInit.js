import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: "https://439090a4b3545a20fa5da1db2fe87637@o4511039333859328.ingest.de.sentry.io/4511039348277328",
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
})

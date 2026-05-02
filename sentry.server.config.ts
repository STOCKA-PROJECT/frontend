import * as Sentry from "@sentry/nuxt";
 
Sentry.init({
  dsn: "https://cdfe5037e8b45c2c960a7b4f539ca5b7@o4511302617464832.ingest.de.sentry.io/4511302622511184",

  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 1.0,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending of user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nuxt/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});

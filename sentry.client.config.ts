import * as Sentry from "@sentry/nuxt";
import { useRuntimeConfig } from "#imports";

// The DSN comes from NUXT_PUBLIC_SENTRY_DSN (see nuxt.config.ts): set on the production worker,
// absent in local development, where Sentry stays disabled.
const { sentryDsn, sentryEnvironment } = useRuntimeConfig().public;

Sentry.init({
  dsn: sentryDsn || undefined,
  enabled: !!sentryDsn,
  environment: sentryEnvironment,

  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 0.1,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // If the entire session is not sampled, use the below sample rate to sample
  // sessions when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Session Replay with PII masking: inputs, text and media are scrubbed
  // before leaving the browser so passwords and personal data never reach Sentry.
  integrations: [
    Sentry.replayIntegration({
      maskAllInputs: true,
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Do not send user PII (email, IP, user-agent) by default.
  // https://docs.sentry.io/platforms/javascript/guides/nuxt/configuration/options/#sendDefaultPii
  sendDefaultPii: false,

  // Strip auth/cookie material from every outgoing event as a last-line defense.
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      if (event.request.headers) {
        delete event.request.headers["Authorization"];
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
        delete event.request.headers["Cookie"];
      }
    }
    return event;
  },

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});

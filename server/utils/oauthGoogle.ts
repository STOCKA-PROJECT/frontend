import type { H3Event } from 'h3'
import { createError } from 'h3'

/**
 * Hides the Google OAuth BFF routes when the feature is off
 * ({@code NUXT_PUBLIC_OAUTH_GOOGLE_ENABLED}), the same way the backend answers 404.
 *
 * @throws 404 when sign-in with Google is disabled
 */
export function assertGoogleOAuthEnabled(event: H3Event): void {
  if (!useRuntimeConfig(event).public.oauthGoogleEnabled) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }
}

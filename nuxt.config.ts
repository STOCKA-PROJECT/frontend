// https://nuxt.com/docs/api/configuration/nuxt-config
const SITE_URL = process.env.NUXT_PUBLIC_SITE_URL ?? "https://stocka.es";
const SITE_NAME = "Stocka";
const API_BASE_URL = process.env.NUXT_API_BASE_URL ?? "http://localhost:9095";

const SECURITY_HEADERS = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.sentry.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  future: { compatibilityVersion: 4 },
  modules: [
    "@nuxtjs/i18n",
    "@nuxtjs/tailwindcss",
    "@pinia/nuxt",
    "@nuxt/eslint",
    "@sentry/nuxt/module",
  ],
  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    apiBaseUrl: API_BASE_URL,
    public: {
      siteUrl: SITE_URL,
      siteName: SITE_NAME,
    },
  },

  app: {
    head: {
      titleTemplate: (title?: string) =>
        title && title !== SITE_NAME ? `${title} · ${SITE_NAME}` : SITE_NAME,
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "preload",
          as: "style",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
          media: "print",
          onload: "this.media='all'",
        },
      ],
      meta: [
        { charset: "utf-8" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1, viewport-fit=cover",
        },
        { name: "theme-color", content: "#f4efe6" },
        { name: "format-detection", content: "telephone=no" },
        { name: "robots", content: "index, follow" },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: SITE_NAME },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    },
  },

  i18n: {
    strategy: "prefix_except_default",
    defaultLocale: "es",
    baseUrl: SITE_URL,
    locales: [
      { code: "es", language: "es-ES", name: "Español", file: "es.json" },
      { code: "ca", language: "ca-ES", name: "Català", file: "ca.json" },
      { code: "en", language: "en-US", name: "English", file: "en.json" },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "stocka_lang",
      redirectOn: "root",
      alwaysRedirect: false,
      fallbackLocale: "es",
    },
    compilation: {
      strictMessage: false,
      escapeHtml: false,
    },
  },

  nitro: {
    compressPublicAssets: true,
    routeRules: {
      "/**": {
        headers: SECURITY_HEADERS,
      },
      "/_nuxt/**": {
        headers: { "cache-control": "public, max-age=31536000, immutable" },
      },
    },
  },

  vite: {
    css: { devSourcemap: true },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  sentry: {
    org: "stocka",
    project: "stocka-frontend",
  },

  sourcemap: {
    client: "hidden",
  },
});

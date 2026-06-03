import { defineConfig } from "vitest/config";

/**
 * Vitest config for plain-TypeScript unit tests of the offline data/sync layer (`app/db`,
 * `app/sync`). These modules avoid Nuxt auto-imports so they run in a plain Node environment
 * without the Nuxt runtime. Component/store tests (which need the Nuxt/Vue runtime) are added
 * separately with @nuxt/test-utils.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.spec.ts"],
  },
});

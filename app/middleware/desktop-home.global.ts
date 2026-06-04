/**
 * Desktop target has no marketing/landing page — it is a dashboard-only app. On the desktop build
 * ({@code runtimeConfig.public.desktop}) any visit to the home route (`/`, including localized
 * roots) is redirected to the dashboard, so the landing page is never reachable. The web build is
 * unaffected and keeps showing the landing page at `/`.
 */
export default defineNuxtRouteMiddleware((to) => {
  const config = useRuntimeConfig();
  if (!config.public.desktop) {
    return;
  }
  const name = String(to.name ?? "");
  const isHome = name === "index" || name.startsWith("index___");
  if (isHome) {
    const localePath = useLocalePath();
    return navigateTo(localePath("/dashboard"));
  }
});

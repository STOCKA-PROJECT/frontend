const PUBLIC_PATHS = ["/"] as const;
const LOCALES = ["es", "ca", "en"] as const;
type Locale = (typeof LOCALES)[number];

const HREFLANG: Record<Locale, string> = {
  es: "es-ES",
  ca: "ca-ES",
  en: "en-US",
};

function urlFor(base: string, locale: Locale, path: string): string {
  const trimmed = path.replace(/\/+$/, "") || "";
  if (locale === "es") return `${base}${trimmed}` || base;
  return `${base}/${locale}${trimmed}`;
}

export default defineEventHandler((event) => {
  const config = useRuntimeConfig();
  const base = (
    (config.public.siteUrl as string) ?? "https://stocka.es"
  ).replace(/\/+$/, "");
  const lastmod = new Date().toISOString().slice(0, 10);

  const urls = PUBLIC_PATHS.map((path) => {
    const alternates = LOCALES.map(
      (loc) =>
        `<xhtml:link rel="alternate" hreflang="${HREFLANG[loc]}" href="${urlFor(base, loc, path)}" />`,
    ).join("");
    const xDefault = `<xhtml:link rel="alternate" hreflang="x-default" href="${urlFor(base, "es", path)}" />`;

    return LOCALES.map((loc) => {
      const loc_url = urlFor(base, loc, path);
      return `<url>
    <loc>${loc_url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${loc === "es" ? "1.0" : "0.9"}</priority>
    ${alternates}${xDefault}
  </url>`;
    }).join("\n  ");
  }).join("\n  ");

  setResponseHeader(event, "Content-Type", "application/xml; charset=utf-8");
  setResponseHeader(event, "Cache-Control", "public, max-age=3600");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  ${urls}
</urlset>`;
});

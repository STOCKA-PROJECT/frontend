# Stocka Desktop (Tauri 2)

Empaqueta la SPA de Nuxt como aplicación de escritorio offline-first para Windows y macOS.
Reutiliza la misma base de código que la web; el target de escritorio se construye en modo
SPA estático (`ssr: false`) mediante el entorno `desktop` de Nuxt. Ver el diseño en
`../docs/offline-sync/DESIGN.md`.

## Cómo funciona

- `pnpm generate:desktop` → `nuxt generate --envName desktop` produce una SPA estática en
  `.output/public` (sin SSR, sin BFF Nitro). El override vive en `$env.desktop` de
  `nuxt.config.ts`; **la web no se ve afectada**.
- Tauri sirve esa carpeta (`frontendDist: ../.output/public`) dentro del WebView nativo del SO.
- La SPA habla **directamente** con el backend (sin proxy `/api`); la URL del backend se expone
  vía `runtimeConfig.public.apiBaseUrl` solo en el target de escritorio.

## Comandos

```bash
# Desarrollo (arranca Nuxt en :3000 y abre la ventana Tauri)
pnpm tauri dev

# Build de producción (genera la SPA y empaqueta los instaladores)
pnpm tauri build
```

`pnpm tauri` está disponible vía el devDependency `@tauri-apps/cli`.

## Prerequisitos de build (parte nativa, Rust)

El binario nativo usa el **WebView del sistema operativo**:

- **macOS / Windows**: el WebView lo aporta el SO; no hace falta instalar nada extra (además de
  Rust). `pnpm tauri build` genera `.dmg`/`.app` (macOS) y `.msi`/`.exe` (Windows).
- **Linux (solo para CI/build)**: requiere `webkit2gtk-4.1`, `gtk+-3.0` y `libsoup-3.0`
  (p. ej. `libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev`).

> Nota: este repo de CI/contenedor no trae el WebView de Linux, por lo que el build nativo debe
> ejecutarse en macOS/Windows o en un runner Linux con esas librerías. El scaffold Rust es el
> estándar generado por `@tauri-apps/cli` y compila en esos entornos.

## Firma de código (hito posterior — `M-Dist`)

`pnpm tauri build` genera instaladores **sin firmar**, que funcionan para desarrollo y uso
interno. Para distribución pública:

- **macOS**: Apple Developer ID + `codesign` + notarización (`notarytool`) + staple.
- **Windows**: certificado de code-signing (CA / Azure Trusted Signing) + `signtool`.
- **Auto-update**: `pnpm tauri signer generate` (clave privada como secreto de CI, pública en
  `tauri.conf.json`).

Hasta entonces, en macOS el usuario abre con clic derecho → *Abrir* (Gatekeeper) y en Windows
acepta el aviso de SmartScreen.

## Pendiente para offline real (F1+)

- **Fuentes**: la UI carga Inter desde Google Fonts (CDN). Para funcionar 100% offline hay que
  **auto-alojar la fuente** en el target de escritorio (se abordará en F1).
- Capa de datos local (RxDB), motor de sync y almacenamiento seguro de tokens (keychain) se
  añaden en F1–F3 según el plan.

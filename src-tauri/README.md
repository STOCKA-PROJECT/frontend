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

## Almacenamiento seguro (keychain) y cifrado en reposo

- **Tokens de sesión**: se guardan en el llavero del SO (macOS Keychain / Windows Credential
  Manager / Secret Service en Linux) mediante los comandos Rust `keychain_save/load/clear`
  (crate `keyring`). El frontend los usa vía `TauriKeychainTokenStore` (`app/auth/tokenStore.ts`);
  fuera de Tauri degrada a memoria.
- **Base de datos local (RxDB/Dexie)**: los campos sensibles (nombres, nº de serie,
  descripciones, validadores, nombres de fichero y **bytes de los adjuntos en cola**, payloads del
  outbox) se cifran en reposo con una clave por máquina guardada en el llavero (entrada `db_key`,
  generada al primer arranque). Ver `app/db/encryptionKey.ts` y `app/db/database.ts` (R29).

## Firma de código y auto-update (`M-Dist`)

La infraestructura está lista: `tauri.conf.json` activa `bundle.createUpdaterArtifacts` y
`plugins.updater`, el plugin `tauri-plugin-updater` está registrado, y el workflow
`.github/workflows/desktop-release.yml` construye, firma, notariza y publica releases para macOS
(universal) y Windows en cada tag `v*`.

Pasos para activarla (requiere cuentas/certificados externos):

1. `pnpm tauri signer generate` → pega la **clave pública** en
   `tauri.conf.json` → `plugins.updater.pubkey` y guarda la **privada** + password como secretos
   `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
2. **macOS**: Apple Developer ID + notarización vía los secretos `APPLE_*` (los consume
   `tauri-action`: `codesign` + `notarytool` + staple).
3. **Windows**: certificado de code-signing (CA / Azure Trusted Signing) + `signtool`.
4. Sirve los artefactos del updater (`latest.json` + binarios firmados) en el endpoint configurado
   (`https://releases.stocka.es/desktop/...`).

Sin esos secretos el workflow sigue construyendo, pero genera artefactos **sin firmar**: en macOS
el usuario abre con clic derecho → *Abrir* (Gatekeeper) y en Windows acepta el aviso de SmartScreen.

> Falta solo el disparador de "buscar actualizaciones" en la UI, que necesita el paquete JS
> `@tauri-apps/plugin-updater`; el resto del canal de actualización ya está cableado.

## Pendiente para offline real

- **Fuentes**: la UI carga Inter desde Google Fonts (CDN). Para funcionar 100% offline conviene
  **auto-alojar la fuente** en el target de escritorio.

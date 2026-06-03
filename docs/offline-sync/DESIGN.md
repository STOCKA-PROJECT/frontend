# Stocka Frontend — Companion de diseño: escritorio offline-first (Tauri 2 + RxDB)

> Estado: **borrador para revisión** · Rama: `claude/desktop-app-offline-sync-xFg76`
> El diseño **autoritativo y completo** (protocolo de sync, cambios de backend, modelo de
> datos) vive en `backend/docs/offline-sync/DESIGN.md`. Este documento cubre los detalles
> específicos del **frontend Nuxt** y del **empaquetado de escritorio con Tauri 2**.

## 1. Punto de partida real (verificado en código)

El frontend **no** es un starter: es una app de inventario completa.

- Nuxt **4.4** (`app/` source dir), Vue 3.5, Pinia 3, vue-router, `@nuxtjs/i18n` (es/ca/en,
  `prefix_except_default`), `@nuxtjs/tailwindcss`, `@nuxt/eslint`, **Sentry**.
- **21 páginas**, **76 componentes**, **12 stores Pinia**, **13 composables**, 2 middlewares
  globales (`auth.global.ts`, `resolve-org-slug.global.ts`).
- `nuxt.config.ts`: SSR por defecto (web), `runtimeConfig.apiBaseUrl`
  (`NUXT_API_BASE_URL`, default `http://localhost:9095`), CSP/headers de seguridad en Nitro,
  i18n con cookie `stocka_lang`.
- **`app/composables/useApi.ts`**: wrapper sobre `ofetch` contra `/api`, con **refresh de
  token automático** (mutex anti-estampida en 401, reintento tras refresh), cabecera
  `Accept-Language`, y forwarding de cookies en SSR.
- **`app/stores/auth.ts`**: login/2FA/signup/verify/forgot/reset/logout, `fetchMe`, sesión en
  cookies httpOnly (`stocka_user`, `stocka_token`) puestas por el **servidor Nuxt**.
- Stores de dominio: `pieces`, `locations`, `pieceTypes`, `organizationPieceAttributes`,
  `organizations`, `ports`, `team`, etc. → **hoy llaman a la API vía `useApi`**.

**Implicación clave**: para offline-first, los stores de dominio deben pasar a **leer/escribir
RxDB** en lugar de llamar a `useApi` directamente. `useApi` queda reservado para auth y para el
motor de sync.

## 2. Coexistencia web + escritorio (sin borrar la web)

Una sola base de código, **dos targets de build**:

| Target | Cómo | Auth | Datos |
|--------|------|------|-------|
| **Web** (actual) | `nuxt build` (SSR) / despliegue como hoy | cookies httpOnly vía proxy Nuxt `/api` | online contra REST; *(PWA offline opcional en F4)* |
| **Escritorio** | `nuxt generate`/SPA (`ssr: false`) empaquetado en Tauri | **bearer token en keychain** (sin servidor Nuxt) | **RxDB local** + motor de sync |

El *switch* se hace por **variable de entorno de build** (p. ej. `STOCKA_TARGET=desktop`) que:
- fuerza `ssr: false` y preset estático en una config derivada (`nuxt.config.desktop.ts` que
  extiende la actual, sin tocar la web),
- activa los plugins/composables de RxDB y sync,
- cambia la **estrategia de auth** de `useApi` (cookie → bearer+keychain).

> Regla: **no duplicar** componentes ni páginas. Solo cambia la **capa de datos** debajo de los
> stores y la **estrategia de auth** dentro de `useApi`.

## 3. Estructura nueva en el frontend

```
frontend/
├── src-tauri/                      # proyecto Tauri 2 (Rust shell, config, updater, firma)
│   ├── tauri.conf.json
│   ├── capabilities/               # allowlist de permisos (fs, http, keychain)
│   └── src/                        # comandos nativos mínimos (FS adjuntos, keychain)
├── nuxt.config.ts                  # web (sin cambios de comportamiento)
├── nuxt.config.desktop.ts          # extiende la anterior: ssr:false, preset estático
└── app/
    ├── db/
    │   ├── database.ts             # createRxDatabase + addCollections
    │   └── schema/                 # esquemas JSON RxDB (pieces, locations, pieceTypes, …)
    ├── sync/
    │   ├── replication.ts          # pull/push handlers contra /sync/*
    │   ├── outbox.ts               # cola de mutaciones offline
    │   ├── attachments.ts          # subida/caché LRU de binarios (FS Tauri)
    │   └── useSync.ts              # composable: estado online, progreso, conflictos
    ├── data/
    │   └── repositories/           # capa que los stores consumen (RxDB-backed)
    └── stores/                     # Pinia: pasan a usar repositories en vez de useApi
```

## 4. Capa de datos: RxDB + Dexie

- `createRxDatabase({ storage: getRxStorageDexie() })` → IndexedDB en el WebView (cero plugins
  nativos en F1–F2; portable a PWA en F4).
- Una **colección por tipo de documento** (ver esquemas en el diseño backend §6): `pieces`,
  `locations`, `pieceTypes`, `pieceTypeAttributes`, `orgAttributes`, `attachmentsMeta`, más
  colecciones de control `outbox`, `syncState`, `blobCache`.
- **Identidad por `syncId` (UUID)** generado en cliente con `crypto.randomUUID()` al crear
  cualquier entidad offline (ver problema de PKs autoincrementales en el diseño backend §4).
- **Reactividad**: las queries RxDB son observables → se exponen a Pinia/Vue como `ref`s. Los
  componentes existentes (`PiecesTable`, `LocationsTree`, etc.) **no cambian**: siguen leyendo
  del store; solo cambia la fuente del store.

### Patrón de store (antes → después)

```ts
// ANTES: stores/pieces.ts llama a la API
const data = await useApi(`/organizations/${slug}/pieces`)

// DESPUÉS: el store observa RxDB (escritura inmediata, sync en segundo plano)
const pieces = pieceRepository.observeList(slug, filters) // RxQuery → ref reactivo
async function createPiece(input) {
  const doc = { syncId: crypto.randomUUID(), rev: null, _localDirty: true, ...input }
  await pieceRepository.upsert(doc)   // escribe RxDB + encola en outbox; UI instantánea
}
```

## 5. Motor de sync (cliente)

Replicación a medida apoyada en el protocolo RxDB (pull con checkpoint + push + LWW), contra
los endpoints nuevos del backend:

- **Pull**: `GET /organizations/{slug}/sync/changes?since={checkpointsPorColección}` → aplica
  cambios en orden de dependencia (`pieceTypes → pieceTypeAttributes → locations →
  orgAttributes → pieces → attachmentsMeta`), guarda `checkpoint` en `syncState`, repite si
  `hasMore`.
- **Push**: drena `outbox` en lotes ordenados por dependencia →
  `POST /organizations/{slug}/sync/mutations` con `mutationId` idempotente y `baseRev`. Procesa
  resultados: `applied`/`duplicate` → fija `rev` y limpia dirty; `conflict` → reconcilia con el
  `serverDoc` (LWW, ya resuelto por el server); `rejected` → revierte y notifica (toast).
- **Disparadores**: al recuperar conectividad (`navigator.onLine` / evento Tauri), tras cada
  escritura local (debounced), y por polling de respaldo.
- **Backoff** en errores de red/5xx (2s, 4s, 8s, 16s); 4xx de validación no se reintentan.

## 6. Autenticación en escritorio

Hoy la sesión vive en **cookies httpOnly** que pone el **servidor Nuxt** (proxy `/api`). En la
SPA de escritorio **no hay servidor Nuxt**, así que:

- `useApi` gana una **estrategia por target**:
  - **web**: como ahora (cookies httpOnly + proxy `/api`).
  - **escritorio**: base URL **absoluta** al backend (`apiBaseUrl`), `Authorization: Bearer`,
    y **refresh token guardado en el keychain del SO** vía plugin seguro de Tauri (no en
    `localStorage`).
- El backend debe **aceptar el refresh token por header/body** además de por cookie y permitir
  por **CORS** el origin de la app (`tauri://localhost`/esquema custom). *(Cambio menor en el
  endpoint `/auth/refresh`; detallado en el diseño backend §10.)*
- **Sesión offline**: con access token caducado y sin red, la app sigue operando contra RxDB; al
  volver la red, se refresca. Si el refresh token caducó (>7/30 días offline), se pide re-login
  conservando el `outbox`.

La lógica de refresh con **mutex anti-estampida** que ya existe en `useApi` se reutiliza tal
cual; solo cambia *dónde* se leen/escriben las credenciales.

## 7. Adjuntos en escritorio

- Subida offline → fichero en `appLocalDataDir/attachments/{syncId}` (comando Tauri FS),
  `attachmentsMeta` con `uploadState=PENDING_UPLOAD`, encolado en outbox.
- Online → subida al backend (multipart o presigned PUT a R2), se fija `r2Key`,
  `uploadState=UPLOADED`.
- Descarga on-demand vía `…/attachments/{aid}/download` (302 → presigned) y **caché LRU** en
  `blobCache` con tope de tamaño configurable.
- Los componentes `PieceAttachmentsPanel` / `ImageLightbox` resuelven la imagen desde la caché
  local si existe, si no la piden y la cachean.

## 8. Empaquetado, firma y updates (Tauri 2)

- `src-tauri/tauri.conf.json`: `build.frontendDist` apunta al output estático del Nuxt
  desktop; `beforeBuildCommand` = `STOCKA_TARGET=desktop pnpm generate`.
- **Permisos mínimos** (capabilities): FS limitado a `appLocalDataDir`, HTTP solo al backend,
  plugin de keychain; sin shell, sin FS global.
- **Firma**: Authenticode en Windows, **notarización** en macOS (requisito del updater).
- **Auto-update**: updater de Tauri con canal estable + endpoint de releases (CI publica los
  artefactos firmados por plataforma).
- **CI**: matриз Win/macOS que ejecuta `pnpm install` → build desktop → `tauri build` → firma →
  publica release. (Pipeline a definir en F0.)

## 9. Impacto en lo existente (qué cambia y qué no)

| Área | Cambia | No cambia |
|------|--------|-----------|
| Componentes (76) | — | Se reutilizan tal cual |
| Páginas (21) | — | Routing y vistas intactas |
| Stores Pinia (12 dominio) | Fuente de datos: `useApi` → repositories RxDB | API pública del store hacia los componentes |
| `useApi` | Estrategia de auth por target (cookie vs bearel/keychain) | Lógica de refresh con mutex |
| `nuxt.config` | Nuevo `nuxt.config.desktop.ts` que extiende | La config web actual |
| Middlewares | `auth.global` consulta sesión local en desktop | Guard de rutas |

## 10. Plan de fases (vista frontend)

- **F0**: `src-tauri/` + `nuxt.config.desktop.ts` + la app actual arrancando en una ventana
  Tauri en Win/Mac; pipeline de build/firma/updater.
- **F1**: `app/db` + `app/sync` (solo pull) + repositories; stores de **lectura** pasan a RxDB;
  caché de adjuntos. La app se puede **consultar** sin red.
- **F2**: outbox + push + `useSync` (estados pending/syncing/conflict en UI); stores de
  **escritura** a RxDB. La app permite **crear/editar/borrar** sin red.
- **F3**: cifrado en reposo, auth offline/keychain, backpressure, telemetría de sync (Sentry).
- **F4**: misma SPA como **PWA** → offline en la web reusando la capa de sync.

## 11. Skills a aplicar al implementar

Conforme a `frontend/CLAUDE.md`, antes de tocar código cargar:
`vue-best-practices`, `nuxt`, `vue-pinia-best-practices` (stores), `vue-router-best-practices`
(middlewares/guards), `create-adaptable-composable` (`useSync` y composables de sync),
`vue-testing-best-practices` (tests Vitest/VTU del motor de sync y repositories).

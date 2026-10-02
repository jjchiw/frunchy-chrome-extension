# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Frunchy: a Chrome extension (Manifest V3) that scrapes a user's Crunchyroll watch history. Built with Svelte 5, TypeScript 6, Vite 8 and `@crxjs/vite-plugin` 2.x (Node >= 22.12). It started from the `chrome-extension-svelte-typescript-boilerplate` template; `README.md` and the `get_started*` icons are still the boilerplate's. It is part of a larger `FrunchyWrapper` workspace; sibling directories (`../FrunchyBackend`, `../browser-extension-sutil`, `../test-read-json`) are separate projects.

## Commands

```bash
npm i              # install
npm run dev        # Vite + CRXJS dev build into dist/ with HMR for extension pages and content scripts
npm run build      # production build into dist/
npm run check      # svelte-check type checking (the only "test" step; CI runs build + check on Node 22)
```

There is no test suite or linter. To try the extension, load `dist/` as an unpacked extension at `chrome://extensions` (Developer mode), then open `https://www.crunchyroll.com/history`.

## Architecture

`manifest.json` is the source of truth for entry points. CRXJS reads it in `vite.config.ts` and bundles every file it references, so a new entry point (content script, page, worker, web-accessible resource) is added by referencing it in the manifest, not in the Vite config.

How the scraping data moves through the extension. This only makes sense across several files:

1. **Page-world hook** `public/injected.js` (plain JS, copied to `dist/` as is) is registered by the service worker with `chrome.scripting.registerContentScripts` (`world: "MAIN"`, `runAt: "document_start"`), so it patches `XMLHttpRequest.prototype` before Crunchyroll's scripts run. It `window.postMessage`s `{ type: "frunchyroll", url, responseText }` for `watch-history` responses, and `{ type: "frunchyroll-profile", profileId, … }` from `/auth/v1/token` (`profile_id`) and `/accounts/v1/me/multiprofile` (`is_selected`). It must never copy the tokens in the token response; only ids and the profile name leave it.
2. **Content script** `src/content/index.ts` runs on every `www.crunchyroll.com` page from `document_start` (Crunchyroll is an SPA, so the history page is often reached without a page load) and drives auto-scrolling (`SCROLL_DOWN` / `SCROLL_STOP` / `SCROLL_STATUS` from the popup; only honoured on a `/history` path). It says `frunchyroll-hello` on load so the hook re-sends a profile it saw earlier.
3. The **content script** turns each history response into a page `{ url, capturedAt, profileId, body }` (body verbatim; pages wait until the profile is known) and sends `PAGE_CAPTURED` to the background. The reply says whether the page reached the stop marker, which ends scrolling. When a scrape ends it sends `RUN_END` with the reason (`end` / `marker` / `user`).
4. **Background** `src/background/service-worker.ts` stores the page (`src/storage.ts`) and, when a sync key is set, queues it for upload (`src/sync.ts`). It also handles `SYNC_STORED` (queue every stored page) and `SETTINGS_CHANGED`, and retries on a `chrome.alarms` alarm, since the service worker is suspended between events.
5. **UI**: `src/popup` mounts `src/components/Popup.svelte` (scrape summary, sync status, last import status polled from the backend, Scrap/Stop, Sync stored pages, Download JSON, Clear). `src/options` mounts `src/components/Settings.svelte` (backend URL + sync key, validated with `GET /api/me`; it requests host permission for a non-default backend origin).

Persisted state, all in `chrome.storage.local` (`unlimitedStorage`; a full history is tens of MB):
- `src/storage.ts`: scraped pages under `page:<profileId> <request url>` (the URL only names the Crunchyroll account, and its profiles request identical URLs; re-capturing replaces the page), the last seen `crunchyrollProfile`, plus an `index` key with per-page stats, so the popup can summarise without loading page bodies. Crunchyroll's `page` query param is an opaque cursor, not a number.
- `src/settings.ts`: `settings` `{ baseUrl, syncKey }` (default backend `http://localhost:5099`).
- `src/sync.ts`: the upload queue (`upload:<page id>` + `uploadQueue` retry bookkeeping) and `sync` state (`marker`, `lastImport`, `lastError`, `lastRejectionAt`).

Backend contract (`src/api.ts`) is FrunchyBackend's `specs/001-crunchyroll-history-import/contracts/import-api.md`: `Authorization: Bearer <syncKey>`, `POST /api/imports` with `{ exportedAt?, profileId, pages: [ { url, body, capturedAt? } ] }` (v1.2: `profileId` is required; the extension sends it top-level and strips it from pages) (the Download JSON format, so an export can be uploaded unchanged), `GET /api/imports/{id}`, `GET /api/me`, errors as `{ error, message }`. Sync rules that are easy to break:
- Retry only 5xx and network errors (backoff 30 s → 30 min). `unauthorized` pauses the whole queue until settings are saved again; any other 4xx drops that page.
- Pages without a `profileId` are stored but never queued.
- The stop marker is per Crunchyroll profile and only advances when a scrape ends by `end` or `marker` with no rejection since the history tab loaded, so a scrape stopped by the user can't make the next one skip older history. Saving a different backend URL or key resets it.

UI strings are localized with `chrome.i18n` (`public/_locales/{en,es}/messages.json`, helper `src/i18n.ts`); error codes map to `err_<code>` messages.

## Conventions and gotchas

- Import from the project root with the `src/...` alias (defined in `vite.config.ts` and `tsconfig.json` `paths`), for example `import { storage } from "src/storage"`.
- TypeScript is `strict` (from `@tsconfig/svelte` 5) with `verbatimModuleSyntax`, so type-only imports need `type`. Chrome typings come from `"types": ["chrome"]` in `tsconfig.json`; TS 6 no longer loads `@types/*` automatically.
- Svelte components use Svelte 5 runes (`$state`, `$derived`, `onclick`); mount them with `mount()` from `svelte`, not `new Component()`.
- Keep entry-point file names unique (`service-worker.ts`, not a second `index.ts`): with two `index.ts` entries, CRXJS pointed `service-worker-loader.js` at the content-script chunk, so the worker crashed on `document` and never handled messages. After a build, check that `dist/service-worker-loader.js` imports `service-worker.ts-*.js`.
- Stay on `@crxjs/vite-plugin` >= 2.x: older betas emitted `use_dynamic_url: true`, which made Chrome deny content-script chunk imports.
- `.private/` (gitignored) holds a longer reference version of `injected.js` that also captures request bodies and headers.

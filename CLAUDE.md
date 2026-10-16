# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Frunchy: a Chrome extension (Manifest V3) that scrapes a user's Crunchyroll watch history. Built with Svelte 5, TypeScript 6, Vite 8 and `@crxjs/vite-plugin` 2.x (Node >= 22.12). It started from the `chrome-extension-svelte-typescript-boilerplate` template; `README.md` is still the boilerplate's. It is part of a larger `FrunchyWrapper` workspace; sibling directories (`../FrunchyBackend`, `../browser-extension-sutil`, `../test-read-json`) are separate projects.

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
5. **UI**: `src/popup` mounts `src/components/Popup.svelte`, 380px wide; Chrome caps a popup at 600px tall, and every state must fit without scrolling, Spanish included. The tallest case (tab needs a reload, a sync error, pages waiting, an import line, in Spanish) measures 594px, so re-check that state after adding or lengthening any text in the main card. It has one main card whose single button follows the active tab: open history, reload the tab (no content script answered), Scrape, or Stop. Under it are the sync status and the last import, polled from the backend. Then come the 3 newest stored episodes (`storage.getRecent`, which loads only the pages holding them), each marked synced (`sent`), waiting (in the upload queue) or stored. The footer has the Dashboard and Anime DNA links and the Sync stored pages, Download JSON and Clear icon actions; Clear confirms inline, not with `confirm()`. `src/options` mounts `src/components/Settings.svelte`: backend URL with "Use default", and a sync key with show/hide and a link to the site's "Connect extension". Both are validated with `GET /api/me` (it requests host permission for a non-default backend origin), and a successful check links to the dashboard.

Persisted state, all in `chrome.storage.local` (`unlimitedStorage`; a full history is tens of MB):
- `src/storage.ts`: scraped pages under `page:<profileId> <request url>` (the URL only names the Crunchyroll account, and its profiles request identical URLs; re-capturing replaces the page), the last seen `crunchyrollProfile`, plus an `index` key with per-page stats, so the popup can summarise without loading page bodies. Crunchyroll's `page` query param is an opaque cursor, not a number.
- `src/settings.ts`: `settings` `{ baseUrl, syncKey }` (default backend `http://localhost:5099`).
- `src/sync.ts`: the upload queue (`upload:<page id>` + `uploadQueue` retry bookkeeping) and `sync` state (`marker`, `lastImport`, `lastError`, `lastRejectionAt`, `sent`).

`storage.ts` and `sync.ts` serialize their read-modify-write cycles with a module-level promise chain, which only covers one extension context. The popup and options pages also call `syncState.update`, so their writes can still race the service worker's.

Backend contract (`src/api.ts`, v1.4) is FrunchyBackend's `specs/001-crunchyroll-history-import/contracts/import-api.md`: `Authorization: Bearer <syncKey>`, `POST /api/imports` with `{ exportedAt?, profileId, pages: [ { url, body, capturedAt? } ] }` (v1.2: `profileId` is required; the extension sends it top-level and strips it from pages) (the Download JSON format, so an export can be uploaded unchanged), `GET /api/imports/{id}`, `GET /api/me`, errors as `{ error, message }`. The extension may link only to the website pages the contract lists, built from the backend URL in `webPages`: `/account` (for `history_owner_mismatch` / `history_owner_taken`), `/account/key`, and `/u/{username}/dna` with `username` from `/api/me`. Sync rules that are easy to break:
- Retry only 5xx and network errors (backoff 30 s → 30 min). `unauthorized` pauses the whole queue until settings are saved again; any other 4xx drops that page.
- Pages without a `profileId` are stored but never queued.
- The newest history page is re-captured on every history page load, so `enqueue` skips a page whose body SHA-256 matches `sent[pageId]` (recorded when the backend accepts it). `SYNC_STORED` passes `force: true` and always resends.
- The stop marker is per Crunchyroll profile and only advances when a scrape ends by `end` or `marker` with no rejection since the history tab loaded, so a scrape stopped by the user can't make the next one skip older history. Saving a different backend URL or key resets the marker, `lastImport`, `lastRejectionAt` and `sent`, because it counts as a different Frunchy user.

UI strings are localized with `chrome.i18n` (`public/_locales/{en,es}/messages.json`, helper `src/i18n.ts`, which also formats dates and relative times in the browser's language); error codes map to `err_<code>` messages. Spanish uses "tú"; names shared with the website ("Dashboard", "Anime DNA" / "ADN anime", "Connect extension") match FrunchyBackend's `Views/Texts.fs`.

Design: `src/styles/tokens.css` holds the design tokens shared with the website. Their names and values match FrunchyBackend's `Views/Theme.fs`, and its `DesignSystemTests` fail if a shared value here differs, so tell the backend before changing one. Take any new token's name and value from `Theme.fs`. The system is Night Broadcast (`../FrunchyBackend/design/night_broadcast/DESIGN.md`). Colour roles: amber (`primary`) is the user and the primary action, lilac (`tertiary`) is tags and neutral attention such as the profile pill, waiting uploads and an import in progress, a completed import is amber, rose (`secondary`) is a warning such as a failed import, and coral (`error`) is an error. Fills are solid, never gradients; buttons, icon buttons and pills are fully rounded; cards use `radius-lg` with no border or shadow. Write a tint as `rgb(from var(--color-X) r g b / a)`. `src/styles/base.css` (fonts, focus ring, reduced motion) is imported by both entry points. Product context for design work is in `PRODUCT.md`; the impeccable skill (`.github/skills/impeccable/`) keeps the popup's design brief in `.impeccable/surfaces/`. Show only data the extension really has: no levels, trends, versions or invented numbers.

## Conventions and gotchas

- Import from the project root with the `src/...` alias (defined in `vite.config.ts` and `tsconfig.json` `paths`), for example `import { storage } from "src/storage"`.
- TypeScript is `strict` (from `@tsconfig/svelte` 5) with `verbatimModuleSyntax`, so type-only imports need `type`. Chrome typings come from `"types": ["chrome"]` in `tsconfig.json`; TS 6 no longer loads `@types/*` automatically.
- Svelte components use Svelte 5 runes (`$state`, `$derived`, `onclick`); mount them with `mount()` from `svelte`, not `new Component()`.
- Keep entry-point file names unique (`service-worker.ts`, not a second `index.ts`): with two `index.ts` entries, CRXJS pointed `service-worker-loader.js` at the content-script chunk, so the worker crashed on `document` and never handled messages. After a build, check that `dist/service-worker-loader.js` imports `service-worker.ts-*.js`.
- Stay on `@crxjs/vite-plugin` >= 2.x: older betas emitted `use_dynamic_url: true`, which made Chrome deny content-script chunk imports.
- Spec Kit is set up locally (`.specify/`, `speckit-*` skills; untracked), but `.specify/memory/constitution.md` is still the unfilled template. The import feature's spec and contract are in `../FrunchyBackend/specs/`.
- Fonts and icons are bundled, never loaded remotely: Figtree from `@fontsource-variable/figtree`, Bricolage Grotesque for headings and the wordmark from `@fontsource/bricolage-grotesque` (static 700 and 800, because `--font-display` must name exactly `"Bricolage Grotesque"`, which the variable package doesn't register), IBM Plex Mono 500 from `@fontsource/ibm-plex-mono`, and Material Symbols SVGs imported with `?raw` into `src/components/Icon.svelte` (add a name there to use a new icon).
- The extension icons (`src/assets/icons/frunchy{16,32,48,128}.png`) are rendered from `src/assets/brand/frunchy-icon.svg`, the shared mark `frunchy-mark.svg` on a dark `#13111a` tile so it shows on light toolbars: `rsvg-convert -w <size> -h <size> frunchy-icon.svg` from that directory.
- `.impeccable/review/` (gitignored) holds design review screenshots; they show real watch history, so they must stay out of this public repo.
- `.private/` (gitignored) holds a longer reference version of `injected.js` that also captures request bodies and headers.

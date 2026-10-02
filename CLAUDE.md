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

1. **Content script** `src/content/index.ts` runs on every `www.crunchyroll.com` page from `document_start` (Crunchyroll is an SPA, so the history page is often reached without a page load); `SCROLL_DOWN` is only honoured on a `/history` path. It injects `src/content/injected.js` into the page as a `<script>` tag (using `chrome.runtime.getURL`).
2. **Page-context script** `src/content/injected.js` runs in the page's own JS world, not the extension's isolated world. That lets it monkey-patch `XMLHttpRequest.prototype` and see Crunchyroll's own API calls. When a URL containing `watch-history` loads, it `window.postMessage`s `{ type: "frunchyroll", url, responseText }`. It is plain JS (`// @ts-nocheck`) and must be listed in `web_accessible_resources`, or the injection fails.
3. Back in the **content script**, a `window` `message` listener parses the JSON and stores the page via `storage.addPage` (`{ url, capturedAt, body }`, body verbatim).
4. **UI**: `src/popup` and `src/options` both mount the same `src/components/Options.svelte`. It shows a summary (pages, entries, date range) refreshed on `chrome.storage.onChanged`, and offers Scrap/Stop, Download JSON and Clear. Scrap/Stop/status go to the active tab as `{ message: "SCROLL_DOWN" | "SCROLL_STOP" | "SCROLL_STATUS" }`; the content script broadcasts `SCROLL_STATE` when scrolling starts or ends. Scrolling to the bottom of the history page makes Crunchyroll load more pages, which fire more `watch-history` XHRs. On `SCROLL_DOWN`, the content script's `scrollDown()` scrolls to the bottom every 2s and stops once the page height has stayed the same for 3 checks in a row.
5. **Background** `src/background/index.ts` is a service worker that only logs storage when the extension is installed.

`src/storage.ts` owns all persisted state, in `chrome.storage.local` (`unlimitedStorage`; a full history is tens of MB). Each page is stored under `page:<request url>` (re-capturing a URL replaces it), and a small `index` key holds per-page stats so the popup can summarise without loading page bodies. Crunchyroll's `page` query param is an opaque cursor, not a number.

## Conventions and gotchas

- Import from the project root with the `src/...` alias (defined in `vite.config.ts` and `tsconfig.json` `paths`), for example `import { storage } from "src/storage"`.
- TypeScript is `strict` (from `@tsconfig/svelte` 5) with `verbatimModuleSyntax`, so type-only imports need `type`. Chrome typings come from `"types": ["chrome"]` in `tsconfig.json`; TS 6 no longer loads `@types/*` automatically.
- Svelte components still use legacy (non-runes) syntax such as `on:click` and `let` state; mount them with `mount()` from `svelte`, not `new Component()`.
- Stay on `@crxjs/vite-plugin` >= 2.x: older betas emitted `use_dynamic_url: true`, which made Chrome deny content-script chunk imports.
- `.private/` (gitignored) holds a longer reference version of `injected.js` that also captures request bodies and headers.

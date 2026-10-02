# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Chrome extension (Manifest V3) that scrapes a user's Crunchyroll watch history. It started from the `chrome-extension-svelte-typescript-boilerplate` template (Svelte 3 + TypeScript + Vite 3 + `@crxjs/vite-plugin`), so `README.md`, `package.json` and `manifest.json` still use the boilerplate names. It is part of a larger `FrunchyWrapper` workspace; sibling directories (`../FrunchyBackend`, `../browser-extension-sutil`, `../test-read-json`) are separate projects.

## Commands

```bash
npm i              # install
npm run dev        # Vite + CRXJS dev build into dist/ with HMR for extension pages and content scripts
npm run build      # production build into dist/
npm run check      # svelte-check type checking (the only "test" step; CI runs build + check on Node 16)
```

There is no test suite or linter. To try the extension, load `dist/` as an unpacked extension at `chrome://extensions` (Developer mode), then open `https://www.crunchyroll.com/history`.

## Architecture

`manifest.json` is the source of truth for entry points. CRXJS reads it in `vite.config.ts` and bundles every file it references, so a new entry point (content script, page, worker, web-accessible resource) is added by referencing it in the manifest, not in the Vite config.

How the scraping data moves through the extension. This only makes sense across several files:

1. **Content script** `src/content/index.ts` runs only on the Crunchyroll history pages listed in `content_scripts.matches`. It injects `src/content/injected.js` into the page as a `<script>` tag (using `chrome.runtime.getURL`).
2. **Page-context script** `src/content/injected.js` runs in the page's own JS world, not the extension's isolated world. That lets it monkey-patch `XMLHttpRequest.prototype` and see Crunchyroll's own API calls. When a URL containing `watch-history` loads, it `window.postMessage`s `{ type: "frunchyroll", url, responseText }`. It is plain JS (`// @ts-nocheck`) and must be listed in `web_accessible_resources`, or the injection fails.
3. Back in the **content script**, a `window` `message` listener parses the JSON response and the `page` query param and writes `{ count, page, total }` to `chrome.storage.sync`.
4. **UI**: `src/popup` and `src/options` both mount the same `src/components/Options.svelte`. It listens to `chrome.storage.onChanged` to show page/total, and its "Scrap" button sends `{ message: "SCROLL_DOWN" }` to the active tab with `chrome.tabs.sendMessage`. Scrolling to the bottom of the history page makes Crunchyroll load more pages, which fire more `watch-history` XHRs. On `SCROLL_DOWN`, the content script's `scrollDown()` scrolls to the bottom every 2s and stops once the page height has stayed the same for 3 checks in a row.
5. **Background** `src/background/index.ts` is a service worker that only logs storage when the extension is installed.

`src/storage.ts` is the typed wrapper around `chrome.storage.sync` (`IStorage` with defaults). Svelte/TS code should go through it. The content script currently calls `chrome.storage.sync` directly.

## Conventions and gotchas

- Import from the project root with the `src/...` alias (defined in `vite.config.ts` and `tsconfig.json`), for example `import { storage } from "src/storage"`.
- `src/components/Overlay.svelte` and `src/content/styles.css` are boilerplate leftovers that nothing references.
- `.private/` (gitignored) holds a longer reference version of `injected.js` that also captures request bodies and headers.

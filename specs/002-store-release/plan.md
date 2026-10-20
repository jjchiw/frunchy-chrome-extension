# Implementation Plan: Chrome Web Store release build

**Branch**: `002-store-release` | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-store-release/spec.md`

## Summary

Add a store build mode next to the development build:
- The store build takes the production backend origin from `FRUNCHY_BACKEND_URL`, fixes the
  backend to it, and grants host access only to Crunchyroll and that origin.
- A `package` script zips it.

Both builds lose the permissions nothing uses (`tabs`, `activeTab`, `externally_connectable`),
declare Chrome 119 as the minimum and localize the description. The 128 px icon gets the store's
padding. Store listing texts, privacy answers and images rendered from invented data go into
`store/`, with a generator in `scripts/store-assets/`. Details are in [research.md](research.md),
and the build interface in [contracts/build.md](contracts/build.md).

## Technical Context

**Language/Version**: TypeScript 6 (strict), Svelte 5, Node ≥ 22.12 for the scripts (ES modules,
`.mjs`)

**Primary Dependencies**: Vite 8, `@crxjs/vite-plugin` 2.7. No new dependencies: zipping uses the
system `zip`, and screenshots use headless Chrome.

**Storage**: `chrome.storage.local` `settings`. The store build overrides `baseUrl`, and a one-time
reset runs on install or update (research R2).

**Testing**: No test suite. Checks:
- `npm run build`, `npm run build:store` and `npm run check`;
- the manifest assertions and failure cases in `quickstart.md`;
- the harness for the options page;
- the owner's manual Chrome check.

**Target Platform**: Chrome ≥ 119 (MV3)

**Project Type**: Browser extension

**Constraints**:
- No `localhost` in the store bundle.
- No new runtime dependencies.
- Store images use invented data only.
- CI (`npm ci`, `npm run build`, `npm run check`) keeps working without `FRUNCHY_BACKEND_URL`.

**Scale/Scope**:
- edited: `vite.config.ts`, `manifest.json`, 2 locale files, `settings.ts`, `vite-env.d.ts`,
  `service-worker.ts`, `Settings.svelte`;
- added: 1 SVG, 1 PNG re-render, `scripts/package.mjs`, `scripts/store-assets/`, `store/`;
- docs: CLAUDE.md.

## Constitution Check

The constitution is still the template. The gates are CLAUDE.md's rules:

| Rule | Status |
|---|---|
| `manifest.json` is the source of truth for entry points | Pass: the store manifest is a transformed copy and adds no entry points |
| Keep `@crxjs/vite-plugin` ≥ 2; entry names unique; check `service-worker-loader.js` | Pass: unchanged, and checked in quickstart §1 |
| Show only real data; screenshots of real history stay out of the repository | Pass: the generator uses invented fixtures |
| Popup fits 600px | Pass: no popup changes |
| The extension links only to the website pages the contract lists | Pass: no new links. The privacy URL appears only in store docs |
| A different backend counts as a different Frunchy user | Pass: the reset on install (R2) |

## Project Structure

```text
specs/002-store-release/   spec.md, plan.md, research.md, quickstart.md, contracts/build.md, checklists/, tasks.md
vite.config.ts             mode-aware: store manifest, define constants, dist-store output, URL validation
manifest.json              permissions trimmed, minimum_chrome_version, localized description
public/_locales/{en,es}/messages.json   + ext_description, connects_to
src/vite-env.d.ts          declare __STORE_BUILD__, __BACKEND_URL__
src/settings.ts            DEFAULT_BASE_URL from the build; FIXED_BACKEND; getSettings override
src/background/service-worker.ts   onInstalled: adopt the build backend and reset sync state
src/components/Settings.svelte     store build: no URL field, "Connects to" line, no permission request
src/assets/brand/frunchy-icon-128.svg, src/assets/icons/frunchy128.png
scripts/package.mjs
scripts/store-assets/      generator (Vite project, chrome stub, fixtures, compose pages, render.mjs)
store/                     README.md, listing.en.md, listing.es.md, privacy-practices.md, images/
package.json               scripts: build:store, package, store:assets
.gitignore                 dist-store, release
CLAUDE.md                  Commands, icon bullet, store build notes
```

**Structure Decision**: The existing layout. Node scripts go in a new `scripts/`, and store
material in a new `store/`, both outside `src/`, so `svelte-check` and the extension bundle never
include them.

There's no data model: no new stored data, and the settings override is described in research R2.

## Implementation order

1. **Permissions and manifest** (US2): edit `manifest.json`, add the locale strings, build.
2. **Store build** (US1): `vite.config.ts`, the constants, the settings override and reset, the
   options page, `package.mjs`, the failure cases.
3. **Icon** (US3).
4. **Store materials** (US4): the generator, then the images, then the texts.
5. **Docs and final checks**.

## Complexity Tracking

No violations.

# Research: Chrome Web Store release build

## R1. Two builds from one source

- **Decision**:
  - `vite.config.ts` becomes `defineConfig(({ mode }) => …)`, and the store build runs as
    `vite build --mode store`.
  - **Backend URL**: in store mode, the config reads the `FRUNCHY_BACKEND_URL` environment
    variable. It parses it with `new URL()` and requires `protocol === "https:"`, keeping only the
    `origin`. Otherwise it throws an `Error` whose message names the variable and gives an example
    (`FRUNCHY_BACKEND_URL=https://frunchy.example npm run package`).
  - **Manifest**: the config passes CRXJS a copy of `manifest.json`. In store mode the copy's
    `host_permissions` become `["https://www.crunchyroll.com/*", "<origin>/*"]`, and
    `optional_host_permissions` is deleted. `manifest.json` stays the development manifest.
  - **Code constants**: `define` sets `__STORE_BUILD__` (boolean) and `__BACKEND_URL__` (string:
    the origin in store mode, `"http://localhost:5099"` otherwise). They're declared in
    `src/vite-env.d.ts`.
  - **Output**: the store build writes to `dist-store/`, so a store build never overwrites the
    unpacked `dist/` that the owner loads in Chrome.
- **Rationale**: One source, with no second manifest file that could drift. A missing domain fails
  loudly at build time, not inside the zip. `define` constants are replaced at build time, so the
  store bundle contains no `localhost` string.
- **Alternatives considered**:
  - A second `manifest.store.json`: it duplicates every field and would drift.
  - A runtime check of `chrome.runtime.getManifest()`: the localhost URL would still ship in the
    bundle.
  - Vite's `import.meta.env.VITE_*`: it works, but it doesn't validate, and the env-file loading
    rules are easy to trip over.

## R2. Settings in the store build

- **Decision**:
  - In `src/settings.ts`: `DEFAULT_BASE_URL = __BACKEND_URL__` and a new
    `export const FIXED_BACKEND = __STORE_BUILD__`. When `FIXED_BACKEND` is set, `getSettings()`
    always returns `baseUrl: DEFAULT_BASE_URL` (stored `syncKey` kept).
  - In `src/background/service-worker.ts`, on `chrome.runtime.onInstalled` with `FIXED_BACKEND`
    set: if the stored `settings.baseUrl` exists and differs from `DEFAULT_BASE_URL`, save
    `{ baseUrl: DEFAULT_BASE_URL, syncKey }` and run the same reset as `Settings.svelte` (`marker`,
    `lastImport`, `lastRejectionAt` and `sent` to their empty values).
  - In `Settings.svelte`, when `FIXED_BACKEND` is set:
    - the backend URL field and "Use default" aren't rendered;
    - a line shows the backend's host with a new i18n key `connects_to` ("Connects to $1" /
      "Se conecta a $1");
    - `chrome.permissions.request` is skipped, because the origin is already a required host
      permission.
- **Rationale**: `getSettings()` is the single read path (sync, popup, links), so forcing it there
  covers every use. The `onInstalled` reset keeps the "different backend means a different
  Frunchy user" rule (CLAUDE.md). Requesting a permission that isn't optional can throw, so it's
  skipped.
- **Alternatives considered**: Rewriting storage on every `getSettings()` call: that's a write on
  a read path, and it races the popup and options pages (CLAUDE.md notes the cross-context race).

## R3. Permissions

| Permission | Kept? | Reason |
|---|---|---|
| `storage`, `unlimitedStorage` | yes | pages, queue and settings; a full history is tens of MB |
| `alarms` | yes | upload retries, since the service worker is suspended between events |
| `scripting` | yes | `registerContentScripts` for the page-world hook (`injected.js`, `world: "MAIN"`, `document_start`) |
| `tabs` | **no** | Only `tabs.query` reads `url`, and Chrome exposes `url` for tabs matching a host permission (the Crunchyroll host permission covers that). `create`, `update`, `reload`, `sendMessage` and `onUpdated` (`status` only) don't need it. Removing it drops the "Read your browsing history" install warning. |
| `activeTab` | **no** | Never used: no `executeScript` and no access triggered by a click. |
| `externally_connectable` | **no** | There's no `onMessageExternal` or `onConnectExternal` listener. |
| host `www.crunchyroll.com` | yes | content script, page hook, reading the tab URL |
| host `localhost` ×2 | dev only | local backend |
| host production origin | store only | the backend API |
| optional `http(s)://*/*` | dev only | custom backend in the options page |

Source: Chrome's `tabs` API reference: "Host permissions allow an extension to read and query a
matching tab's four sensitive `tabs.Tab` properties", and most features need no permission.

## R4. Minimum Chrome version

- **Decision**: `"minimum_chrome_version": "119"` in `manifest.json`.
- **Rationale**: The newest feature the extension uses is CSS relative colour syntax
  (`rgb(from var(--…) r g b / a)`, in `base.css` and `Popup.svelte`), which needs Chrome 119.
  The others are older: `text-wrap: balance` (114), `text-wrap: pretty` (117),
  `registerContentScripts` with `world: "MAIN"` (MV3, earlier than 119), and Vite's default build
  target (Chrome 107).

## R5. Localized description

- **Decision**:
  - In `manifest.json`, set `"description": "__MSG_ext_description__"`.
  - Add `ext_description` to both locale files:
    - en: "Syncs your Crunchyroll watch history to Frunchy."
    - es: "Sincroniza tu historial de Crunchyroll con Frunchy."
  - The name stays the literal "Frunchy". `default_locale` is already `en`.
- **Rationale**: FR-010. The store also shows the manifest description as the default summary.

## R6. The 128 px store icon

- **Decision**:
  - Add `src/assets/brand/frunchy-icon-128.svg`. It's a 128×128 viewBox whose content is the
    existing tile and mark (the `frunchy-icon.svg` content) placed with
    `transform="translate(16 16) scale(2)"`, so the 48-unit tile becomes 96 px with 16 px of
    transparent padding.
  - Render it with `rsvg-convert -w 128 -h 128 frunchy-icon-128.svg -o ../icons/frunchy128.png`.
  - Leave the 16, 32 and 48 px icons alone.
  - Add a line to CLAUDE.md's icon bullet.
- **Rationale**: The Chrome Web Store image guidelines say a square icon's artwork is 96×96 inside
  128×128, with 16 px of transparent padding. The 128 px icon isn't used in the toolbar, so the
  toolbar look doesn't change.

## R7. Packaging

- **Decision**:
  - In `package.json`:
    - `"build:store": "vite build --mode store"`
    - `"package": "npm run build:store && node scripts/package.mjs"`
  - `scripts/package.mjs`:
    - reads `dist-store/manifest.json`;
    - checks that no `localhost` string appears anywhere in `dist-store/`, and fails if one does;
    - creates `release/`;
    - runs `zip -r -X ../release/frunchy-<version>.zip .` with `cwd: dist-store`, through
      `child_process.execFileSync`;
    - prints the zip path and size.
  - `.gitignore` gets `dist-store` and `release`.
- **Rationale**: `zip` is on macOS and on GitHub's ubuntu runners, so there's no new dependency.
  The `localhost` check is a cheap guard for FR-007.

## R8. Store materials and the screenshot generator

- **Decision**:
  - **Texts** in `store/`:
    - `README.md`: the owner checklist and how to regenerate the images;
    - `listing.en.md` and `listing.es.md`: short description (at most 132 characters), long
      description and the not-affiliated line;
    - `privacy-practices.md`: single purpose, permission reasons, remote code, data use and the
      privacy policy URL placeholder.
  - **Images** in `store/images/`:
    - `screenshot-<lang>-<n>.png` at 1280×800, 4 per language: ready to scrape, scraping, synced
      with an import completed, and the options page connected;
    - `promo-440x280.png`.
  - **Generator** in `scripts/store-assets/`, a small Vite project (`npm run store:assets`):
    - It reuses the harness built during 001: it stubs `globalThis.chrome` (i18n from the real
      locale files, storage fixtures, `tabs` and `runtime` stubs) and mounts the real
      `Popup.svelte` and `Settings.svelte`.
    - A compose page places the popup at 1.25× scale on the `--color-surface` background, with
      a short caption in the display font taken from the listing text.
    - `scripts/store-assets/render.mjs` builds it, runs headless Chrome (`CHROME` env var,
      defaulting to the macOS path) with `--window-size=1280,800` or `440,280` and
      `--screenshot`, and waits for `document.fonts.ready` and a `data-ready` attribute.
    - All fixtures are invented: an invented profile name, generic episode titles such as
      "Example Series", and thumbnails as solid-colour `data:` URIs. No network.
- **Rationale**: Re-renderable images stay in step with the UI. Invented data keeps real history
  out of a public repository (CLAUDE.md).
- **Data-use answers** (Chrome's data categories):
  - Tick **Website content**: the Crunchyroll history responses, uploaded as received.
  - Tick **Personally identifiable information**: the Crunchyroll profile name.
  - Tick **Authentication information**: the sync key, a bearer credential.
  - Leave **Web history** unticked: Frunchy reads Crunchyroll's own watch-history API, not the
    browser's history, and `privacy-practices.md` says so.
  - Leave **User activity** unticked: there's no click, keystroke or network monitoring.
  - Tick all three limited-use certifications.
- **Alternatives considered**: Screenshots taken by hand in real Chrome: they'd show real
  history and can't be re-rendered.

# Tasks: Chrome Web Store release build

**Input**: `specs/002-store-release/` (spec, plan, research, contracts/build.md, quickstart)

**Tests**: The project has no test suite. Each phase ends with the checks from `quickstart.md`.

**Placeholder domain**: Use `https://frunchy.example` wherever a store build needs a URL. The
real domain doesn't exist yet.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Add `dist-store` and `release` to `.gitignore`.

---

## Phase 2: User Story 2 - Only the permissions the extension uses (Priority: P1)

**Goal**: Both builds request only what the code uses. Story 2 comes first because the store
build's manifest is derived from this one.

**Independent Test**: quickstart §1 and §3 (dev build).

- [X] T002 [US2] Edit `manifest.json`:
  - `permissions` becomes `["alarms", "scripting", "storage", "unlimitedStorage"]`, dropping `activeTab` and `tabs`.
  - Delete the `externally_connectable` block.
  - Add `"minimum_chrome_version": "119"`.
  - Set `"description": "__MSG_ext_description__"`.
  - Keep the dev `host_permissions` and `optional_host_permissions` as they are.
- [X] T003 [P] [US2] Add these keys to `public/_locales/en/messages.json` and `public/_locales/es/messages.json`, following the files' existing format, with a `description` field if the others have one:
  - `ext_description`: en "Syncs your Crunchyroll watch history to Frunchy.", es "Sincroniza tu historial de Crunchyroll con Frunchy."
  - `connects_to`: en "Connects to $HOST$", es "Se conecta a $HOST$", with a `placeholders` entry `host` → `$1`. Use the same placeholder style the existing messages use; check how `t()` in `src/i18n.ts` passes substitutions.
- [X] T004 [US2] Run `npm run build` and `npm run check`, then check `dist/manifest.json` as in quickstart §1. Confirm no code uses `chrome.tabs` properties beyond `url`/`id` from `tabs.query` and `status` from `onUpdated`: `grep -rn "chrome\.tabs\|\.title\|favIconUrl\|pendingUrl" src`.

**Checkpoint**: Commit.

---

## Phase 3: User Story 1 - The store package (Priority: P1) 🎯 MVP

**Goal**: `npm run package` builds a zip that reaches only Crunchyroll and the given backend.
Development is unchanged.

**Independent Test**: quickstart §2, and §3 for the options page.

- [X] T005 [US1] Make `vite.config.ts` mode-aware (research R1):
  - Export `defineConfig(({ mode }) => { … })`. `const store = mode === "store"`.
  - In store mode, read `process.env.FRUNCHY_BACKEND_URL` and validate it. Throw the exact messages from `contracts/build.md` when it's missing, unparseable or not `https:`. Keep only its `origin`.
  - Build the manifest as a deep copy of the imported `manifest.json`. In store mode, set `host_permissions` to `["https://www.crunchyroll.com/*", `${origin}/*`]` and delete `optional_host_permissions`. Pass it to `crx({ manifest })`.
  - Add `define: { __STORE_BUILD__: JSON.stringify(store), __BACKEND_URL__: JSON.stringify(store ? origin : "http://localhost:5099") }`.
  - Add `build: { outDir: store ? "dist-store" : "dist" }`.
  - Keep the existing `svelte()` and `resolve.alias`, the 4-space indent and the comment style.
- [X] T006 [US1] Declare `declare const __STORE_BUILD__: boolean;` and `declare const __BACKEND_URL__: string;` in `src/vite-env.d.ts`, with a one-line comment saying where they come from.
- [X] T007 [US1] In `src/settings.ts`:
  - `DEFAULT_BASE_URL = __BACKEND_URL__`.
  - Add `export const FIXED_BACKEND = __STORE_BUILD__;` with a comment: the store build talks only to its own backend.
  - In `getSettings()`, when `FIXED_BACKEND` is set, return the stored values with `baseUrl` forced to `DEFAULT_BASE_URL`, and keep the stored `syncKey`.
- [X] T008 [US1] In `src/background/service-worker.ts`, add or extend a `chrome.runtime.onInstalled` listener. When `FIXED_BACKEND` is set:
  - read the raw stored `settings` straight from `chrome.storage.local`, not through `getSettings()`, which already overrides `baseUrl`;
  - if a stored `baseUrl` exists and differs from `DEFAULT_BASE_URL`, save `{ baseUrl: DEFAULT_BASE_URL, syncKey: stored.syncKey ?? "" }` with `saveSettings`;
  - then `await syncState.update({ marker: null, lastImport: null, lastRejectionAt: null, sent: {} })`, the same reset as `Settings.svelte`.

  Read the file first. If there's already an `onInstalled` listener (the hook registration may use one), add to it and keep its existing behaviour.
- [X] T009 [US1] In `src/components/Settings.svelte`, when `FIXED_BACKEND` is set:
  - don't render the backend URL `.field`, including the label, "Use default" and the input;
  - render, in its place, a `<p class="hint">` with `t("connects_to", new URL(DEFAULT_BASE_URL).host)`;
  - in `saveAndCheck`, skip the `chrome.permissions.request` call and use `DEFAULT_BASE_URL` as the origin.

  The dev build's behaviour and markup must stay identical. Keep the existing style and comment density.
- [X] T010 [US1] Add `scripts/package.mjs` (research R7):
  - read `dist-store/manifest.json` and fail if it's missing;
  - walk `dist-store/` and fail with the `contracts/build.md` message if any file contains `localhost`;
  - `mkdirSync("release", { recursive: true })`, delete any existing zip of the same name, then `execFileSync("zip", ["-r", "-X", `../release/frunchy-${version}.zip`, "."], { cwd: "dist-store", stdio: "inherit" })`;
  - print the path and its size in KB.
- [X] T011 [US1] In `package.json` scripts, add `"build:store": "vite build --mode store"` and `"package": "npm run build:store && node scripts/package.mjs"`.
- [X] T012 [US1] Verify quickstart §2. Show the two failures and their messages, and check that no zip was written for them. Then run the package with `https://frunchy.example/some/path`: check the zip's manifest (`unzip -p release/frunchy-0.1.0.zip manifest.json`), `grep -r localhost dist-store` (empty), and `dist-store/service-worker-loader.js` (it must import `service-worker.ts-*.js`). Run `npm run build` and `npm run check` again to confirm the dev build is unaffected.
- [X] T013 [US1] Check the options page in both modes with the harness under `/Users/jjchiw/.claude/jobs/0e1ec898/tmp/nb-tools/harness/`. It already mounts `Settings.svelte` (`run.sh <repo> <state> options`). Its vite config needs `define` values for `__STORE_BUILD__` and `__BACKEND_URL__`; add an env switch in the harness, not in the repository. Take one screenshot of the dev options page and one of the store options page. Keep them outside the repository.

**Checkpoint**: Commit. This is the MVP: once the domain exists, `npm run package` produces an uploadable zip.

---

## Phase 4: User Story 3 - Store icon and localized description (Priority: P2)

- [X] T014 [P] [US3] Add `src/assets/brand/frunchy-icon-128.svg` (research R6):
  - a 128×128 viewBox, with no background;
  - `<g transform="translate(16 16) scale(2)">` holding the same tile `rect` and the `<image href="frunchy-mark.svg" …/>` as `frunchy-icon.svg`;
  - a comment like the existing one, saying it's the store icon with 16 px of transparent padding.

  From `src/assets/brand/`, run `rsvg-convert -w 128 -h 128 frunchy-icon-128.svg -o ../icons/frunchy128.png`. Check the corner pixel alpha is 0 and the tile spans 16–111, with a small script outside the repository. Don't change the 16, 32 or 48 px PNGs.
- [X] T015 [US3] Load-check: build, then confirm `dist/manifest.json` `description` is `__MSG_ext_description__` and that `dist/_locales/es/messages.json` has `ext_description`.

**Checkpoint**: Commit.

---

## Phase 5: User Story 4 - Store listing and privacy answers (Priority: P3)

- [ ] T016 [US4] Create the generator in `scripts/store-assets/` (research R8):
  - Start from the harness at `/Users/jjchiw/.claude/jobs/0e1ec898/tmp/nb-tools/harness/` (`entry.ts`, `vite.config.js`, `index.html`, `run.sh`), but **replace every fixture with invented data**:
    - profile name "Mika";
    - series titles "Example Series", "Another Show", "Third Story" (no real anime titles);
    - thumbnails as solid-colour `data:` URIs in the Night Broadcast palette.
  - Its `vite.config` uses the repository's `src` alias and `svelte()`, defines `__STORE_BUILD__: true` and `__BACKEND_URL__: "https://frunchy.example"`, and builds to `scripts/store-assets/dist` (gitignored: add `scripts/store-assets/dist` to `.gitignore`).
  - Add a compose page:
    - screenshots are 1280×800, `--color-surface` background, the popup or options page mounted at 1.25× (`transform: scale(1.25)`, origin top left), placed left of centre, with a one-line caption in `--font-display` at about 40 px on the right;
    - captions are passed per state and language from a small table in the generator, not hard-coded in the components;
    - a promo page at 440×280, `--color-surface` with the mark (64–96 px) and the "Frunchy" wordmark in `--font-display` 800, and no other text.
  - States:
    1. ready to scrape (popup);
    2. scraping, with the Stop button and the running line (popup);
    3. synced, with a completed import and 3 synced episodes (popup);
    4. connected options page.

    Do each in `en` and `es`.
  - Add `scripts/store-assets/render.mjs`:
    - it runs `vite build` for the generator, then headless Chrome (`process.env.CHROME`, defaulting to `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`) with `--headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=W,H --screenshot=<out>` for each image;
    - the page sets `data-ready` once `document.fonts.ready` resolves and Svelte has mounted, and the script retries if the PNG is blank, as `run.sh` does;
    - output goes to `store/images/screenshot-<lang>-<n>.png` and `store/images/promo-440x280.png`.
  - Add `"store:assets": "node scripts/store-assets/render.mjs"` to `package.json`.
- [ ] T017 [US4] Run `npm run store:assets`. Check every PNG's size with `file`: 8 screenshots at 1280×800 and 1 promo at 440×280. Look at each image (open the PNGs): no real names or titles, fonts render, nothing is clipped.
- [ ] T018 [P] [US4] Write `store/listing.en.md` and `store/listing.es.md`, each with:
  - a **name** ("Frunchy");
  - a **short description** of at most 132 characters (state the count);
  - a **long description** of about 120–200 words: what it does (reads your Crunchyroll watch history in your own logged-in browser and syncs it to your Frunchy account, so you get anime stats you can share), what it never touches (your Crunchyroll password and tokens stay in the browser), and how to start (create a Frunchy account, copy the sync key from "Connect extension", paste it into the extension's settings, open your Crunchyroll history and press Scrape);
  - the line "Frunchy is not affiliated with, endorsed or sponsored by Crunchyroll." (es: "Frunchy no está afiliado a Crunchyroll ni cuenta con su respaldo o patrocinio.");
  - a **category** suggestion and the **language**.

  Use "a social stats platform for anime" (es: "una plataforma social de estadísticas de anime"). Never compare Frunchy with another product, and never use "Last.fm". The Spanish uses "tú" and the shared names from CLAUDE.md ("Dashboard", "ADN anime", "Connect extension"). Plain, factual tone, no marketing superlatives.
- [ ] T019 [P] [US4] Write `store/privacy-practices.md`, in English, the dashboard's language. Each answer must be copy-pasteable:
  - the single purpose;
  - one reason per store-manifest permission (`alarms`, `scripting`, `storage`, `unlimitedStorage`, host `https://www.crunchyroll.com/*`, host `<backend>/*`), matching research R3;
  - remote code: "No, I am not using remote code", with the reason that everything is bundled;
  - data usage: which categories to tick and why, per research R8, including why Web history and User activity are left unticked;
  - the three certifications;
  - privacy policy URL: `<backend>/privacy` (to be created by the backend);
  - a short "what the extension stores and sends" section the backend's privacy page can reuse:
    - stored locally: history pages, the upload queue, settings including the sync key, and the last seen profile id and name;
    - sent: history pages with the profile id, only to the configured backend, with the sync key as a bearer token;
    - never sent: Crunchyroll tokens or password.
- [ ] T020 [US4] Write `store/README.md`. It covers:
  - what's in the folder;
  - how to regenerate the images (`npm run store:assets`);
  - how to build the upload (`FRUNCHY_BACKEND_URL=https://<domain> npm run package`);
  - the owner checklist:
    - register the developer account ($5 one-time, 2-step verification, contact email, trader declaration; the account email can't be changed later);
    - deploy the backend on HTTPS and choose the domain;
    - the backend publishes `/privacy`;
    - decide on Crunchyroll's terms;
    - run `package`, then upload the zip;
    - fill the listing from `listing.*.md`, upload the images, and fill Privacy practices from `privacy-practices.md`;
    - choose **Unlisted** visibility for the first release;
    - submit for review;
    - raise `version` in `manifest.json` and `package.json` for every later upload.

**Checkpoint**: Commit.

---

## Phase 6: Polish

- [ ] T021 Update `CLAUDE.md`, keeping its style:
  - **Commands**: add `npm run build:store` (needs `FRUNCHY_BACKEND_URL`, outputs `dist-store/`), `npm run package` (zip in `release/`) and `npm run store:assets`.
  - **Architecture**: a short paragraph on the store build: fixed backend, host permissions, the `__STORE_BUILD__`/`__BACKEND_URL__` constants, and the reset on install.
  - **Icon bullet**: `frunchy128.png` is rendered from `frunchy-icon-128.svg` with 16 px transparent padding for the store.
  - **Conventions**: `store/` holds the listing material; its images use invented data only.

  Update the permissions mentioned anywhere in CLAUDE.md if they're listed.
- [ ] T022 Final validation: quickstart §1, §2, §4 and §5, plus `npm run check` and the CI commands (`npm ci`, `npm run build`, `npm run check`) without `FRUNCHY_BACKEND_URL`. Report every result with numbers.

---

## Dependencies

- T001 first.
- US2 (T002–T004) comes before US1 (T005–T013), because the store manifest derives from the edited `manifest.json` and T009 needs `connects_to`.
- US3 (T014–T015) is independent after T002.
- US4: T016 needs US1 (the `define` constants and the store options page); T018 and T019 can run in parallel with T016.
- T021 and T022 come last.

## Implementation strategy

The MVP is US2 plus US1. After T012, the owner only needs a domain to get an uploadable zip.
Commit at each checkpoint: an imperative subject and a short body explaining why.

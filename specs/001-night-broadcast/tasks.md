# Tasks: Night Broadcast design system in the extension

**Input**: Design documents from `specs/001-night-broadcast/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/popup-ui.md, quickstart.md

**Tests**: There's no test suite and the spec doesn't ask for one. Verification uses one-off scripts
kept **outside the repository**: a parity check, a contrast check and a height harness. They are
written in Phase 1 and run at each checkpoint. Don't commit them or their screenshots, because
the screenshots can show watch history.

**Reference values**: The backend files are read-only. Don't edit them.
- `Theme.fs`, `design/brand/frunchy-mark.svg` and the contract are in
  `/Users/jjchiw/Documents/code4fun/FrunchyWrapper/FrunchyBackend/.claude/worktrees/009-episode-comments/`
  (branch `010-night-broadcast`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup (shared infrastructure)

**Purpose**: Fonts in the bundle, and the three verification tools working against the current
code.

- [ ] T001 Swap the font dependencies in `package.json` and `package-lock.json`, keeping exact versions like the existing entries:
  - add `@fontsource-variable/figtree@5.3.0`, `@fontsource/bricolage-grotesque@5.3.0` and `@fontsource/ibm-plex-mono@5.3.0` as devDependencies (`npm i -D -E …`);
  - remove `@fontsource-variable/plus-jakarta-sans` and `@fontsource/jetbrains-mono` (`npm uninstall …`), and remove their imports from `src/styles/base.css` in T006, not now. `npm run build` will fail between T001 and T006; that's expected.
- [ ] T002 [P] Write a parity script outside the repository, `parity.py`, that reproduces the backend's check (research R1):
  - Parse `Views/Theme.fs` into a map of token names to values:
    - colours: `"name", "#hex"` pairs → `--color-name`;
    - type styles: `"style", ("size", "line", "weight", "tracking")` → `--text-style-size`, `-line`, `-weight` and `-tracking`;
    - radii → `--radius-*` and spaces → `--space-*`;
    - the effects and fonts given as `"--name", "value"` (unescape `\"`).
  - Extract every `(--[a-z0-9-]+)\s*:\s*([^;]+);` from `src/styles/tokens.css`, the whole file including comments, and trim the values.
  - Report names missing from the website, and values that differ, skipping `--font-family`. Exit non-zero on any problem.
  - Run it against the current `tokens.css`. It must report mismatches (the old palette), which proves it works.
- [ ] T003 [P] Write a contrast script outside the repository, `contrast.py`:
  - Use the WCAG 2.1 relative-luminance formula.
  - Composite `rgb(from var(--color-X) r g b / a)` tints over their real background.
  - Cover every pair in `specs/001-night-broadcast/contracts/popup-ui.md`, read from the final `tokens.css` values. Text must be at least 4.5:1, field borders and focus rings at least 3:1.
- [ ] T004 [P] Build a popup height harness outside the repository (research R7):
  - A small Vite project whose `root` is the harness directory. It reuses the extension's `src/` alias (`resolve.alias: { src: <repo>/src }`) and `@sveltejs/vite-plugin-svelte`, from the repository's `node_modules`.
  - An entry that installs a `globalThis.chrome` stub before importing `src/components/Popup.svelte`, then mounts it with `mount()`. The stub provides:
    - `i18n.getMessage` and `i18n.getUILanguage`, from the real `public/_locales/<lang>/messages.json` with `$1`-style placeholders;
    - `storage.local.get`, `set` and `remove`, and `storage.onChanged`, backed by a fixture object;
    - `tabs.query` returning a history tab, `tabs.sendMessage`, `tabs.onUpdated`, `tabs.create`, `tabs.update` and `tabs.reload`;
    - `runtime.sendMessage`, `runtime.onMessage`, `runtime.openOptionsPage` and `runtime.lastError`.
  - Use `src/storage.ts`, `src/sync.ts` and `src/settings.ts` to get the exact storage keys and shapes for the fixtures.
  - Fixture states:
    - **tallest (es)**: the tab needs a reload (`tabs.sendMessage` rejects), a sync key set, `lastError` with a code that shows a link, 3 queued uploads, `lastImport` in progress, a known Crunchyroll profile with a long name, 3 stored episodes with titles and thumbnails (use `data:` URIs, no network), and the footer with `me` set;
    - **ready (en)**: a content script that answers, synced, 3 episodes.
  - Serve it with `vite`, or build it with `vite build` and serve `dist/`.
  - Load it in headless Chrome: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --window-size=380,800 --virtual-time-budget=5000 --dump-dom <url>`. The page writes `document.documentElement.scrollHeight` into a `data-height` attribute after mount and fonts load (`await document.fonts.ready`). Also take `--screenshot` PNGs, kept outside the repository.
  - **Calibrate**: run it on the current code (before any style change). The tallest es state should measure about 598px. If it doesn't, fix the fixture until it matches the state described in CLAUDE.md, and report the number.

**Checkpoint**: The parity script fails on the old tokens, the harness measures the old popup at
about 598px, and the contrast script runs.

---

## Phase 2: Foundational

None beyond User Story 1. Its tokens and fonts are the base that every other story styles on.

---

## Phase 3: User Story 1 - Shared tokens match the website again (Priority: P1) 🎯 MVP

**Goal**: `tokens.css` passes the backend's parity check, and the new fonts are bundled.

**Independent Test**: `parity.py` reports 0 missing and 0 different, and `npm run build` succeeds.

- [ ] T005 [US1] Rewrite `src/styles/tokens.css` with every value from `specs/001-night-broadcast/data-model.md`:
  - Add `--color-surface-container`, `--color-tertiary`, `--color-on-error`, `--font-display` and `--text-headline-md-weight`.
  - Keep the tokens due for removal (`--color-error-container`, `--color-on-error-container`, `--text-label-sm-weight`, `--text-label-sm-tracking`, `--radius-md`, `--border-micro`, `--edge-highlight`, `--shadow-level-2`), but give them the website's Night Broadcast values from `Theme.fs`. They're removed in T023.
  - `--font-family: "Figtree Variable", system-ui, sans-serif;`
  - Rewrite the header comment to point at `../FrunchyBackend/design/night_broadcast/DESIGN.md` and the contract `specs/010-night-broadcast/contracts/design-system.md`. Keep the "only tokens the extension uses" and parity-check notes. No comment may contain a `--name: value;` pattern.
  - Keep the `/* Keys, usernames and URLs only. */` comment on `--font-mono`.
- [ ] T006 [US1] Update `src/styles/base.css`:
  - Replace the two font imports with `@fontsource-variable/figtree/wght.css`, `@fontsource/bricolage-grotesque/700.css`, `@fontsource/bricolage-grotesque/800.css` and `@fontsource/ibm-plex-mono/500.css`.
  - Add `h1, h2, h3 { font-family: var(--font-display); }`.
  - Add `font-variant-numeric: tabular-nums;` to `html, body`.
  - Change `::selection` to `background: rgb(from var(--color-primary) r g b / 0.3);`.
- [ ] T007 [US1] Run `parity.py` (0 problems), `npm run build` and `npm run check` (0 errors, 0 warnings). Confirm `dist/` contains the Figtree, Bricolage Grotesque and IBM Plex Mono woff2 files and no Plus Jakarta Sans or JetBrains Mono files.

**Checkpoint**: The tokens match the website. The popup already shows the new palette through the
token names, but still with old shapes and hard-coded tints.

---

## Phase 4: User Story 2 - The popup looks like the website (Priority: P1)

**Goal**: Every popup element matches `contracts/popup-ui.md`, and every state fits within 600px.

**Independent Test**: The harness screenshots of both states match the contract, the tallest es
state is at most 600px, and `grep -nE 'gradient|rgb\((76|6|192|49|255) ' src/components/Popup.svelte`
prints nothing.

All tasks in this phase edit `src/components/Popup.svelte` (styles, plus the few markup changes
named below), so run them in order. Don't change any script logic, `t(...)` key, ARIA attribute or
live region.

- [ ] T008 [US2] Header in `src/components/Popup.svelte`:
  - Remove the `.mark` tile (background, border and radius). Show the mark at 32×32 (`width`/`height` 32 on the `<img>`).
  - `.wordmark`: `font-family: var(--font-display)` (inherited from `h1`), `font-weight: 800`, `letter-spacing: -0.025em`, size `--text-headline-md-size`. Keep a 24px line height unless the measurement needs it changed.
- [ ] T009 [US2] Icon buttons in `src/components/Popup.svelte`: `.icon-button` gets `border-radius: var(--radius-full)`, and its hover background is `var(--color-surface-container)`.
- [ ] T010 [US2] Main card in `src/components/Popup.svelte`:
  - `.hero` gets a solid `background: var(--color-surface-container-low)` and `border-radius: var(--radius-lg)`, with no `border`, `border-top-color` or `box-shadow`.
  - Replace the gradient sweep (research R5):
    - `.hero.running` shows a static 2px solid `var(--color-primary)` line across its top edge, for example `box-shadow: inset 0 2px 0 var(--color-primary)`. It's clipped by the radius and `overflow: hidden`.
    - `.hero.running::before` becomes a solid `var(--color-primary-fixed)` segment, 2px tall and about 30% wide, sweeping from `translateX(-100%)` to `translateX(calc(100% / 0.3))` or similar so it crosses the whole card. Keep the existing `scan` timing and easing.
    - Add `@media (prefers-reduced-motion: reduce) { .hero.running::before { display: none; } }`.
- [ ] T011 [US2] Card contents in `src/components/Popup.svelte`:
  - `.profile` becomes a lilac tag: `color: var(--color-tertiary)`, `background: rgb(from var(--color-tertiary) r g b / 0.14)`, `border: 1px solid rgb(from var(--color-tertiary) r g b / 0.25)`, full radius.
  - `.hero-title` uses `font-weight: var(--text-headline-md-weight)`.
- [ ] T012 [US2] Main button in `src/components/Popup.svelte`:
  - `.action` gets `border-radius: var(--radius-full)`.
  - `.action-stop`: background `rgb(from var(--color-primary) r g b / 0.08)` and `box-shadow: inset 0 0 0 1px rgb(from var(--color-primary) r g b / 0.5)`. On hover, the background becomes `rgb(from var(--color-primary) r g b / 0.14)` and the inset ring stays.
- [ ] T013 [US2] Meta rows in `src/components/Popup.svelte`:
  - `.meta-pending` becomes `color: var(--color-tertiary)`.
  - Give the failed-import row (`lastImport?.status === "failed"`) a new class `meta-warning` instead of `meta-error`, styled `color: var(--color-secondary)`.
  - The `lastError` row keeps `meta-error` (coral).
- [ ] T014 [US2] Recent episodes in `src/components/Popup.svelte`:
  - `.section-title`: remove `text-transform` and `letter-spacing`. Use `font-size: var(--text-label-md-size)`, `line-height: var(--text-label-md-line)` and `font-weight: 700`. Keep the colour `var(--color-on-surface-variant)`. The display font comes from `h2`.
  - `.episode`: `border-radius: var(--radius-lg)`, no `border`, keeping its `surface-container-low` background.
  - `.entry-pending` becomes `color: var(--color-tertiary)`.
- [ ] T015 [US2] Footer in `src/components/Popup.svelte`:
  - `.bottom` gets `border-top: 1px solid var(--color-outline-variant)`.
  - `.small-button`: `border-radius: var(--radius-full)`, `background: transparent`, `color: var(--color-on-surface)`, `border: var(--border-ghost)`. On hover, the background is `var(--color-surface-container-high)` and the border is unchanged.
  - `.danger` and `.danger:hover`: `background: var(--color-error)`, `color: var(--color-on-error)`, `border-color: transparent`.
  - Remove the stray blank lines around `.tools`.
- [ ] T016 [US2] Sweep `src/components/Popup.svelte`:
  - No `gradient` and no `rgb(` literal may remain, except `rgb(from var(--…) …)` tints and the neutral `rgb(0 0 0 / 0.4)` thumbnail edge.
  - Nothing may use a token that is due for removal: `--border-micro`, `--edge-highlight`, `--shadow-level-2`, `--radius-md`, `--color-error-container`, `--color-on-error-container`, `--text-label-sm-weight` and `--text-label-sm-tracking`.
  - Check every row of the popup table in `contracts/popup-ui.md` against the code.
- [ ] T017 [US2] Run the harness on both states:
  - Record the tallest es height. If it's over 600px, reduce spacing inside the main card (for example the `.popup` gap, `.hero` padding or `.wordmark` line height) until it fits, without changing text or removing content, then re-measure.
  - Look at the screenshots: no overlap, the profile pill truncates, and the right fonts render.
  - Run `npm run build` and `npm run check`.

**Checkpoint**: The popup matches the contract and fits.

---

## Phase 5: User Story 3 - The options page matches (Priority: P2)

**Goal**: `Settings.svelte` matches the options table in `contracts/popup-ui.md`.

**Independent Test**: Run `npm run check`. Add a second entry to the T004 harness that mounts `src/components/Settings.svelte` with the same `chrome` stub. A settings fixture holds a backend URL and key; `fetch` can reject. Screenshot it: the inputs, buttons and title match the contract. No height limit applies.

- [ ] T018 [P] [US3] Inputs in `src/components/Settings.svelte`:
  - Resting `border: 1px solid var(--color-outline)` (was `outline-variant`) and `background: var(--color-surface-container)`.
  - Keep `border-radius: var(--radius-default)`, the `primary` focus border and 1px `primary` ring, the `outline` placeholder and the mono font.
  - The hover rule that set the border to `outline` is now redundant. Change it to `var(--color-on-surface-variant)` so hover stays visible, as listed in `contracts/popup-ui.md`.
- [ ] T019 [US3] Buttons and title in `src/components/Settings.svelte`:
  - The primary (save) button and `.reveal` get `border-radius: var(--radius-full)`.
  - The title uses `font-weight: var(--text-headline-md-weight)` and the display font (from `h1`).
  - Check that no `gradient`, old `rgb(` literal or token due for removal is used, and that every row of the options table in `contracts/popup-ui.md` matches.

**Checkpoint**: The options page matches.

---

## Phase 6: User Story 4 - Mark and toolbar icons take the new colours (Priority: P3)

**Goal**: The popup mark and the 16, 32, 48 and 128 px icons use the Night Broadcast colours.

**Independent Test**: `cmp` against the backend mark returns 0, and the PNGs show amber, darker
amber and rose bars on a `#13111a` tile.

- [ ] T020 [P] [US4] Copy `design/brand/frunchy-mark.svg` from the backend worktree unchanged over `src/assets/brand/frunchy-mark.svg`, then run `cmp`.
- [ ] T021 [US4] In `src/assets/brand/frunchy-icon.svg`, change the tile `fill` to `#13111a` and its comment's `surface (#0f131c)` to `surface (#13111a)`.
- [ ] T022 [US4] Re-render `src/assets/icons/frunchy16.png`, `frunchy32.png`, `frunchy48.png` and `frunchy128.png`. From `src/assets/brand/`, run `rsvg-convert -w N -h N frunchy-icon.svg -o ../icons/frunchyN.png` for each size. Open the 128 and 16 px PNGs and check the colours.

**Checkpoint**: All four stories are done.

---

## Phase 7: Polish and cross-cutting

- [ ] T023 Remove the tokens nothing uses any more from `src/styles/tokens.css`: `--color-error-container`, `--color-on-error-container`, `--text-label-sm-weight`, `--text-label-sm-tracking`, `--radius-md`, `--border-micro`, `--edge-highlight` and `--shadow-level-2`. First grep `src/` to confirm each one has no use. Then confirm that every remaining token is used at least once in `src/`, and run `parity.py` again (0 problems).
- [ ] T024 [P] Update `CLAUDE.md`:
  - **Design paragraph**: Night Broadcast; the roles (amber is the user and the primary action, lilac is tags and neutral attention such as the profile pill and waiting, rose is warnings such as a failed import, coral is errors); solid fills only; buttons and pills fully rounded; cards `radius-lg` with no border.
  - **UI paragraph**: replace "measures 598px" with the height measured in T017.
  - **Fonts bullet**: Figtree (`@fontsource-variable/figtree`), Bricolage Grotesque for headings and the wordmark (`@fontsource/bricolage-grotesque` static 700 and 800, because `--font-display` must name exactly `"Bricolage Grotesque"`), and IBM Plex Mono 500 (`@fontsource/ibm-plex-mono`).
  - **Icons bullet**: the tile is `#13111a`.
  - Keep the file's style: plain sentences, no marketing.
- [ ] T025 [P] Update `PRODUCT.md`, which mentions the design system or mark, and `.impeccable/surfaces/src-components-popup-svelte.md` to name Night Broadcast, the colour roles and the new fonts in place of Neo-Scrobble, Plus Jakarta Sans, JetBrains Mono and cyan. Only edit lines that are now wrong.
- [ ] T026 Final validation, following `specs/001-night-broadcast/quickstart.md` §1–§6:
  - build, check, the worker loader and the `dist` size (under 1 MB);
  - `parity.py`;
  - the old-system grep, which must print nothing;
  - `contrast.py`, every pair passing;
  - the harness on both states;
  - `cmp` on the mark.
  - SC-004: `grep -rnoE 'https?://[^")]+' dist/assets/*.css` and a scan of `dist/` JS for font or icon hosts (`fonts.googleapis`, `fonts.gstatic`, `fontsource`, `jsdelivr`, `unpkg`). Expect no remote font or icon URL.
  - SC-005: for each fact (synced, waiting or processing, failed import, error, the user's own profile), compare the colour role in `contracts/popup-ui.md` with the backend's contract Clarifications and the pill tones in `Handlers/Account/AccountPage.fs` (backend worktree). Report any difference.
  - Report each result with its numbers.

---

## Dependencies and execution order

- **Setup (T001–T004)**: T001 first. T002, T003 and T004 can run in parallel with each other. T004's calibration runs before T005.
- **US1 (T005–T007)** depends on T001 and T002. It blocks US2 and US3, because their styles use the new token names.
- **US2 (T008–T017)** runs in order, all in one file. T017 needs T004.
- **US3 (T018–T019)** depends only on US1, so it can run alongside US2 (a different file).
- **US4 (T020–T022)** is independent of US1–US3 and can run at any point after Setup.
- **Polish**: T023 runs after US2 and US3, because they drop the last uses of those tokens. T024 needs T017's measurement. T026 runs last.

## Parallel opportunities

- T002, T003 and T004 (independent scripts).
- US3 (T018–T019) alongside US2 (T008–T017).
- US4 (T020–T022) alongside anything after Setup.
- T024 alongside T025.

## Implementation strategy

1. **MVP = US1**: after T007, `tokens.css` passes the backend's parity check. That unblocks the backend's suite. Commit it and tell the backend.
2. Then US2, the popup, the most visible change, with the height check.
3. Then US3 and US4, then Polish.
4. Commit at each checkpoint, with messages in the repository's style: an imperative subject and a short body explaining why.

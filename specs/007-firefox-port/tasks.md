# Tasks: Frunchy for Firefox (desktop and Android)

**Input**: `specs/007-firefox-port/` (spec, plan, research, data-model, contracts/, quickstart)

**Tests**: no test suite; each phase ends with the checks in `quickstart.md`. The AMO script is
tested against a local fake server.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 `.gitignore`: add `dist-firefox` under the store build output block (rename that comment to
  "Store build output"). `package.json`: add `"build:firefox": "vite build --mode firefox"` and
  `"package:firefox": "npm run build:firefox && node scripts/package.mjs firefox"` next to the
  store scripts, keeping the file's existing indentation.
- [X] T001a Before changing `vite.config.ts`: `npm run build` and
  `FRUNCHY_BACKEND_URL=https://frunchy.example npm run build:store`; copy both `manifest.json` files
  to `/Users/jjchiw/.claude/jobs/1a301f83/tmp/baseline/{dev,store}.manifest.json` (the baseline
  for T003).

---

## Phase 2: User Story 1 - Scrape and sync from desktop Firefox (Priority: P1) 🎯 MVP

**Independent test**: quickstart "Build" and "Desktop Firefox" steps 1–3.

- [X] T002 [US1] `vite.config.ts`: a `firefox` mode per research R1/R2/R8 and
  `contracts/firefox-package.md`. It shares the store's `storeBackendOrigin()` (the error text says
  "store and Firefox builds"), its host permissions and its `optional_host_permissions`. It also
  sets `background: { scripts: [devManifest.background.service_worker], type: "module" }`, deletes
  `minimum_chrome_version`, and adds `browser_specific_settings`: gecko id
  `frunchy@lacalabaza.xyz`, `strict_min_version` "140.0", `data_collection_permissions.required`
  `["websiteContent", "personallyIdentifyingInfo", "authenticationInfo"]`, and gecko_android
  "142.0". Pass `browser: "firefox"` to `crx()` only in this mode and set `outDir: "dist-firefox"`.
  The `define` uses the origin as in store mode. Keep the existing comment style: one short comment
  says what the mode is for. Fix the manifest's type so `background.scripts` type-checks without
  `any`.
- [X] T003 [US1] Verify the builds: `npm run check`. Then `npm run build` and
  `FRUNCHY_BACKEND_URL=https://frunchy.example npm run build:store`, and diff both `manifest.json`
  files against the T001a baseline (expect identical).
  Then `FRUNCHY_BACKEND_URL=https://frunchy.example npm run build:firefox`. Check that
  `dist-firefox/manifest.json` matches the contract, that `dist-firefox/service-worker-loader.js`
  imports `service-worker.ts-*.js`, that no file contains `localhost`, and that
  `npx --yes web-ext@8 lint --source-dir dist-firefox` reports 0 errors (3 known
  `UNSAFE_VAR_ASSIGNMENT` warnings, R7).
- [X] T004 [US1] Smoke-test the build in Firefox as a temporary add-on, using the spike harness in
  `/Users/jjchiw/.claude/jobs/1a301f83/tmp/spike/tools/` (`run.mjs`, needs geckodriver at
  `~/.cache/selenium/geckodriver/mac-arm64/0.37.1`). Change `ID` there to `frunchy@lacalabaza.xyz`
  first. Expect the hook installed on `/history`, the hook registered, `SCROLL_STATUS` answered, and
  the popup and options screenshots rendered. A signed-in scrape is the owner's (T030).

**Checkpoint**: commit "Build Frunchy for Firefox".

---

## Phase 3: User Story 4 - Build, submit and release the Firefox version (Priority: P2)

**Independent test**: quickstart "Package and source"; the fake-AMO run of T009; actionlint clean.

- [X] T005 [US4] `scripts/package.mjs`: a `firefox` argument per `contracts/firefox-package.md`. With
  no argument the script behaves exactly as today. With `firefox` it reads `dist-firefox`, refuses
  `localhost`, refuses a dirty tree (`git status --porcelain` non-empty, with the message naming
  why), zips to `release/frunchy-<version>-firefox.zip`, and writes
  `release/frunchy-<version>-source.zip` with `git archive --format=zip -o <path> HEAD`. Print both
  paths with sizes. Keep the script's style (ESM, `execFileSync`, short comments).
- [X] T006 [P] [US4] `store/firefox/SOURCE.md`: build instructions for Mozilla's reviewers (English).
  It covers the OS used (any; CI uses ubuntu-latest), Node 22.x and npm 10+,
  `npm ci`, `FRUNCHY_BACKEND_URL=https://frunchy.lacalabaza.xyz npm run build:firefox`, and that
  the output is `dist-firefox/`, identical to the submitted package. It also lists what is bundled
  (Svelte 5 compiled with Vite 8 and @crxjs/vite-plugin; fonts from @fontsource; Material Symbols
  SVGs) and that `public/injected.js` is copied unminified.
- [X] T007 [US4] Reproducibility check (SC-004). Commit first, then
  `FRUNCHY_BACKEND_URL=https://frunchy.example npm run package:firefox`. Unzip the source archive
  into an empty directory under `/Users/jjchiw/.claude/jobs/1a301f83/tmp/`, follow SOURCE.md there,
  and `diff -r` its `dist-firefox` with the unzipped package. Expect no differences. Also check
  that `package.mjs firefox` refuses a dirty tree and a `localhost` build.
- [X] T008 [US4] `scripts/publish-firefox.sh` per research R9 and the contract. Model it on
  `scripts/publish-chrome.sh`: the header comment with usage and environment, `set -euo pipefail`,
  `fail()`, env checks, `::add-mask::` before any network call, and the Authorization header given
  to curl as a config on stdin. JWT: base64url of the header and claims (`jq -cn` for the claims,
  `jti` from `openssl rand -hex 16`, `iat` = `date +%s`, `exp` = iat+60), HMAC-SHA256 with the
  secret. **The secret must not appear in any process's arguments**, so `openssl dgst -hmac
  "$secret"` is not allowed. Compute HMAC by its definition with the bash builtin `printf` and
  `openssl dgst -sha256 -binary` reading stdin: key ≤ 64 bytes padded with zeros (hash it first if
  longer), inner = sha256((K⊕0x36…) ‖ msg), mac = sha256((K⊕0x5c…) ‖ inner). Write a fresh token
  for each request. Steps: upload (multipart `upload=@zip`, `channel=listed`) → poll
  `GET …/upload/<uuid>/` every `POLL_SECONDS` (default 10, at most 60 polls) until `processed` →
  if not `valid`, print `.validation.messages[]` (type, message, file) and fail → if `VERSION` is
  set and `.version` differs, fail → `POST /api/v5/addons/addon/$ADDON_ID/versions/` multipart
  `upload=<uuid>`, `source=@<source zip>` (on 404 fail with "the add-on doesn't exist on AMO yet;
  submit the first version by hand (store/firefox/README.md)") → if the `APPROVAL_NOTES` file
  exists, `PATCH …/versions/<version>/` JSON `{approval_notes}` built with
  `jq -Rs '{approval_notes: .}'` → print "Submitted <version> for review" plus the version's
  `file.status` if present. API responses hold no secrets and may be printed on error.
- [X] T009 [US4] Test T008 against a fake AMO: a small Python 3 `http.server` in
  `/Users/jjchiw/.claude/jobs/1a301f83/tmp/fakeamo/`, run with `python3 -I`, with
  `API_BASE=http://127.0.0.1:<port>` and `POLL_SECONDS=0`. The fake server must verify the JWT
  (HS256 over header.payload with the test secret, `iss`, `exp - iat <= 300`), check the multipart
  fields, and return AMO-shaped JSON. Cases: happy path (one "not processed" poll first, then
  valid; version created; PATCH received with the notes); invalid upload (messages printed, exit
  1, no version call); version mismatch; 404 on version create (the hand-first message); 401;
  missing env var; missing zip. Also check the script's HMAC against `openssl dgst -sha256 -hmac`
  for a 64-hex secret and a >64-byte secret (in the test only). Run `ps` while it runs, or reason
  from the code, to confirm the secret never appears in argv. Record the outputs in the report.
- [X] T010 [US4] `.github/workflows/release.yml` per the contract. Rename it to `name: Release`. In
  `package`, after `npm run package`, add `npm run package:firefox` with the same
  `FRUNCHY_BACKEND_URL` env and an `upload-artifact` (same pinned SHA) named
  `frunchy-${{ steps.version.outputs.version }}-firefox` with both files. Add a new
  `publish-firefox` job modelled on `publish`: same `needs`, `if`, `environment`, `permissions`
  and Bella env. Its sparse checkout covers `scripts/publish-firefox.sh` and
  `store/firefox/approval-notes.md`; it downloads that artifact and runs
  `bella run -- bash scripts/publish-firefox.sh "release/frunchy-$VERSION-firefox.zip" "release/frunchy-$VERSION-source.zip"`
  with `VERSION` in `env`. Update the top comment (the jobs and what each may do) and the
  concurrency group name to `store-release`. Keep the SHA pins, 4-space YAML, and no `${{ }}`
  inside `run:`.
- [X] T011 [US4] Lint with `/Users/jjchiw/.claude/jobs/1a301f83/tmp/tools/actionlint`
  (`-shellcheck /Users/jjchiw/.claude/jobs/1a301f83/tmp/tools/shellcheck`) and run shellcheck on
  both publish scripts. No findings.
- [X] T012 [P] [US4] `store/firefox/`: `README.md` (what's here; build the upload; the owner checklist
  for AMO: developer account and 2FA; first listed version by hand with the zip, the source zip and
  SOURCE.md, license, categories, summary from `listing.*.md`, privacy policy URL, screenshots
  reused from `store/images/`; then API credentials at
  addons.mozilla.org/developers/addon/api/key/ into Bella Baxter as `AMO_JWT_ISSUER` and
  `AMO_JWT_SECRET` in the same project and environment as the Chrome secrets; then later versions
  from the workflow), `listing.en.md` and `listing.es.md` (adapt `store/listing.*.md`: AMO name,
  summary ≤ 250 chars, description, categories, support/homepage; same tone, no comparisons,
  Spanish with "tú"), `privacy.md` (the data-collection declaration and why each category, the
  permissions explained for AMO reviewers, reusing `store/privacy-practices.md` wording), and
  `approval-notes.md` (short notes for reviewers: how to build (point to SOURCE.md in the source
  archive), what `injected.js` does and why it runs in the page world, the R7 warnings, that a
  Crunchyroll account is needed to exercise it).
- [X] T013 [US4] `store/README.md`: the workflow's new name in "How a release works", and one line
  near the top pointing to `store/firefox/README.md` for the Firefox add-on. No other changes
  (006 edits this directory).

**Checkpoint**: commit "Package and submit the Firefox version from the release workflow".

---

## Phase 4: User Story 2 - Site access the user can see and fix (Priority: P1)

**Blocked by**: 006 landing on `main`. Rebase `007-firefox-port` on it first.

- [ ] T014 [US2] `src/components/Icon.svelte`: add `lock_open`.
- [ ] T015 [P] [US2] `public/_locales/{en,es}/messages.json`: `hero_access_title`,
  `hero_access_text`, `hero_access_server_title`, `hero_access_server_text` (with the host as a
  substitution), `allow_access`, `hero_private_title`, `hero_private_text`, per
  `contracts/popup-access.md`, matching the existing tone and "tú".
- [ ] T016 [US2] `src/components/Popup.svelte`: the access and private states per
  `contracts/popup-access.md`. `TabState` gains `"access" | "private"`; the access check runs before
  `probeTab`'s URL test; `permissions.onAdded`/`onRemoved` listeners re-check (removed on destroy);
  the button's handler calls `chrome.permissions.request` with no `await` before it; and the hero
  title/text plus the main card's button cover both new states.
- [ ] T017 [US2] Measure: popup screenshots in en and es for `access` (both variants) and `private`,
  and re-measure the tallest existing state. All ≤ 600 px. Desktop Firefox: the revoke/allow cycle
  of quickstart steps 4–6.

---

## Phase 5: User Story 3 - Firefox for Android (Priority: P2)

**Gate**: T018 must pass before T019–T021.

- [ ] T018 [US3] Device check (owner, or emulator `Pixel_7_API_VanillaIceCream`): signed in on
  Firefox for Android, a temporary install of `dist-firefox`, then `/history`, the popup, and a
  scrape (research R5.1, R5.4, R5.5). Record the results in research.md.
- [ ] T019 [US3] `Popup.svelte`: if the active tab is the extension's own page, use the most recently
  accessed `https://www.crunchyroll.com/*` tab (R5.2).
- [ ] T020 [US3] Download JSON on Android: hide the button when `getPlatformInfo().os === "android"`
  if R5.3 shows it doesn't save.
- [ ] T021 [US3] Repeat quickstart "Firefox for Android".

---

## Phase 6: Polish

- [ ] T022 CLAUDE.md: the Firefox build in Commands; a "Firefox build" paragraph next to the store
  build one (mode, manifest differences, id, min versions, access check, release job, AMO); the
  `dist-firefox/service-worker-loader.js` check in the gotcha. After 006 lands, to avoid conflicts.
- [ ] T023 `store/README.md` "How a release works": add the `publish-firefox` job (step 4 runs both
  publish jobs, independently), the AMO secrets in the one-time setup, and a pointer to
  `firefox/README.md` for the first listed version. After 006 lands, to avoid conflicts.
- [ ] T030 Owner: a signed-in full scrape in desktop Firefox against the real backend, compared with
  Chrome (SC-001); the first listed AMO submission by hand; Bella secrets.

---

## Dependencies

- T001 → T002 → T003 → T004. T005 needs T002. T007 needs T005 and T006. T008 → T009. T010 needs
  T008 (script path) → T011. T012 and T013 are independent.
- Phase 4 waits for 006. Phase 5 waits for T018. T022 waits for 006.
- Phases 2 and 3 touch nothing that 006 edits (`vite.config.ts`, `package.json`, `.gitignore`,
  `scripts/`, `.github/workflows/release.yml`, `store/firefox/`, one line in `store/README.md`).

## Implementation strategy

Phases 2–3 now, as one branch, reviewed together. Phase 4 after 006, then Phase 5 if the device check
passes. The branch merges when Phases 2–4 and T022 are done. Android can follow as its own change.

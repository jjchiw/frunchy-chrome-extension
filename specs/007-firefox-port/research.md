# Research: Frunchy for Firefox

## Spike (2026-10-27, desktop Firefox 158.0.1, macOS)

The spike scripts were throwaway and are not committed. They used selenium-webdriver with geckodriver
0.37.1, installed the build as a temporary add-on, opened `https://www.crunchyroll.com/history`
signed out, and probed the extension from its own popup page, opened in a tab. "Hook installed"
means `XMLHttpRequest.prototype.open` was no longer native in the page, i.e. `public/injected.js`
ran in the page's world.

| Run | Build | Result |
|---|---|---|
| 1 | Chrome `dist/` with only `manifest.json` rewritten (`background.scripts` + `type: module`, gecko id, no `minimum_chrome_version`, no `use_dynamic_url`) | Installs. The background registered the hook with `world: "MAIN"` and the hook ran. The CRXJS content-script loader (dynamic `import()` of a web-accessible chunk) loaded, and the content script answered the popup's `SCROLL_STATUS` with `{ ok: true, scrolling: false }`. The popup and settings rendered with bundled fonts. `permissions.request` without a user gesture is refused ("may only be called from a user input handler"). |
| 2 | Same, with a Firefox for Android user agent at 412×915 | Crunchyroll served the same Next.js app at `/history` (no app redirect, responsive layout), and the hook ran. Signed-out only. |
| 3 | CRXJS's own Firefox target (`crx({ manifest, browser: "firefox" })`, manifest with `background.scripts`), store-style hosts, gecko settings with min 140/142 and `data_collection_permissions` | Same as run 1. The emitted manifest needs no post-processing. Two builds into different directories gave identical files. `web-ext lint`: 0 errors, 3 warnings (see R7). `permissions.getAll()` lists the declared `data_collection`. |
| 4 | Run 3 build: remove Crunchyroll access with `permissions.remove`, reload the tab; then grant it back through Firefox's own permission store (what the prompt does), reload | Removed: hook not run, content script absent ("Receiving end does not exist"), **`tab.url` hidden from the popup**, the hook's registration still listed. Granted again: hook and content script back after a reload, with no re-registration. |

Not covered: a signed-in scrape (needs the owner's account), a real Firefox for Android (GeckoView)
install, the install prompt of a signed package, and an upload to a backend.

## R1. Build: CRXJS's Firefox target, as a third Vite mode

**Decision**: `vite build --mode firefox` into `dist-firefox/`. In that mode `vite.config.ts`
derives the manifest from `manifest.json` as the store mode does (same hosts, same
`FRUNCHY_BACKEND_URL` rule), and also replaces `background.service_worker` with
`background.scripts`, drops `minimum_chrome_version`, adds `browser_specific_settings`, and passes
`browser: "firefox"` to `crx()`.

**Rationale**: CRXJS 2.7.1 (already pinned) has a `browser` option. With it, it writes the loader
under `background.scripts` and leaves out `use_dynamic_url`. Runs 1 and 3 show its content-script
loader and module background work in Firefox unchanged. One source tree, one bundler, no
post-processing.

**Alternatives considered**: one package for both browsers with both background keys (Chrome ≥ 121
ignores `scripts`). That would raise `minimum_chrome_version` from 119 to 121, put
`browser_specific_settings` into the Chrome package, and tie the two stores' review timing to each
other. Rejected: separate packages change nothing for Chrome (FR-005). A second bundling step
(webextension-polyfill, a different plugin): unnecessary given the spike.

## R2. Minimum Firefox versions: 140 desktop, 142 Android

**Decision**: `gecko.strict_min_version: "140.0"`, `gecko_android.strict_min_version: "142.0"`.

**Rationale**: `world: "MAIN"` in `scripting.registerContentScripts` needs 128. The
`data_collection_permissions` key is read from 140 on desktop and 142 on Android. Below that, the
validator warns that the key is unsupported (run 1 with 128). 140 is an ESR, so ESR users are
covered.

## R3. Site access is optional in Firefox: check it from the popup

**Decision**: the popup checks `chrome.permissions.contains` for `https://www.crunchyroll.com/*` and,
when a sync key is set, for the configured backend origin. This happens **before** it looks at the
active tab. When access is missing it shows an access card whose button calls
`chrome.permissions.request` for the missing origins, from the click. After a grant the existing
flow continues (the content script appears after a reload, which the popup already offers).
Contract: [contracts/popup-access.md](contracts/popup-access.md).

**Rationale**: Firefox lets the user refuse or remove host access, and doesn't prompt for hosts
added by an update. Run 4 shows that without access the popup can't even read the tab's URL, so
today's popup would say "Open your history" on the history page. The check has to come first.
`request` must come from a click (run 1). The hook's registration survives a revoke, and a grant
brings it back on the next load (run 4), so the background needs no `permissions.onAdded`
handler and `service-worker.ts` doesn't change.

The same code runs in Chrome. Chrome users can also restrict site access ("on click", "on
specific sites"), so the card helps there too, and with access granted nothing changes.

**Alternatives considered**: an onboarding page opened at install. It doesn't help after a later
revoke or an update, and Android opens it as a tab the user may never see again. A check in the
settings page only: the popup is where the failure shows.

## R4. Private windows

**Decision**: when the active tab is `incognito` and `chrome.extension.isAllowedIncognitoAccess()`
is false, the popup says Frunchy isn't allowed in private windows. It doesn't offer a reload.

**Rationale**: both browsers keep extensions out of private windows by default. The popup's
"reload the tab" advice can't help there. Cheap to detect, and shared with Chrome.

## R5. Firefox for Android unknowns (device check first)

Each one is answered on a device before any Android work. The owner's phone is best. An emulator
also works: this Mac has the Android SDK and a `Pixel_7_API_VanillaIceCream` AVD, with Firefox
from Mozilla's release APKs and `web-ext run -t firefox-android`.

1. **Signed-in Crunchyroll**: the same `/history` page, `watch-history` requests and
   `/auth/v1/token` + `/accounts/v1/me/multiprofile` responses as desktop, so the hook captures the
   profile and pages, and paging works. This is the gate for User Story 3.
2. **The popup's tab**: Firefox for Android shows the action popup in its own panel.
   `tabs.query({ active: true, currentWindow: true })` may return the popup's own tab. Fallback
   when the result is the extension's own page: the most recently accessed Crunchyroll tab
   (`tabs.query({ url })` sorted by `lastAccessed`).
3. **Download JSON** from the popup (`<a download>` with a blob URL): if it doesn't save a file,
   hide the button when `chrome.runtime.getPlatformInfo()` says `android`, rather than adding the
   `downloads` permission.
4. **`permissions.request`** from the popup and settings on Android: it shows a prompt and the
   popup survives it. If the popup closes while the prompt is up, the next open simply re-checks.
5. **Install-time access** on Android: whether the install prompt grants the hosts or leaves them to
   the access card. Either way the card handles it.

## R6. Package, source archive and reproducibility

**Decision**: `npm run package:firefox` = `build:firefox` + `scripts/package.mjs firefox`, which:
- refuses a build that contains `localhost`, as the store package does;
- zips `dist-firefox/` into `release/frunchy-<version>-firefox.zip`;
- writes `release/frunchy-<version>-source.zip` with `git archive HEAD`, so only committed files are
  included (no `node_modules`, no `.private/`, no ignored tooling);
- refuses to build the source archive from a dirty tree, since the archive wouldn't match the
  package.

The archive includes `store/firefox/SOURCE.md` (Node 22, `npm ci`,
`FRUNCHY_BACKEND_URL=<origin> npm run build:firefox`, output in `dist-firefox/`).

**Rationale**: AMO requires the source plus build instructions for any minified or bundled code,
and its reviewers rebuild and compare the files. Run 3 shows the build is deterministic given the
lockfile. Zip timestamps differ between machines, which is why the spec compares files, not zip
bytes.

## R7. Validator warnings to expect

`web-ext lint` (the same validator AMO runs) reports `UNSAFE_VAR_ASSIGNMENT` three times in the
shared chunk. These are Svelte's template cloning (`innerHTML` of compile-time static markup) and
the Material Symbols SVGs that `Icon.svelte` inserts with `{@html}` from `?raw` imports. They are
warnings, not errors. They come from bundled, static strings, never from page or user data. The
submission notes say so, so a reviewer doesn't have to work it out.

## R8. Add-on id and data-collection declaration

**Decision**: `gecko.id` is `frunchy@lacalabaza.xyz` (owner, 2026-10-27), committed in
`vite.config.ts`. Data collection:
`required: ["websiteContent", "personallyIdentifyingInfo", "authenticationInfo"]`, which mirrors the
Chrome privacy answers (history responses, profile id and name, sync key).

**Alternatives considered**: `optional` data collection, asked for when the user saves a sync key.
It's more exact, since nothing leaves the browser without a key, but it adds another runtime prompt
and permission flow for little gain.

## R9. Distribution and release: listed, submitted by the workflow

**Decision** (owner, 2026-10-27): listed on AMO. The release workflow submits each new version.

- The `package` job (no secrets) also runs `npm run package:firefox`. It uploads the Firefox zip and
  the source zip as the artifact `frunchy-<version>-firefox`.
- A new `publish-firefox` job (environment `production`, Bella Baxter OIDC, same conditions as
  `publish`) downloads that artifact, gets `AMO_JWT_ISSUER` and `AMO_JWT_SECRET` from Bella, and
  runs only `scripts/publish-firefox.sh`. Like `publish-chrome.sh`, that's bash, curl, jq and
  openssl, and never npm.
- `publish` and `publish-firefox` are independent jobs, so one store failing doesn't block or undo
  the other. A dry run runs neither.

`scripts/publish-firefox.sh <zip> <source zip>` against AMO API v5
(<https://mozilla.github.io/addons-server/topics/api/>):
1. JWT: header `{"alg":"HS256","typ":"JWT"}`, claims `iss` = API key, `jti` = random hex,
   `iat` = now, `exp` = now + 60 (AMO allows at most 5 minutes). Signed with
   `openssl dgst -sha256 -hmac` and base64url, and a new token for every request. The secret goes
   to openssl through `-macopt hexkey:` or stdin rather than argv when possible. The header goes
   to curl as a config on stdin, as in the Chrome script.
2. `POST /api/v5/addons/upload/`, multipart `upload=@<zip>`, `channel=listed` → `uuid`.
3. Poll `GET /api/v5/addons/upload/<uuid>/` until `processed`. If it isn't `valid`, print the
   validation messages and fail. If `version` isn't `$VERSION`, fail.
4. `POST /api/v5/addons/addon/frunchy@lacalabaza.xyz/versions/`, multipart `upload=<uuid>`,
   `source=@<source zip>` (source can only be sent as multipart).
5. `PATCH /api/v5/addons/addon/frunchy@lacalabaza.xyz/versions/<version>/`, JSON
   `{"approval_notes": <store/firefox/approval-notes.md>}`. These are the reviewer notes: build
   steps and the R7 warnings. They aren't a multipart field of version create.

Version create inherits the license from the previous version, and the listing metadata (name,
summary, categories) already exists. That's why the **first listed version is created by the owner
in AMO's web UI**: it needs a license, summary and categories, which are not in the manifest. The
script assumes the add-on exists and says so when AMO answers 404.

**Alternatives considered**: `web-ext sign` (npm code next to the secrets, against the workflow's
rule). `PUT /addons/addon/<guid>/`, which creates the add-on if missing: rejected so the first
listing is reviewed by hand.

## R10. Interaction with 006 (auto-sync, in progress)

006 opens a minimized window on a timer (`chrome.windows`). Desktop Firefox has `windows`.
Firefox for Android doesn't, and has no minimized state. 007 doesn't change 006. Once both land, a
follow-up decides whether auto-sync is offered on Firefox desktop, and it hides the option on
Android (`getPlatformInfo().os === "android"`).

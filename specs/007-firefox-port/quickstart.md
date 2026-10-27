# Quickstart: validate the Firefox port

## Build

```bash
npm ci
npm run check
FRUNCHY_BACKEND_URL=https://<domain> npm run build:firefox      # dist-firefox/
npx web-ext lint --source-dir dist-firefox                        # expect 0 errors (R7: 3 known warnings)
```

`npm run build` and `npm run build:store` must still produce the same Chrome manifests as on `main`
(`diff` the two `manifest.json` files).

## Desktop Firefox (User Stories 1 and 2)

1. `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist-firefox/manifest.json`.
   (Or `npx web-ext run --source-dir dist-firefox`.)
2. Sign in to Crunchyroll, open the popup, open history, Scrape. Expect pages stored and the
   newest episodes shown, as in Chrome.
3. Settings: set the sync key. Expect uploads and the import line. Compare the import with a Chrome
   scrape of the same account (SC-001).
4. `about:addons` → Frunchy → Permissions → turn off `www.crunchyroll.com`. Open the popup: the
   access card. Press the button, allow, reload the tab. Scrape works (SC-002).
5. Same with the server's permission turned off and a key set: the server variant of the card.
6. Open Crunchyroll in a private window: the private-window message, no reload button.
7. Switch Firefox to Spanish; check the access card fits within 600 px.

## Firefox for Android (User Story 3, gated by R5)

Phone: install from a listed AMO version (or a signed unlisted one via "Install add-on from file").
Emulator: `emulator -avd Pixel_7_API_VanillaIceCream`, install Firefox, enable "Remote debugging via
USB" in its settings, then
`npx web-ext run -t firefox-android --android-device emulator-5554 --firefox-apk org.mozilla.firefox --source-dir dist-firefox`.

1. Sign in to Crunchyroll in Firefox, open `/history`, open Frunchy from the menu. Expect the popup to
   find the Crunchyroll tab (R5.2).
2. Scrape, then check pages stored and the sync status.
3. Open settings (a tab), enter the key with the on-screen keyboard.
4. Download JSON: saved, or not offered (R5.3).

## Package and source (User Story 4)

```bash
git status --porcelain                       # must be empty
FRUNCHY_BACKEND_URL=https://<domain> npm run package:firefox
unzip -l release/frunchy-<version>-firefox.zip
```

Reproducibility (SC-004): unzip the source archive into an empty directory, follow
`store/firefox/SOURCE.md`, and `diff -r` its `dist-firefox/` against the unzipped package. Expect
no differences.

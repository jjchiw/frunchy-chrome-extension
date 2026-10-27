# Implementation Plan: Frunchy for Firefox (desktop and Android)

**Branch**: `007-firefox-port` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

## Summary

The spike ([research.md](research.md)) ran the current code in desktop Firefox 158 with no source
changes, so the port is mostly packaging plus one popup state:

1. **Build**: a third Vite mode, `firefox`, using CRXJS's own Firefox target. It writes
   `dist-firefox/` with the store build's hosts and default backend, `background.scripts` instead of
   a service worker, and the gecko id, minimum versions (140 desktop, 142 Android) and
   data-collection declaration ([contracts/firefox-package.md](contracts/firefox-package.md)). The
   Chrome builds don't change.
2. **Access check**: the popup checks site access before it looks at the tab, and offers one button
   that asks for whatever is missing. It also says when a private window is the problem. Shared by
   both browsers ([contracts/popup-access.md](contracts/popup-access.md)).
3. **Android**: a device check first (R5). If signed-in Crunchyroll behaves as on desktop, two
   small fallbacks follow: finding the Crunchyroll tab when the popup is its own tab, and hiding
   Download JSON if it can't save. Otherwise Android is dropped and desktop ships alone.
4. **Release**: `npm run package:firefox` writes the Firefox zip and a `git archive` source zip with
   reviewer build instructions. The release workflow builds both in `package`, and a new
   `publish-firefox` job submits them to AMO as a new listed version through
   `scripts/publish-firefox.sh` (bash/curl/jq/openssl, AMO API v5, R9). The owner creates the first
   listed version by hand. Listing texts, privacy answers, reviewer notes and the owner's checklist
   go in `store/firefox/`. Add-on id `frunchy@lacalabaza.xyz`.

## Technical Context

**Language/Version**: TypeScript 6, Svelte 5, Node ≥ 22.12 (ESM `.mjs` scripts), GitHub Actions
YAML.

**Primary Dependencies**: none new. `@crxjs/vite-plugin` 2.7.1 already has `browser: "firefox"`.
`web-ext` is used through `npx` for linting and running, and is not added to `package.json`.

**Storage**: unchanged ([data-model.md](data-model.md)).

**Testing**: `npm run check`, all three builds, `web-ext lint` (0 errors), and a `diff` of the
Chrome manifests against `main`. A desktop Firefox run follows [quickstart.md](quickstart.md):
temporary add-on, a signed-in scrape by the owner, and the revoke/allow cycle. For the popup's new
states, screenshots in en/es with the height measured. Android goes through the R5 device check.

**Target Platform**: Firefox ≥ 140 desktop, Firefox for Android ≥ 142; Chrome ≥ 119 unchanged.

**Constraints**: no `localhost` in the Firefox package. Popup ≤ 600 px tall in every state, Spanish
included. `permissions.request` only from a click. The package must be reproducible from
`git archive HEAD`. The job with secrets in the release workflow runs only our scripts.

**Scale/Scope**: `vite.config.ts`, `package.json`, `scripts/package.mjs`, new
`scripts/publish-firefox.sh`, `.github/workflows/release.yml` (`package` job, new
`publish-firefox` job), `Popup.svelte`, `Icon.svelte` (one icon), two
locale files, `.gitignore` (`dist-firefox/`), new `store/firefox/` (README, listing en/es,
privacy, SOURCE.md), CLAUDE.md.

## Constitution Check

`.specify/memory/constitution.md` is still the unfilled template, so the rules are CLAUDE.md's:

| Rule | Status |
|---|---|
| `manifest.json` is the source of truth; build manifests are derived in `vite.config.ts` | Pass: the Firefox manifest is derived like the store one |
| Keep entry-point names unique; check the loader points at `service-worker.ts-*.js` | Pass: unchanged entries; check `dist-firefox/service-worker-loader.js` too |
| Fonts and icons bundled, never remote | Pass: nothing new remote; the new icon is added to `Icon.svelte` |
| Popup fits 600 px, Spanish included | Must re-measure: the access card replaces the main card's text; it must not exceed the tallest current state (594 px) |
| UI strings localised en/es | Pass: new `hero_access_*`, `hero_private_*`, `allow_access` keys in both |
| Release: the secrets job runs only our script; npm only in the job without secrets | Pass: Firefox packaging goes in `package`; `publish-firefox` runs only `publish-firefox.sh` (no npm, no `web-ext sign`); `publish` doesn't change |
| Every action pinned to a SHA | Pass: `publish-firefox` reuses the pins already in the workflow |
| Store images use invented data only | Pass: AMO screenshots reuse the store-assets fixtures |
| No token or header leaves the page world | Pass: `injected.js` doesn't change |

## Sequencing with 006 (auto-sync, other session)

006 edits `Popup.svelte`, the locale files, CLAUDE.md and `store/`. 007's overlaps:
- `Popup.svelte`: the access/private states sit in `probeTab` and the main card, while 006 adds an
  auto-sync status line. **Land 006 first and rebase 007's popup task on it**, or agree on the
  card's slot before either merges.
- Locale files: new keys only, so a merge conflict is mechanical.
- CLAUDE.md: one new "Firefox build" paragraph and one line in Commands.
- `store/`: 007 adds only `store/firefox/`.
The build, package and workflow tasks touch nothing 006 touches and can go first.

## Project Structure

```text
specs/007-firefox-port/          spec, plan, research, data-model, quickstart, contracts/, checklists/
vite.config.ts                   firefox mode: derived manifest, crx({ browser: "firefox" }), dist-firefox/
package.json                     build:firefox, package:firefox
scripts/package.mjs              "firefox" target: firefox zip + git-archive source zip, refusals
scripts/publish-firefox.sh       AMO API v5 upload + version create with source (new)
.github/workflows/release.yml    package: also package:firefox; new publish-firefox job; name "Release"
.gitignore                       dist-firefox/
src/components/Popup.svelte      access + private states, Android tab fallback, platform-gated download
src/components/Icon.svelte       lock_open
public/_locales/{en,es}/messages.json
store/firefox/                   README (owner checklist + AMO setup), listing.{en,es}.md, privacy.md,
                                 SOURCE.md (reviewer build steps), approval-notes.md
store/README.md                  workflow name, link to store/firefox/
CLAUDE.md                        Firefox build, access check, commands
```

**Structure Decision**: existing layout. A third build mode next to `store`; no new source
directories.

## Phases

0. **Gate check (owner)**: R5.1 on a phone or the emulator (signed-in `/history` and scrape with a
   temporary install). FR-012, FR-013 and the id were answered on 2026-10-27.
1. **Build + package + CI + AMO submission** (no overlap with 006): R1, R2, R6, R8, R9,
   `web-ext lint`.
2. **Popup access/private states** (after 006's popup change): R3, R4; en/es, height check.
3. **Android fallbacks** (only if R5.1 passes): R5.2–R5.4.
4. **Docs and listing**: `store/firefox/`, CLAUDE.md.

## Complexity Tracking

No violations.

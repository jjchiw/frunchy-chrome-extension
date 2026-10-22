# Implementation Plan: Release from the workflow, and point the store build at your own Frunchy

**Branch**: `005-self-hosted-release` | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

## Summary

Two independent changes:
1. The release workflow takes a `version` input. A new `release` job, with write access and no
   third-party code, sets it in the three version files through `scripts/set-version.mjs`,
   commits, tags, and hands the commit to the existing `package` and `publish` jobs
   ([contracts/release-workflow.md](contracts/release-workflow.md)).
2. The store build stops being fixed to one server. The settings page is the same in both builds,
   the store manifest gets optional `https://*/*` access, and only `https://` addresses are
   accepted there, decided from the manifest at runtime rather than a build flag
   ([research.md](research.md) R5).

## Technical Context

**Language/Version**: TypeScript 6, Svelte 5, Node ≥ 22 for the scripts (ESM `.mjs`), GitHub
Actions YAML, bash.

**Primary Dependencies**: none new. `npm version` is part of Node's npm.

**Storage**: unchanged. The `onInstalled` rewrite of `settings` is removed.

**Testing**: `npm run build`, `npm run check`, `npm run package`; `set-version.mjs` run in a
scratch copy against every case; actionlint + shellcheck; the options-page harness screenshot;
the owner's dry run of the workflow with `publish` off.

**Target Platform**: Chrome ≥ 119; GitHub-hosted ubuntu runners.

**Constraints**: the job with write access runs no `npm ci`; the job with secrets runs only our
script; no `localhost` in the store bundle; the popup is untouched.

**Scale/Scope**: `release.yml`, one new script, `vite.config.ts`, `settings.ts`, `vite-env.d.ts`,
`service-worker.ts`, `Settings.svelte`, two locale files, the store-assets config and two
screenshots, four docs. Plus the lock-file drift fix and `package.json` indentation.

## Constitution Check

| Rule (CLAUDE.md / feature 003) | Status |
|---|---|
| `manifest.json` is the source of truth; store manifest derived in `vite.config.ts` | Pass |
| The job with secrets runs only our script; the job running npm has no secrets | Pass: the new `release` job has write access but runs no npm install; `package` is unchanged |
| Every action pinned to a SHA | Pass: no new actions |
| Store images use invented data | Pass: regenerated from the same fixtures |
| A different backend counts as a different Frunchy user | Pass: the existing reset on save stays |
| The popup fits 600 px | Pass: untouched |

## Project Structure

```text
specs/005-self-hosted-release/   spec, plan, research, quickstart, contracts/release-workflow.md, checklists/, tasks.md
.github/workflows/release.yml    release job; package/publish wiring and conditions
scripts/set-version.mjs          version check and write (new)
vite.config.ts                   store: optional https://*/*; no __STORE_BUILD__
src/settings.ts, src/vite-env.d.ts, src/background/service-worker.ts, src/components/Settings.svelte
public/_locales/{en,es}/messages.json   drop connects_to
scripts/store-assets/vite.config.mjs, store/images/screenshot-{en,es}-4.png
store/README.md, store/listing.{en,es}.md, store/privacy-practices.md, CLAUDE.md, specs/002-store-release/spec.md
package.json, package-lock.json  lock version back in sync (0.1.1), 4-space indentation restored
```

**Structure Decision**: existing layout; one new script in `scripts/`.

## Complexity Tracking

No violations.

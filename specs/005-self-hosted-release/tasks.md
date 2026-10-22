# Tasks: Release from the workflow, and point the store build at your own Frunchy

**Input**: `specs/005-self-hosted-release/` (spec, plan, research, contracts/release-workflow.md, quickstart)

**Tests**: no test suite; each phase ends with the checks in `quickstart.md`.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Repair the version drift from the hand bump: run `npm version 0.1.1 --no-git-tag-version --ignore-scripts --allow-same-version` so `package-lock.json` says 0.1.1, then restore `package.json`'s 4-space indentation (the repository's style; the editor left it mixed). `manifest.json` already says 0.1.1. Commit as "Bring package-lock.json to 0.1.1".

---

## Phase 2: User Story 1 - Release from the workflow page (Priority: P1)

- [X] T002 [US1] Add `scripts/set-version.mjs` per research R2 and `contracts/release-workflow.md`: usage `node scripts/set-version.mjs [version]`; header comment; validation before any write (format, higher than current, `git tag -l v<v>` empty via `execFileSync`); then `npm version <v> --no-git-tag-version --ignore-scripts` (`execFileSync("npm", …, { stdio: "inherit" })`) and `manifest.json` rewritten with `JSON.stringify(m, null, 2) + "\n"`; print the version. Match `scripts/package.mjs`'s style (2-space, ESM, short comments).
- [X] T003 [US1] Test T002 in a scratch copy (`git worktree` is not allowed; copy the files `manifest.json`, `package.json`, `package-lock.json`, `scripts/` into `/Users/jjchiw/.claude/jobs/0e1ec898/tmp/setver/` with a `git init` and a tag `v0.3.0`) and run every case in quickstart §2. Record outputs.
- [X] T004 [US1] Edit `.github/workflows/release.yml` per research R1, R3 and the contract (keep the 4-space YAML style and the SHA pins; keep the existing comments' tone):
  - `workflow_dispatch.inputs.version`: `type: string`, `required: false`, description "Version to release (major.minor.patch); blank = next patch. Used only when publish is on".
  - New job `release` before `package`: `if: ${{ github.event_name == 'workflow_dispatch' && inputs.publish }}`; `permissions: contents: write`; `outputs: version, sha`; steps: "Only from the default branch" (`env: REF: ${{ github.ref }}`, `DEFAULT: ${{ github.event.repository.default_branch }}`; if `$REF != refs/heads/$DEFAULT`, `echo "::error::releases are made from $DEFAULT; run the workflow there"` and `exit 1`, before anything else), checkout (`fetch-depth: 0`, credentials kept, since it pushes), setup-node (no cache), "Set the version" (`env: VERSION: ${{ inputs.version }}`; `v=$(node scripts/set-version.mjs "$VERSION")`; write `version=$v` to `$GITHUB_OUTPUT`), "Commit and tag" (`git config user.name "github-actions[bot]"`, `user.email "41898282+github-actions[bot]@users.noreply.github.com"`, `git commit -am "Release v$VERSION"`, `git tag "v$VERSION"`, `git push origin HEAD "v$VERSION"`, `sha=$(git rev-parse HEAD)` to the output). Pass the version between steps through `env`/outputs, never inline `${{ }}` inside `run:`.
  - Because `package` requires `release` to have succeeded or been skipped, a failed `release` (wrong branch, bad version, existing tag, push refused) stops the run with its message and nothing is built or published.
  - `package`: `needs: release`, `if: ${{ !cancelled() && (needs.release.result == 'success' || needs.release.result == 'skipped') }}`; checkout `ref: ${{ needs.release.outputs.sha || github.sha }}`; the version step also checks `needs.release.outputs.version` when non-empty (pass it as `RELEASE_VERSION` env).
  - `publish`: `needs: [release, package]`, `if: ${{ !cancelled() && needs.package.result == 'success' && (github.event_name == 'push' || needs.release.result == 'success') }}`.
  - Update the top comment: three jobs, what each may do.
- [X] T005 [US1] Lint: `actionlint` with `shellcheck` (binaries at `/Users/jjchiw/.claude/jobs/0e1ec898/tmp/actionlint-dl/actionlint` and `/Users/jjchiw/.claude/jobs/0e1ec898/tmp/release-tools/sc/shellcheck-v0.10.0/shellcheck`; run from a tiny zsh script in the scratch dir, since the worktree guard refuses long one-liners). No findings.
- [X] T006 [US1] `store/README.md`: rewrite "How a release works" (the workflow-input flow first; the tag path as the alternative; `publish` off = dry run; releases only from `main`; a push by the workflow token starts no second run) and add to the one-time setup: the environment's deployment rule must allow branch `main` as well as `v*` tags; if `main` is protected, allow the token's push or use the tag path. Update the owner checklist's "raise version" item.

**Checkpoint**: commit.

---

## Phase 3: User Story 2 - Point the store build at your own Frunchy (Priority: P1)

- [X] T007 [US2] Remove the fixed backend (research R5): `src/settings.ts` (drop `FIXED_BACKEND`; `getSettings` back to the spread without override; keep the comments that still apply), `src/vite-env.d.ts` (drop `__STORE_BUILD__`), `src/background/service-worker.ts` (drop `adoptFixedBackend`, restore the original `onInstalled`, trim imports), `public/_locales/{en,es}/messages.json` (drop `connects_to`), `vite.config.ts` (store mode: `manifest.optional_host_permissions = ["https://*/*"]`; drop the `__STORE_BUILD__` define; fix the comments: the store build has a default backend, not a fixed one).
- [X] T008 [US2] `src/components/Settings.svelte`: remove the `FIXED_BACKEND` branches so the markup is the dev markup again. Add the https rule: `const allowsHttp = chrome.runtime.getManifest().optional_host_permissions?.includes("http://*/*") ?? false;` and in `saveAndCheck`, after computing `origin`, if `origin !== DEFAULT_BASE_URL && !allowsHttp && !origin.startsWith("https://")` → `result = { ok: false, text: t("err_invalid_url") }; return;` with a one-line comment (the store build reaches only secure sites). Everything else (permission request, reset on change) unchanged.
- [X] T009 [US2] `scripts/store-assets/vite.config.mjs`: drop `__STORE_BUILD__`; `__BACKEND_URL__: JSON.stringify(process.env.FRUNCHY_BACKEND_URL ?? "https://frunchy.example")`. Then `npm run store:assets` and check `store/images/screenshot-en-4.png` and `-es-4.png` show the server field with the default address. Commit only the two options images (the other images should be byte-identical or differ only by the scraping-animation frame; don't commit unrelated image changes).
- [X] T010 [P] [US2] Texts: `store/listing.en.md` and `.es.md` gain one sentence in the long description (en: "Frunchy is self-hosted: if you run your own Frunchy server, enter its address in the extension's settings." es: "Frunchy se puede autoalojar: si tienes tu propio servidor de Frunchy, escribe su dirección en los ajustes de la extensión."). `store/privacy-practices.md`: replace the `<backend>/*` host-permission answer with one covering the default origin plus the optional `https://*/*` (research R6), and keep the "talks to no other server" claim true ("only Crunchyroll and the Frunchy server the user configured").
- [X] T011 [US2] Checks: `npm run build`, `npm run check`, `FRUNCHY_BACKEND_URL=https://frunchy.example npm run package`, the manifest assertions and the grep in quickstart §1. Options-page harness (quickstart §4): reuse `/Users/jjchiw/.claude/jobs/0e1ec898/tmp/store-tools/harness/` (it mounts `Settings.svelte`; update its defines; stub `chrome.runtime.getManifest` to return the store manifest's `optional_host_permissions`, and record `chrome.permissions.request` calls). Run the http and https save cases.

**Checkpoint**: commit.

---

## Phase 4: Polish

- [X] T012 [P] CLAUDE.md: the store-build paragraph (default backend, optional `https://*/*`, https-only rule read from the manifest, no fixed backend or install-time migration) and the release paragraph (the `release` job, `scripts/set-version.mjs`, releases from `main`, the environment rule). Keep the style.
- [X] T013 [P] `specs/002-store-release/spec.md`: add under the title "**Superseded in part**: FR-003 and FR-004 (the fixed backend) by `specs/005-self-hosted-release/`."
- [X] T014 Final run of quickstart §1–§4; report numbers and outputs.

## Dependencies

T001 first. US1 (T002–T006) and US2 (T007–T011) are independent and may interleave; T003 after T002, T005 after T004. T012–T013 after both stories; T014 last.

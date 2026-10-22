# Research: release from the workflow; self-hosted servers in the store build

## R1. A release job that writes the version

- **Decision**: Add a `release` job to `.github/workflows/release.yml`, before `package`. It runs
  only for `workflow_dispatch` with `publish` on. It has `permissions: contents: write`, checks the
  repository out with `fetch-depth: 0` (it needs the tags), runs `node scripts/set-version.mjs`
  with the `version` input, commits "Release v<version>" as `github-actions[bot]`, tags
  `v<version>`, pushes the branch and the tag, and outputs `sha` and `version`.
- It installs nothing: no `npm ci`, no `node_modules`. Only git, Node and `npm version` (part of
  Node's own npm) run there, so the job that can write has no third-party code (FR-004).
- `package` gets `needs: release` with
  `if: ${{ !cancelled() && (needs.release.result == 'success' || needs.release.result == 'skipped') }}`
  and checks out `ref: ${{ needs.release.outputs.sha || github.sha }}`. Its version check compares
  `manifest.json` with `package.json` as today, then with the tag name on a tag push, or with
  `needs.release.outputs.version` after a release job.
- `publish` gets `needs: [release, package]` and
  `if: ${{ !cancelled() && needs.package.result == 'success' && (github.event_name == 'push' || inputs.publish) }}`.
- **Rationale**: One run does everything, and the two security properties of feature 003 hold: the
  job with secrets runs only our script, and the job that runs npm has no secrets and no write
  access. A push made with the workflow's own token doesn't start another workflow run, so the
  tag it creates doesn't double-run anything.
- **Alternatives considered**: Overriding the version only inside the build, without a commit. The
  repository would then not record what was released, and the next release couldn't know the
  current version. Rejected.

## R2. Computing and checking the version: `scripts/set-version.mjs`

- **Decision**: A small Node script, testable on its own: `node scripts/set-version.mjs [version]`.
  - Reads the current version from `manifest.json`.
  - With no argument, bumps the patch: `0.1.1` → `0.1.2`.
  - Checks the argument is `^\d+\.\d+\.\d+$`, is higher than the current version (numeric
    comparison part by part), and that `git tag -l v<version>` prints nothing. On any failure it
    prints one line to stderr and exits 1 **before writing anything**.
  - Writes: `npm version <version> --no-git-tag-version --ignore-scripts` (which updates
    `package.json` and `package-lock.json` and keeps the file's indentation), then `manifest.json`
    through `JSON.stringify(manifest, null, 2) + "\n"`.
  - Prints the version on stdout.
- **Rationale**: The checks and the writes live in one place that can be run locally. The workflow
  passes the input through `env`, never inline in `run:`.

## R3. Only from the default branch

- **Decision**: The `release` job's first step compares `github.ref` with the repository's default
  branch and fails with an `::error::` line when they differ, before the checkout. A failed
  `release` stops the run: `package` only continues after a successful or skipped `release`.
- **Rationale**: Otherwise the job could commit and tag a feature branch, and the publish job
  would then be refused by the environment rule, leaving a stray tag.

## R4. The `production` environment

- The job's environment rule is evaluated on the run's ref. A manual release runs on
  `refs/heads/main`, so the environment's deployment rule must allow the `main` branch as well
  as `v*` tags. The Bella Baxter trust domain keeps requiring `environment == production`, so
  secrets are still readable only by runs in that environment.
- If `main` is protected against direct pushes, the release commit can't be pushed. The README says
  so and keeps the tag-by-hand path as the alternative.

## R5. The store build with a changeable server

- **Decision**: Remove the fixed backend entirely:
  - `src/settings.ts`: drop `FIXED_BACKEND`; `getSettings()` returns stored values over the default
    again. `DEFAULT_BASE_URL = __BACKEND_URL__` stays.
  - `src/vite-env.d.ts`: drop `__STORE_BUILD__`.
  - `src/background/service-worker.ts`: drop `adoptFixedBackend` and its imports; `onInstalled`
    goes back to `registerHook` + `processQueue`.
  - `src/components/Settings.svelte`: drop the `FIXED_BACKEND` branches; the page is the same in
    both builds.
  - `public/_locales/*`: drop `connects_to`.
  - `vite.config.ts`: in store mode set `optional_host_permissions` to `["https://*/*"]` instead of
    deleting it; `host_permissions` stays Crunchyroll plus the default origin. Drop the
    `__STORE_BUILD__` define.
- **https only in the store build, without a build flag**: `Settings.svelte` reads
  `chrome.runtime.getManifest().optional_host_permissions` once; if it doesn't include
  `http://*/*`, an `http:` origin other than the default is refused with `err_invalid_url` before
  any permission request. The manifest is the source of truth, so no define is needed.
- **Rationale**: FR-006 to FR-009. A store install and an unpacked dev install have different
  extension IDs and separate storage, so the install-time migration never had a case to handle.
  Optional host permissions produce no install warning; Chrome asks when `permissions.request`
  runs on save, which the dev build already does.

## R6. Store images and texts

- `scripts/store-assets/vite.config.mjs`: drop `__STORE_BUILD__`; `__BACKEND_URL__` comes from
  `process.env.FRUNCHY_BACKEND_URL` when set, else `https://frunchy.example`. The two options-page
  screenshots (`screenshot-en-4.png`, `screenshot-es-4.png`) are re-rendered and now show the
  server field.
- `store/listing.en.md` and `.es.md`: one sentence that Frunchy is self-hosted and that the
  extension's settings accept the address of your own Frunchy server.
- `store/privacy-practices.md`: the host-permission answer gains the optional
  `https://*/*` entry and the reason (self-hosting; asked only when the user enters an address,
  for that one origin). The owner pastes the updated answer into the dashboard.

## R7. Docs

- `store/README.md`: "How a release works" becomes the workflow-input flow, with the tag path as
  the alternative; the one-time setup adds "allow `main` in the environment's deployment rule" and
  the branch-protection note.
- CLAUDE.md: the store-build paragraph drops the fixed backend and names the optional permission;
  the release paragraph names the `release` job and `scripts/set-version.mjs`.
- `specs/002-store-release/spec.md`: a one-line note under the title that FR-003 and FR-004 are
  superseded by this feature.

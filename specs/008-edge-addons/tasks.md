# Tasks: Frunchy on Microsoft Edge Add-ons

**Input**: `specs/008-edge-addons/` (spec, plan, research, contracts/edge-publish.md, quickstart)

**Tests**: no test suite. The script is tested against a fake API.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: User Story 2 - A release also updates the Edge listing (Priority: P1)

- [ ] T001 [US2] `scripts/publish-edge.sh` per `contracts/edge-publish.md` and research R2/R3. Model
  it on `scripts/publish-chrome.sh` and `scripts/publish-firefox.sh`: the header comment with usage
  and environment, `set -euo pipefail`, `fail()`, env checks, masking before any request, and
  headers to curl as a config on stdin (`header = "Authorization: ApiKey …"` and
  `header = "X-ClientID: …"`). Read the `Location` header with
  `curl -D <headers file under $RUNNER_TEMP or mktemp>` (or `-w '%header{location}'`) and keep its
  last path segment. Poll with `seq 1 60` and `sleep "$POLL_SECONDS"`. Print the R3 cause messages.
- [ ] T002 [P] [US2] `store/edge/certification-notes.md`: plain text for Microsoft's testers. Cover
  what Frunchy does, that it needs a Crunchyroll account signed in at
  `https://www.crunchyroll.com/history` plus a Frunchy sync key to upload, and that without a key
  it stores the history locally. Explain why `injected.js` runs in the page world. Say it has no
  remote code. Adapt `store/firefox/approval-notes.md`; drop the source-build part, since Edge
  doesn't ask for it.
- [ ] T003 [US2] `.github/workflows/release.yml`: the `publish-edge` job per the contract. Copy
  `publish-firefox`'s shape: the same `needs`, `if`, environment, permissions, Bella env and pinned
  SHAs. Use a sparse checkout of the script and the notes, download the Chrome artifact
  `frunchy-${{ needs.package.outputs.version }}`, and pass `VERSION` through `env`. Update the top
  comment to cover three publish jobs.
- [ ] T004 [US2] Test T001 against a fake Edge API: Python 3 `http.server`, run with `python3 -I`,
  in `/Users/jjchiw/.claude/jobs/1a301f83/tmp/fakeedge/`. The fake checks both headers on every
  request, the zip body on upload, and the JSON `notes` on publish. Cases: the happy path (one
  `InProgress` poll on each operation); upload `Failed` with errors; publish `Failed` for each of
  `InProgressSubmission`, `NoModulesUpdated`, `CreateNotAllowed` and `SubmissionValidationError`;
  401; a `Location` given as a full URL; a missing `Location`; a missing env var; a missing zip.
  Also check that no secret is in argv (PATH shims logging the arguments of curl and jq, as in
  007's test). Record each case's exit code and key output.
- [ ] T005 [P] [US2] `store/edge/`:
  - `README.md`: what's here, and the owner checklist. Register as an Edge developer in Partner
    Center (free). Make the first submission by hand with `release/frunchy-<version>.zip` from
    `npm run package`. Fill properties, the listing from `listing.*.md`, the privacy policy URL, and
    screenshots from `../images/`. Choose availability and visibility. Paste the certification
    notes. After that, open Publish API, enable the new experience, and create API credentials into
    Bella as `EDGE_CLIENT_ID` and `EDGE_API_KEY`, plus `EDGE_PRODUCT_ID` (from the extension
    overview), in the same project and environment as the other stores. Renew the API key before its
    expiry date. Later versions come from the release workflow.
  - `listing.en.md` and `listing.es.md`: adapt `store/listing.*.md` and
    `store/firefox/listing.*.md` to Edge's fields (name, short description, description, category,
    search terms, support and privacy URLs). Same tone, no comparisons, Spanish with "tú".
  - `privacy.md`: Edge's privacy questions answered from `store/privacy-practices.md`.
- [ ] T006 [US2] Lint: `/Users/jjchiw/.claude/jobs/1a301f83/tmp/tools/actionlint -shellcheck /Users/jjchiw/.claude/jobs/1a301f83/tmp/tools/shellcheck .github/workflows/release.yml`
  and shellcheck on all three publish scripts. No findings.
- [ ] T007 [US2] `store/README.md`: one pointer line to `edge/README.md` next to the Firefox one. The
  Edge job joins 007's T023 (the release steps rewrite after 006).

**Checkpoint**: commit "Submit the Chrome package to Edge Add-ons from the release workflow".

---

## Phase 2: User Story 1 - Install from Edge's own store (Priority: P1)

- [ ] T008 Owner: the first submission, then a signed-in scrape in Edge from the store install
  (SC-003), and the first automated release (quickstart).

## Phase 3: Polish

- [ ] T009 CLAUDE.md: one sentence in the Release paragraph (`publish-edge`, `scripts/publish-edge.sh`,
  same zip as Chrome). Done with 007's T022, after 006.

## Dependencies

- T001 → T004. T003 needs T001's path, then T006. T002, T005 and T007 are independent.
- The branch lands after 007 (it's based on it).

# Implementation Plan: Frunchy on Microsoft Edge Add-ons

**Branch**: `008-edge-addons` (based on `007-firefox-port`) | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

## Summary

Edge runs the Chrome store package unchanged (spike, [research.md](research.md)). So this feature
needs no build work, only a listing and a third publish job:

- `scripts/publish-edge.sh` uploads the Chrome zip to the existing Edge Add-ons product and submits
  it for certification through the Update API v1.1.
- A new `publish-edge` job runs it with the Edge secrets from Bella.
- `store/edge/` holds the listing texts, the privacy answers, the certification notes and the
  owner's checklist.

([contracts/edge-publish.md](contracts/edge-publish.md))

## Technical Context

**Language/Version**: bash, GitHub Actions YAML, Markdown.

**Primary Dependencies**: none new (curl, jq).

**Storage**: none.

**Testing**: the script is tested against a fake Edge API, a local Python `http.server` that checks
the headers and body and returns the documented shapes, covering every R3 failure. Plus actionlint
and shellcheck. The real check is the owner's first automated release (quickstart).

**Target Platform**: Microsoft Edge (Chromium) ≥ 119, as Chrome; GitHub-hosted ubuntu runners.

**Constraints**: the secrets job runs only our script; no secret in argv or the log; independent of
the other publish jobs; no extension code changes.

**Scale/Scope**: one script, one workflow job, `store/edge/` (5 files), and a line each in
`store/README.md` and CLAUDE.md.

## Constitution Check

| Rule (CLAUDE.md, 003/005/007) | Status |
|---|---|
| The job with secrets runs only our script; npm only in the job without secrets | Pass |
| Every action pinned to a SHA | Pass: reuses the workflow's pins |
| No secret in argv or log | Pass: headers via curl config on stdin, masked |
| Store texts: no comparisons, Spanish "tú", invented data in images | Pass: reuses `store/images/` |
| `manifest.json` stays the development manifest | Pass: untouched |

## Project Structure

```text
specs/008-edge-addons/           spec, plan, research, quickstart, contracts/, checklists/, tasks
scripts/publish-edge.sh          Edge Add-ons Update API v1.1 (new)
.github/workflows/release.yml    new publish-edge job; top comment
store/edge/                      README (owner checklist), listing.{en,es}.md, privacy.md, certification-notes.md
store/README.md                  one pointer line to edge/README.md
```

CLAUDE.md gets one sentence in the Release paragraph. That's done together with 007's T022, after
006, to avoid conflicts.

## Complexity Tracking

No violations.

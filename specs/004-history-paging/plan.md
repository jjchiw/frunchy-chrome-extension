# Implementation Plan: Read the watch history page by page instead of scrolling

**Branch**: `004-history-paging` | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)

## Summary

The page hook (`public/injected.js`) does three new things:
- it remembers the sign-in header of the site's own `watch-history` requests, in its closure only;
- it remembers each response's `meta.next_page`;
- on request, it fetches the next page with an ordinary `XMLHttpRequest`, so the response goes
  through the existing capture path.

The content script drives a run as `paging`, one page at a time and at least 1 s apart. It falls
back to the existing scrolling when paging is unavailable or fails, and ends the run with the same
`RUN_END` reasons. The background, the popup, storage and sync stay the same. Details:
[research.md](research.md); messages: [contracts/page-messages.md](contracts/page-messages.md).

## Technical Context

**Language/Version**: TypeScript 6 (content script); plain ES5-style JavaScript in
`public/injected.js`, which is copied as is and runs in the page world, so it keeps its existing
`var`/function style.

**Primary Dependencies**: none new.

**Storage**: unchanged.

**Testing**: `npm run build` and `npm run check`; the harness in research R7, outside the
repository; the owner's manual check on crunchyroll.com (quickstart §4).

**Target Platform**: Chrome ≥ 119, MV3.

**Project Type**: Browser extension.

**Constraints**:
- No token leaves the page world.
- At most 1 paged request per second, and one in flight.
- Always fall back to scrolling.
- No popup, storage or contract change.

**Scale/Scope**: 2 files of code (`public/injected.js`, `src/content/index.ts`) and docs
(CLAUDE.md, `store/privacy-practices.md`).

## Constitution Check

The constitution is the template, so CLAUDE.md's rules act as gates:

| Rule | Status |
|---|---|
| The hook never copies the tokens in the token response; only ids and the profile name leave it | Pass. The history request's sign-in header stays in the hook's closure and is never posted (R2). CLAUDE.md is updated to state the wider rule: no token or header leaves the page world. |
| The content script runs on every Crunchyroll page; scraping is only honoured on `/history` | Pass: unchanged |
| A stopped scrape can't advance the marker; only `end`/`marker` with no rejection | Pass: same `RUN_END` reasons, and paging errors don't count as rejections (R6) |
| The popup fits 600 px | Pass: no popup change |
| Keep entry-point names; check `service-worker-loader.js` | Pass: no new entry point |

## Project Structure

```text
specs/004-history-paging/   spec.md, plan.md, research.md, quickstart.md, contracts/page-messages.md, checklists/, tasks.md
public/injected.js          header + cursor capture, the frunchyroll-next handler, the paged XHR
src/content/index.ts        run modes (paging, scrolling, idle), pacing, fallback, stopRun
CLAUDE.md                   data-flow items 1–2: paging, the header rule, the fallback
store/privacy-practices.md  scripting / User activity text: the hook also requests the next history pages
```

**Structure Decision**: Existing layout. No new files in the extension.

## Complexity Tracking

No violations.

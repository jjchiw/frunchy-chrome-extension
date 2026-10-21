# Tasks: Read the watch history page by page instead of scrolling

**Input**: `specs/004-history-paging/` (spec, plan, research, contracts/page-messages.md, quickstart)

**Tests**: The project has no test suite. A throwaway harness outside the repository (research R7)
checks every scenario in quickstart §2.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Build the harness outside the repository, in `/Users/jjchiw/.claude/jobs/0e1ec898/tmp/paging-harness/`, per research R7:
  - **Server**: Node `http`, no dependencies. It serves the test page and a fake `watch-history` API with 5 pages of 100 invented entries. Each page has `meta.next_page` in the real format: `/content/v2/acct-1/watch-history?locale=en-US&page=N&page_size=100`, empty on page 5.
    - It requires `Authorization: Bearer TEST-TOKEN-SECRET-123` and returns 401 otherwise.
    - It logs each request (path, time in ms, whether the header was present) to a JSON file.
    - Its query or env switches: `fail=500|401|429` on page 3, `slow` (page 3 answers after 35 s), `unsigned` (the site's own request sends no header), `foreignNext` (page 1's `next_page` is `https://evil.example/content/v2/x/watch-history?page=2`).
  - **Test page**:
    - It loads the repository's `public/injected.js` first, then the content-script bundle.
    - It mimics the site: it loads page 1 with `XMLHttpRequest` and `setRequestHeader("Authorization", "Bearer TEST-TOKEN-SECRET-123")`, unless `unsigned`.
    - It renders the entries as a tall list, and loads the next page the same way when scrolled near the bottom, so scroll fallback works.
    - It records every `window` `message` event's data.
  - **Content-script bundle**: build `src/content/index.ts` with Vite, using the repository's `src` alias, into the harness folder. A `chrome` stub is installed before it loads:
    - `runtime.sendMessage` records messages and answers `PAGE_CAPTURED` with `{ reachedMarker }`, true on a page chosen with `markerPage=N`;
    - `runtime.onMessage` lets the driver send `SCROLL_DOWN` and `SCROLL_STOP`;
    - `storage.local` is backed by an object, because `crunchyrollProfile` uses it.
  - **Driver**: a Node script that starts the server and, for each scenario, runs headless Chrome (`--headless=new --virtual-time-budget` large enough, or real time with a timeout). It sends `SCROLL_DOWN` through a page hook such as `window.__frunchyTest.start()`, waits for `RUN_END`, then prints a summary: the pages captured, the `RUN_END` reason, whether a scroll happened, the gaps between paged requests, and the count of the test token in posted messages, `sendMessage` payloads and captured bodies.
  - **Calibrate on the current code**: today, every scenario scrolls and ends `end`, and the token count must be 0. Record that baseline.

---

## Phase 2: User Story 1 + 2 - Paging with the token kept in the page (Priority: P1) 🎯 MVP

US1 and US2 share both files and can't be separated.

- [X] T002 [US1] In `public/injected.js` (keep its ES5 `var`/function style and comment density), per research R2–R4 and `contracts/page-messages.md`:
  - **Header**: wrap `XHR.setRequestHeader`. For a request whose `_url` contains `watch-history` (case-insensitive) and a header named `authorization` (case-insensitive), save the value on the instance (`this._auth`). On `send`, if it's a `watch-history` request with `_auth`, set the closure variable `historyAuth`. Never post, log or attach it anywhere else.
  - **Cursor**: in the existing `load` handler, after posting a `watch-history` response, parse it and resolve `meta.next_page` against the request URL (`new URL(next, new URL(this._url, location.href))`).
    - Keep it as `nextUrl` only if it has the same origin as the request and a path containing `/watch-history`.
    - Set `nextUrl = ""` when `next_page` is empty or missing.
    - Set `nextUrl = null` for a foreign or invalid link, and wrap the parsing in try/catch.
  - **Next**: a `window` `message` listener for `{ type: "frunchyroll-next" }` from `window`:
    - ignore it while `pagingInFlight`;
    - if `nextUrl === ""`, post `{ type: "frunchyroll-paging", state: "end" }`;
    - if `nextUrl` is null or `historyAuth` is missing, post `state: "unavailable"`;
    - otherwise create a new `XMLHttpRequest`, `open("GET", nextUrl)`, `setRequestHeader("Authorization", historyAuth)`, `timeout = 30000` and `send()`. The patched `open`/`send` capture it like any other request.
    - On `load` with status ≥ 400, or on `error` or `timeout`, post `{ type: "frunchyroll-paging", state: "failed", status }`, where `status` is the HTTP status, 0, or `"timeout"`.
    - Clear `pagingInFlight` on `loadend`.
    - Make sure a 4xx/5xx response isn't posted as a `frunchyroll` history page. The existing `load` handler posts any `watch-history` response, so skip it when `this.status >= 400`; that also helps the site's own requests.
  - Update the header comment: the hook also pages through the history, and the header never leaves this function.
- [X] T003 [US1] In `src/content/index.ts`, per research R5:
  - Add a `mode: "idle" | "paging" | "scrolling"`, a `pagingTimer`, a `pageRequested` flag (true from posting `frunchyroll-next` until the next `frunchyroll` page or `frunchyroll-paging` reply) and a `lastRequestAt`.
  - Rename `stopScrolling` to `stopRun(reason)`. It returns if `mode === "idle"`; otherwise it clears both timers, sets `mode = "idle"`, notifies, and sends `RUN_END` exactly as today.
  - `startRun()` (on `SCROLL_DOWN`): `mode = "paging"`, notify the popup that it's running, and request the next page.
  - When a `frunchyroll` page arrives while `mode === "paging"` and `pageRequested`, clear `pageRequested`. After it's handed off (`await sendPage(page)`, or right away when queued for the profile), if `mode` is still `"paging"`, schedule the next request after `max(0, 1000 - (Date.now() - lastRequestAt))` ms. Pages loaded by the site itself while paging (with `pageRequested` false) are handled as today and don't schedule anything.
  - Handle `frunchyroll-paging`: on `end`, `stopRun("end")`; on `unavailable` or `failed`, `console.info` one line with the state and status (never data), set `mode = "scrolling"`, and start the existing scroll loop without a second notify.
  - The scroll loop's end calls `stopRun("end")`. `SCROLL_STOP` calls `stopRun("user")`. `SCROLL_STATUS` answers `scrolling: mode !== "idle"`. The marker path calls `stopRun("marker")`.
  - Keep `sessionNewest`, `sessionStartedAt`, the profile handling and the message names exactly as they are. Update comments to describe paging with a scroll fallback.
- [X] T004 [US1] Run `npm run build` and `npm run check`. Run the harness scenarios happy path, marker on 3, stop after 2, and the leak check (quickstart §2). Fix until they all match.

**Checkpoint**: Commit.

---

## Phase 3: User Story 3 - Fallback to scrolling (Priority: P2)

- [X] T005 [US3] Run the harness scenarios `unsigned`, `fail=500`, `fail=401`, `fail=429`, `slow` and `foreignNext`.
  - Each must scroll on and end `end`.
  - Exactly one failed paged request, with no retry; check the server log.
  - The foreign host is never contacted; check that no request to it appears.
  - The token count is 0.

  Fix `public/injected.js` or `src/content/index.ts` if needed.

**Checkpoint**: Commit if anything changed.

---

## Phase 4: Polish

- [X] T006 [P] Update CLAUDE.md, keeping its style:
  - **Data-flow item 1 (the page hook)**:
    - it also remembers the sign-in header of the site's own `watch-history` requests and each response's `meta.next_page`;
    - on `frunchyroll-next` it requests the next page with an ordinary XHR, so the response goes through the same capture;
    - widen the rule: no token or header ever leaves the page world, and only ids, the profile name and history responses are posted.
  - **Item 2 (the content script)**: a run pages first, one page at a time and at least 1 s apart, and falls back to scrolling when paging is unavailable or fails. Popup message names stay `SCROLL_*`. Point to `specs/004-history-paging/`.
- [X] T007 [P] Update `store/privacy-practices.md`'s **scripting** and **User activity** texts. The hook also requests the next pages of the user's own watch history from Crunchyroll, using the sign-in the page already has, which never leaves the page. Keep the "never sent" list true.
- [X] T008 Final run: `npm run build`, `npm run check`, the `service-worker-loader` check, and all harness scenarios. Report a table of scenario, pages, end reason, scrolled, minimum gap in ms, failed requests and token count.

## Dependencies

T001 comes first, then T002 and T003 (same feature; T003 depends on T002's messages), then T004 and T005. T006 and T007 can run in parallel after T005. T008 runs last.

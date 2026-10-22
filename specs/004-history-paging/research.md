# Research: reading the history page by page

## R1. Where paging lives

- **Decision**: Split the work between the page hook and the content script.
  - **Page hook** (`public/injected.js`, page world): it holds the cursor and the sign-in header,
    and makes the paged request.
  - **Content script** (`src/content/index.ts`): it decides when to ask for the next page, and
    when to stop or fall back.
- **How the paged request is made**: with a new `XMLHttpRequest` through the hook's own patched
  `open`/`send`. The response then reaches the content script through the existing `load` listener
  as an ordinary `{ type: "frunchyroll", url, responseText }` message. Storage, upload, the marker
  check and the popup count see no difference (FR-004).
- **Rationale**: Only the page world holds the header. Reusing the capture path means no second
  copy of the store, upload and marker logic.
- **Alternatives considered**:
  - Requesting from the content script: it would need the header posted across worlds, which
    breaks FR-006.
  - Requesting from the background: same problem, and the worker is suspended between events.

## R2. Getting the sign-in header

- **Decision**:
  - Wrap `XMLHttpRequest.prototype.setRequestHeader` in the hook. On a request whose URL contains
    `watch-history`, remember the value of an `authorization` header (case-insensitive) in a
    closure variable `historyAuth`. Its origin and path come from the same request's URL.
  - Keep only the most recent value. Crunchyroll renews its token and the site's next request
    carries the new one.
  - Never put the value in a posted message, on `window`, in `console`, or in an attribute.
- **Rationale**: The site already holds this header in the same world. Keeping a reference in a
  closure exposes nothing new, and FR-006 is met as long as it's never posted.
- **Unknown**: whether the site sets the header with `setRequestHeader` and not another way. If
  `historyAuth` is never set, paging can't start and the run scrolls, as today (FR-008). So the
  feature is safe even if this assumption is wrong. The owner's manual test on crunchyroll.com
  confirms which path is taken (quickstart §4).

## R3. The cursor

- **Decision**: On every `watch-history` load, the hook parses `meta.next_page` and resolves it
  against the request's URL (`new URL(next, requestUrl)`). It keeps the result as `nextUrl`, or
  `""` when it's empty.
- It only accepts a `nextUrl` whose origin equals the request's origin and whose path contains
  `/watch-history`. Otherwise `nextUrl` is null and paging reports that it's unavailable (FR-007).
- **Rationale**: The captured samples (`../test-read-json/db/00{1,2,3}.json`) show
  `meta.next_page` as a host-relative path that already carries `page_size=100`, so following it
  keeps the site's page size (FR-003).

## R4. Messages between the content script and the page hook

All of them use `window.postMessage(msg, "*")`, and every receiver checks
`event.source === window`, as today. Each message is listed in `contracts/page-messages.md`.

- content → hook: `{ type: "frunchyroll-next" }`, meaning "request the next page now".
- hook → content, exactly one reply per `frunchyroll-next`:
  - nothing extra when a page was requested: its response arrives as the usual `frunchyroll`
    message;
  - `{ type: "frunchyroll-paging", state: "end" }`: the last response had an empty `next_page`;
  - `{ type: "frunchyroll-paging", state: "unavailable" }`: no cursor or no header yet;
  - `{ type: "frunchyroll-paging", state: "failed", status }`: an HTTP status ≥ 400, 0 for a
    network error, or `"timeout"`. The status is a number or a string, never a header or a body.
- The hook ignores `frunchyroll-next` while its own paged request is still in flight. That gives at
  most one paged request at a time.
- The paged request uses `xhr.timeout = 30000`.

## R5. Driving the run from the content script

- **States**: `mode` is `"idle"`, `"paging"` or `"scrolling"`. `scrollTimer !== undefined` stays the
  "is running" signal for `SCROLL_STATUS`, which the popup uses. In paging mode the content script
  keeps a `pagingTimer` instead, and `SCROLL_STATUS` reports `running = mode !== "idle"`.
- **Start** (`SCROLL_DOWN`): set `mode = "paging"`, notify the popup that a scrape is running, and
  post `frunchyroll-next`.
- **On each `frunchyroll` page while paging**: hand it over as today (`sendPage`, or the
  waiting-for-profile queue). Once `sendPage` resolves, or right away if the page was queued, and
  if the run is still `"paging"`, schedule the next `frunchyroll-next` at
  `max(0, 1000 - (now - lastRequestAt))` ms.
  - `stopScrolling("marker")` from `sendPage` sets `mode = "idle"` first, so the scheduled next
    never fires (FR-002).
  - Use one in-flight flag, so a page loaded by the site itself (the user scrolling by hand)
    doesn't schedule a second next.
- **On `frunchyroll-paging`**:
  - `end` → `stopScrolling("end")`;
  - `unavailable` or `failed` → switch to `mode = "scrolling"` and call the existing
    `startScrolling()` logic, without notifying a second start.
- **Stop** (`SCROLL_STOP`): `stopScrolling("user")` clears both timers and sets `mode = "idle"`.
- **Rename**: `stopScrolling` becomes `stopRun`, keeping the same `RUN_END` message. Comments say
  "scrape" where they mean the run.
- **Rationale**: The background, the popup and the marker rules stay unchanged (FR-005, FR-009,
  FR-010). The message names `SCROLL_*` stay, because the popup sends them.

## R6. Rejections and the marker

`lastRejectionAt` is about Frunchy rejecting an upload. A Crunchyroll paging error never touches it
(spec US3 scenario 3). After falling back, the run's end reason comes from scrolling as today.

## R7. Testing without crunchyroll.com

- **Decision**: A throwaway harness kept outside the repository: a small Node `http` server and a
  test page.
  - **Server** (`/content/v2/<acct>/watch-history?page=N&page_size=100`):
    - It answers 5 pages, with `meta.next_page` like the real ones and an empty one on the last
      page.
    - It requires `Authorization: Bearer TEST-TOKEN-SECRET-123` and answers 401 without it.
    - Switches make page 3 fail with 500, 401, 429 or a slow answer, or drop `next_page`.
    - It records each request's arrival time, to check FR-003.
  - **Page**:
    - It loads `public/injected.js` first. Then it mimics the site: it sets the header with
      `setRequestHeader` and loads page 1 via XHR, plus page 2 on scroll, so scroll fallback has
      something to load.
    - Its scroll fallback is an infinite list that loads the next page when it nears the bottom.
  - **Content script**: built from `src/content/index.ts` with Vite, with the same `chrome.runtime`
    stub as the earlier harnesses. The stub records every `sendMessage` (`PAGE_CAPTURED`,
    `RUN_END`) and can answer `reachedMarker: true` on a given page.
  - **Leak check**: a `message` listener on the page records every posted message. The test greps
    the messages, the `sendMessage` calls and the page bodies for `TEST-TOKEN-SECRET-123`.
  - **Driver**: headless Chrome, as before. A small script runs each scenario and prints a summary.
- **Rationale**: It checks every requirement except the real site. The quickstart lists the
  owner's manual check on crunchyroll.com.

# Feature Specification: Read the watch history page by page instead of scrolling

**Feature Branch**: `004-history-paging`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Instead of scrolling Crunchyroll's history page, follow the `next_page` link of each history response from inside the logged-in page, so a scrape is faster and doesn't depend on the page layout, without the Crunchyroll sign-in token ever leaving the page."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A scrape reads the history quickly, without scrolling (Priority: P1)

The user opens their Crunchyroll history and presses Scrape. Instead of the page scrolling for minutes, the extension asks Crunchyroll for the history one page of 100 entries after another, about once a second, until it reaches the end or the part already synced. The popup shows the count going up, as today. The tab doesn't need to stay in front.

**Why this priority**: It's the whole point of the feature. Scrolling waits about 2 seconds per step, plus however long the page takes to render, and it breaks if Crunchyroll changes its layout.

**Independent Test**: On a test page that behaves like Crunchyroll's history (a list of linked history pages, behind a sign-in header), press Scrape. Every page is captured, in order, with no scrolling, and the run ends by itself.

**Acceptance Scenarios**:

1. **Given** the history page has loaded its newest page, **When** the user presses Scrape, **Then** the extension requests the following pages one after another, and each one is stored and queued for upload exactly as a scrolled page is today.
2. **Given** a scrape is running, **When** the last page has no link to a next page, **Then** the run ends as "end", the same as reaching the bottom by scrolling, and the stop marker can advance.
3. **Given** a scrape is running and a page reaches history that was already synced, **When** the background reports the stop marker, **Then** no further page is requested, and the run ends as "marker".
4. **Given** a scrape is running, **When** the user presses Stop, **Then** no further page is requested, and the run ends as "user".
5. **Given** a long history, **When** it's scraped, **Then** the extension makes at most about one request per second and uses the page size Crunchyroll's own site uses.
6. **Given** the scrape is running, **When** the user switches to another tab, **Then** it keeps going.

---

### User Story 2 - The sign-in token stays inside the page (Priority: P1)

Paging needs the sign-in header that Crunchyroll's own site sends with its history requests. The extension uses it only inside the Crunchyroll page, where the site already holds it, and never passes it to the rest of the extension, stores it, or sends it anywhere.

**Why this priority**: The extension promises that nothing about the user's Crunchyroll sign-in leaves the browser page (CLAUDE.md, store privacy answers). Paging must keep that promise.

**Independent Test**: On the test page, with a recognisable fake token, run a full scrape while recording every message the page hook posts and everything the extension stores and uploads. The fake token appears in none of them.

**Acceptance Scenarios**:

1. **Given** a scrape by paging, **When** the messages from the page hook to the extension are inspected, **Then** none contains the sign-in header or any token.
2. **Given** a scrape by paging, **When** stored pages and uploads are inspected, **Then** they're the same history responses as before (request URL and body), with no header.
3. **Given** a paged request, **When** it's sent, **Then** it goes only to the same Crunchyroll host as the site's own history request.

---

### User Story 3 - When paging isn't possible, scrolling still works (Priority: P2)

If the extension can't page, the scrape falls back to scrolling, as it works today, without the user doing anything. That happens when it hasn't seen the site's own history request yet, when it can't find the sign-in header, when Crunchyroll answers with an error, or when it's too slow to answer. The run is never worse than today.

**Why this priority**: Crunchyroll can change how it signs requests or how it pages. A fallback keeps the extension working while the paging code catches up.

**Independent Test**: On the test page, make the paged request fail (expired token, server error, rate limit, timeout), or remove the sign-in header. The scrape carries on by scrolling and ends normally.

**Acceptance Scenarios**:

1. **Given** the hook hasn't seen a history request with a next-page link and a sign-in header, **When** the user presses Scrape, **Then** the extension scrolls as it does today.
2. **Given** paging is running, **When** a paged request fails or gets no answer within 30 seconds, **Then** the extension makes no retry storm. It switches to scrolling for the rest of the run, and the run ends by the usual rules.
3. **Given** Crunchyroll answers with a rate-limit or "unauthorized" error, **When** paging stops, **Then** that error doesn't count as a rejection by Frunchy. It doesn't stop the marker from advancing if the scrolled part then completes.

---

### Edge Cases

- **The user scrolls by hand while paging**: the site also loads pages. Captures of the same page replace each other (same request URL), and identical uploads are skipped (`sent` hashes), so duplicates are harmless.
- **The profile isn't known yet**: pages wait for the profile, as today, and paging carries on. The marker check happens once they're sent.
- **The user switches Crunchyroll profile during a run**: the session's sequence resets, as it does today. Paging continues with the header the site now sends.
- **History shorter than one page**: there's no next-page link, so the run ends as "end" at once.
- **A next-page link to another host, or an odd value**: the extension doesn't follow it. It falls back to scrolling.
- **The tab is closed or navigated away during a run**: nothing continues in the background, as today.

## Requirements *(mandatory)*

### Functional Requirements

**Paging**

- **FR-001**: When a scrape starts on the history page, the extension MUST continue from the next-page link of the most recent history response the page received, and request each following page in turn.
- **FR-002**: It MUST request the next page only after the previous one has been handed to the background, so a stop by the marker or the user takes effect before another request is sent.
- **FR-003**: It MUST wait at least 1 second between the starts of two paged requests, and keep the page size given in Crunchyroll's next-page link.
- **FR-004**: Paged responses MUST go through the same capture path as the site's own: stored, queued, checked against the stop marker and counted in the popup, with no separate handling.
- **FR-005**: A run MUST end as "end" when a page has no next-page link, as "marker" when the background reports the stop marker, and as "user" on Stop, with the same consequences as today.

**Token**

- **FR-006**: The sign-in header MUST be read only inside the page world, from the site's own history requests, and kept only in that script's memory. It MUST NOT be posted to the content script, stored, logged or sent to Frunchy.
- **FR-007**: Paged requests MUST go only to the host of the site's own history request, and only to a history path.

**Fallback**

- **FR-008**: If paging can't start (no next-page link or no header seen yet) or a paged request fails (HTTP error, network error, or no answer within 30 seconds), the extension MUST continue the run by scrolling, without retrying the failed request.
- **FR-009**: The popup's buttons, states and messages MUST stay the same. Paging versus scrolling isn't shown to the user.

**Scope**

- **FR-010**: Storage keys, the upload contract, sync rules and the stop marker's advance rules MUST NOT change.
- **FR-011**: The project's design and privacy notes (CLAUDE.md's data-flow section, and `store/privacy-practices.md`'s description of the page hook) MUST describe paging and where the sign-in header is used.

### Key Entities

- **Next-page link**: the path Crunchyroll puts in each history response (`meta.next_page`). It's empty on the last page.
- **Sign-in header**: what Crunchyroll's site attaches to its own history requests. It lives only in the page world.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A history of 2,000 entries (20 pages) is fully captured in under 40 seconds when paging works. Today's scrolling needs at least 2 seconds per page plus rendering.
- **SC-002**: 0 occurrences of the sign-in token in any message from the page hook, any stored value or any upload, checked with a recognisable test token.
- **SC-003**: 100% of the fallback cases in User Story 3 finish their run by scrolling, with no unhandled error.
- **SC-004**: No more than 1 paged request per second, measured on the test page.
- **SC-005**: Every page a paged scrape captures is identical (URL and body) to what a scrolled scrape of the same history captures.

## Assumptions

- Crunchyroll's history responses carry `meta.next_page`, a path relative to the API host with the page size (`page_size=100` in captured samples, see `../test-read-json/db/`), and it's empty on the last page.
- Crunchyroll's site makes its history requests with `XMLHttpRequest`, as the current hook already relies on, and signs them with a request header.
- Using the header inside the page, where the site already holds it, doesn't change what leaves the browser. The privacy answers and store texts stay true, and only their description of the hook is updated.
- Checking against the real crunchyroll.com site is the owner's manual test. Automated checks use a local test page that behaves like it.
- Crunchyroll's terms remain an open question for the owner, as for scrolling. Paging sends the same requests the site sends, at a slower pace than a person scrolling quickly.

# Feature Specification: Frunchy for Firefox (desktop and Android)

**Feature Branch**: `007-firefox-port`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Port the extension to Firefox, desktop and Firefox for Android, through
the spec-kit flow. The owner decides scope from the spec." Feasibility notes from the Chrome
session: Firefox MV3 has no background service worker (event page instead), CRXJS is Chrome-only and
needs a spike, `world: "MAIN"` needs Firefox 128+, Firefox treats MV3 host permissions as optional,
Crunchyroll on Firefox for Android is unverified, and AMO needs a gecko id, signing, the source code
with build instructions, and data-collection declarations.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scrape and sync from desktop Firefox (Priority: P1)

A Crunchyroll user who browses with Firefox installs Frunchy from Firefox's add-on site and uses it
exactly as a Chrome user does: open the history page from the popup, scrape, see the newest
episodes and the sync status, download the JSON, set the backend and sync key in the settings, and
have the pages uploaded to their Frunchy account.

**Why this priority**: It is the port. Desktop Firefox is the closest to Chrome and the spike showed
the existing code runs there.

**Independent Test**: Install the Firefox build in desktop Firefox, sign in to Crunchyroll, set a
sync key, scrape the full history, and see the same import on Frunchy as a Chrome scrape of the same
account gives.

**Acceptance Scenarios**:

1. **Given** Frunchy is installed in desktop Firefox and the user is signed in to Crunchyroll,
   **When** they open the popup on `crunchyroll.com/history` and press Scrape, **Then** the history is
   paged (or scrolled, as a fallback) to the end, the pages are stored, and the popup shows the
   newest episodes, as in Chrome.
2. **Given** a sync key is set, **When** pages are captured, **Then** they are uploaded with the
   same queue, retry and stop-marker rules as in Chrome, and the popup shows the import.
3. **Given** Firefox was closed or the background was suspended, **When** an upload retry is due,
   **Then** it still runs (the background wakes for its alarm as Chrome's worker does).
4. **Given** the browser language is Spanish, **When** the user opens the popup or settings,
   **Then** every text is Spanish, as in Chrome.
5. **Given** the user downloads the JSON, **Then** the file is identical in format to Chrome's, so
   it uploads to Frunchy unchanged.

---

### User Story 2 - Site access the user can see and fix (Priority: P1)

In Firefox the user can withhold or later remove Frunchy's access to Crunchyroll or to the Frunchy
server, and an extension update that needs a new site isn't granted it automatically. Without
access nothing works and nothing says why. The popup checks the access it needs and, when any is
missing, says so and offers one button that asks Firefox for it.

**Why this priority**: Without it a Firefox user who unticks the access at install, or removes it
later, gets a popup that never finds the content script, with no way to tell why. It's part of a
working port, not polish.

**Independent Test**: Remove Frunchy's Crunchyroll access in Firefox's add-on manager, open the
popup: it explains that Frunchy needs access to Crunchyroll and offers to ask for it; pressing it
shows Firefox's prompt, and after allowing it and reloading the history page, Scrape works.

**Acceptance Scenarios**:

1. **Given** access to `www.crunchyroll.com` is missing, **When** the user opens the popup, **Then**
   the main card says Frunchy needs access to Crunchyroll and its button asks Firefox for it, in
   place of the usual action.
2. **Given** a sync key is set and access to the configured Frunchy server is missing, **When** the
   user opens the popup, **Then** it says uploads are blocked until access is allowed, with a button
   that asks for it.
3. **Given** the user allows access from that button, **When** the prompt closes, **Then** the
   popup goes back to its usual state (reloading the Crunchyroll tab when the content script isn't
   there yet, as it already does).
4. **Given** the user refuses, **Then** the popup keeps saying what is missing and nothing else
   happens; it never asks without a click.
5. **Given** all access is in place, **Then** the popup looks exactly as it does today.

---

### User Story 3 - Scrape and sync from Firefox for Android (Priority: P2)

A user without a computer at hand installs Frunchy in Firefox for Android, signs in to Crunchyroll
in Firefox, opens the history page from the popup, scrapes and syncs. The popup fits the phone's
screen, and the settings open as a page.

**Why this priority**: It is the only way to sync from a phone today, but it depends on an
unverified fact: that Crunchyroll's site in Firefox for Android shows the same history page and
uses the same history requests when signed in. A device check comes first; if it fails, this story
is dropped and desktop ships alone.

**Independent Test**: On an Android phone with Firefox, install the build, sign in to Crunchyroll,
set the sync key, scrape, and see the import on Frunchy.

**Acceptance Scenarios**:

1. **Given** Frunchy is installed in Firefox for Android and the user is signed in to Crunchyroll,
   **When** they open the popup from Firefox's menu, **Then** it finds the Crunchyroll tab they came
   from (even though Android shows the popup in its own panel) and offers the usual action.
2. **Given** the user presses Scrape on the history page, **Then** the history is paged (or
   scrolled) to the end and stored, as on desktop.
3. **Given** the user opens the settings, **Then** they open as a full page and can be used with
   the on-screen keyboard.
4. **Given** the user presses Download JSON on Android, **Then** the file is saved, or the action
   isn't offered there if Android can't save it from the popup.

---

### User Story 4 - The owner can build, submit and release the Firefox version (Priority: P2)

The owner builds the Firefox package from the same sources with one command, and a release
produces both the Chrome and the Firefox packages from the same commit. The Firefox submission
comes with what Mozilla's review asks for: the source code and instructions that rebuild the exact
package, and the add-on listing texts and privacy answers in English and Spanish.

**Why this priority**: Needed to ship, but only after the extension works.

**Independent Test**: On a clean checkout, run the documented build twice and get byte-identical
packages; follow the source-archive instructions on another machine and get the same package;
Mozilla's validator reports no errors.

**Acceptance Scenarios**:

1. **Given** a checkout and the backend address, **When** the owner runs the Firefox package
   command, **Then** it writes a Firefox package and a source archive for the same version as the
   Chrome package.
2. **Given** the source archive and its instructions, **When** a reviewer follows them, **Then**
   they get a package identical to the submitted one.
3. **Given** a release, **Then** the Chrome package and its publishing behave exactly as today.
4. **Given** the Firefox package, **When** Mozilla's validator checks it, **Then** it reports no
   errors.

### Edge Cases

- The user removes Crunchyroll access while a scrape runs: the run stops when its messages fail,
  as it does today when the tab closes; the next popup open shows the access card.
- An update adds a site to the required access: Firefox doesn't prompt for it, so the popup's check
  is what catches it.
- Private windows: Firefox doesn't run extensions in private windows unless the user allows it.
  The popup on a private Crunchyroll tab finds no content script and must not suggest a reload that
  can't help.
- The history hook is registered by the background at install and startup. If access to
  Crunchyroll is granted after that, the hook must run on the next page load without reinstalling.
- On Android the popup may be shown in its own tab or panel, so "the active tab" may be the popup
  itself; the Crunchyroll tab must still be found.
- A Firefox install and a Chrome install are separate: storage, sync state and stop markers are not
  shared, so a Firefox scrape after a Chrome one uploads its pages again (the backend already
  de-duplicates).
- Background auto-sync (feature 006, in progress) opens a minimized window on a timer. Firefox for
  Android has no windows; whatever 006 ships must be hidden or disabled there (decided with 006,
  not here).

## Requirements *(mandatory)*

### Functional Requirements

**Firefox build**

- **FR-001**: The project MUST produce a Firefox package from the same sources as the Chrome
  packages, with one command, using a background that Firefox supports (an event page) and the
  same content script, page hook, popup and settings.
- **FR-002**: The Firefox package MUST declare a permanent add-on id and the minimum Firefox
  versions it supports on desktop and Android, and MUST declare what data it sends, matching the
  Chrome privacy answers (watch-history content, the Crunchyroll profile id and name, the sync
  key).
- **FR-003**: The Firefox package MUST ask for the same access as the Chrome store build: Crunchyroll
  and the default Frunchy server at install, and any other `https://` Frunchy server only when the
  user saves it.
- **FR-004**: The Firefox package MUST NOT contain a local address, like the Chrome store package.
- **FR-005**: The Chrome packages, their manifest and their minimum Chrome version MUST NOT change.

**Behaviour in Firefox**

- **FR-006**: Scraping, storage, the upload queue, retries, stop markers, the backend contract, the
  JSON format and the texts MUST behave as in Chrome.
- **FR-007**: The popup MUST check that access to Crunchyroll, and to the configured Frunchy server
  when a sync key is set, is granted. When any is missing it MUST say which and offer a button
  that asks the browser for it. It MUST NOT ask without a click.
- **FR-008**: The access check MUST also run in the Chrome build, where access is normally always
  granted, so both browsers share one popup. In Chrome it MUST change nothing visible when access
  is granted.
- **FR-009**: The popup MUST fit its new access state within the existing height limit, Spanish
  included.
- **FR-010**: On Firefox for Android the popup MUST find the user's Crunchyroll tab when it is shown
  in its own panel or tab, and Download JSON MUST either work or not be offered.

**Release**

- **FR-011**: The Firefox package MUST be reproducible: the same commit and backend address give a
  byte-identical package, and a source archive with written build instructions MUST be produced
  with it for Mozilla's review.
- **FR-012**: Distribution: [NEEDS CLARIFICATION: listed on addons.mozilla.org (public, reviewed,
  installable on Firefox for Android) or unlisted (signed by Mozilla but self-distributed,
  desktop only)?]
- **FR-013**: Release automation: [NEEDS CLARIFICATION: should the release workflow also sign and
  submit the Firefox package to Mozilla with API credentials, as it does for Chrome, or only build
  the package and source archive for the owner to upload by hand?]
- **FR-014**: The listing texts (English and Spanish), the privacy answers and the owner's
  checklist for Mozilla MUST be written next to the Chrome ones, and CLAUDE.md MUST describe the
  Firefox build.

### Key Entities

- **Firefox package**: the Firefox build of a version, its add-on id, its minimum Firefox versions
  and its data-collection declaration.
- **Source archive**: the sources and instructions from which Mozilla's reviewers rebuild the
  package.
- **Site access**: the sites the extension may read or call (Crunchyroll, the Frunchy server). In
  Firefox the user can withhold or remove it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A full-history scrape of the same account in desktop Firefox and in Chrome stores the
  same number of pages and leads to the same import on Frunchy.
- **SC-002**: With Crunchyroll access removed, 100% of popup opens show the access card, and one
  click plus Firefox's prompt brings back a working scrape.
- **SC-003**: Mozilla's validator reports 0 errors on the Firefox package.
- **SC-004**: Two builds of the same commit and backend address give byte-identical Firefox
  packages.
- **SC-005**: The Chrome store package built from this branch is identical to one built from `main`
  apart from the popup's access check.
- **SC-006**: If Android is in scope: on a phone, a signed-in user goes from opening the popup to a
  finished scrape with no step that differs from desktop.

## Assumptions

- The spike (2026-10-27, desktop Firefox 158) ran the current Chrome build in Firefox with only its
  manifest rewritten: the background loaded as an event page, the hook registered in the page's own
  world and patched the history requests, the content script answered the popup, and the popup and
  settings rendered with their bundled fonts. So no new bundler is needed; the build changes only
  the manifest. See `research.md`.
- Logged out, Crunchyroll serves the same `/history` page to a Firefox for Android browser
  identity, and the hook installs there. Signed-in behaviour on a real phone is not verified yet;
  it is the first task of the plan and gates User Story 3.
- Minimum versions are Firefox 140 on desktop and 142 on Android: the first that read the
  data-collection declaration, above the 128 that the hook's page-world registration needs.
- The add-on id is permanent once submitted; the owner chooses it (for example
  `frunchy@<their domain>`).
- The Firefox package uses the same default backend as the Chrome store build
  (`FRUNCHY_BACKEND_URL`) and the same self-hosting rules.
- Creating the Mozilla developer account, API keys, the listing and any submission are the owner's
  steps; nothing is published by this feature's work.
- The data-collection declaration marks the data as required (sending history to Frunchy is the
  extension's purpose); the owner confirms the categories when filling in the listing.
- Background auto-sync (006) is out of scope here; its Firefox behaviour is decided with 006.

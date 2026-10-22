# Feature Specification: Chrome Web Store release build

**Superseded in part**: FR-003 and FR-004 (the fixed backend) by `specs/005-self-hosted-release/`.

**Feature Branch**: `002-store-release`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Work out and make the extension changes needed to publish Frunchy on the Chrome Web Store: trim permissions, a store build that talks only to the production backend, a store-ready icon, localized name and description, a packaging step, and drafts of the store listing and privacy answers."

**Builds on**: `001-night-broadcast` (the Night Broadcast design), which isn't merged yet.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A store package that only reaches Crunchyroll and the Frunchy backend (Priority: P1)

The owner runs one command and gets a zip ready to upload to the Chrome Web Store. That build talks only to Crunchyroll and to the production Frunchy backend given at build time. It asks for no access to local addresses or to any other site. Development keeps working as it does today, with a local backend and a backend URL field.

**Why this priority**: Without it nothing can be uploaded. A store build that points at `localhost`, or asks for access to every site, is unusable or gets rejected.

**Independent Test**: Run the packaging command with a production URL. Unzip the result, read its manifest, and load the unpacked folder in Chrome. Run it again with no URL, or with an `http://` URL: it fails with a clear message and writes no zip.

**Acceptance Scenarios**:

1. **Given** a production backend URL starting with `https://`, **When** the owner runs the packaging command, **Then** a zip named with the extension's version is written, and its manifest grants host access only to Crunchyroll and that backend's origin.
2. **Given** no backend URL, or one that isn't `https://`, **When** the owner runs the packaging command, **Then** it stops with a message saying what's missing, and no zip is written.
3. **Given** the store build is installed, **When** the user opens the options page, **Then** there is no backend URL field. The page shows which Frunchy site the extension connects to, and asks only for the sync key.
4. **Given** the store build is installed and a backend URL from an earlier development install is still in storage, **When** the extension syncs or links to the website, **Then** it uses the build's backend, not the stored one.
5. **Given** the development build, **When** it's built and loaded as today, **Then** it behaves exactly as before: local backend by default, backend URL field, "Use default", and permission to reach another backend on request.

---

### User Story 2 - Only the permissions the extension uses (Priority: P1)

A user installing the extension from the store sees as few permission warnings as possible, and a reviewer finds a reason for every permission requested.

**Why this priority**: Broad permissions get a closer review and put users off. Today the extension asks for permissions it doesn't use, including one whose warning reads like it can see the user's whole browsing history.

**Independent Test**: Compare the store manifest's permissions with the extension's code: each one has a use and a written reason. Load the store build in Chrome and run through the popup (open history, reload, scrape, stop, sync, download, clear) on a Crunchyroll tab and on another site.

**Acceptance Scenarios**:

1. **Given** the store build, **When** its manifest is read, **Then** it requests no `tabs` or `activeTab` permission, no access to every site, no local addresses, and declares no external connections.
2. **Given** the store build on a Crunchyroll history tab, **When** the user opens the popup, **Then** it recognises the tab and every action works as it does today.
3. **Given** the store build on any other site, **When** the user opens the popup, **Then** it offers to open the history page, as it does today.
4. **Given** a browser too old for the features the extension uses, **When** someone tries to install it, **Then** the store doesn't offer it, because the extension declares the oldest Chrome version it supports.

---

### User Story 3 - A store-ready icon and a localized listing name (Priority: P2)

On the Chrome Web Store, the Frunchy icon follows the store's artwork rules. The extension's name and short description appear in the browser's language: English or Spanish.

**Why this priority**: The listing is the extension's first impression. An icon without the padding Chrome asks for looks cramped next to other listings.

**Independent Test**: Open the 128 px icon and measure its artwork area. Load the store build in a Chrome set to Spanish and check the name and description on `chrome://extensions`.

**Acceptance Scenarios**:

1. **Given** the 128 px icon, **When** it's inspected, **Then** the artwork fills the central 96×96 px and the 16 px border around it is transparent. The 16, 32 and 48 px toolbar icons stay as they are.
2. **Given** a browser set to Spanish, **When** the extension is shown on `chrome://extensions` or in the store, **Then** its description is in Spanish. In any other language it's in English.

---

### User Story 4 - Store listing and privacy answers ready to paste (Priority: P3)

When the owner fills in the Chrome Web Store dashboard, everything it asks for is already written and rendered in the repository: listing texts in both languages, screenshots, the promo tile, the single purpose, a reason for each permission, the data-use answers, and the remote-code answer. The screenshots show invented data, never real watch history.

**Why this priority**: Uploading needs these, but they don't change the extension itself, and they can be redone at any time.

**Independent Test**: Open the store folder. It holds every text the dashboard asks for, in English and Spanish, and images at the store's exact sizes. None of them shows a real profile or real episodes.

**Acceptance Scenarios**:

1. **Given** the store folder, **When** the owner opens it, **Then** it contains:
   - a short description of at most 132 characters and a longer description, each in English and Spanish;
   - the single-purpose statement;
   - a reason for each permission in the store manifest;
   - the data-use answers and the remote-code answer;
   - a checklist of the steps only the owner can do.
2. **Given** the screenshots, **When** they're checked, **Then** there are 3 to 5 per language at exactly 1280×800, and there's a 440×280 promo tile. All of them use invented data and the Night Broadcast design.
3. **Given** the listing texts, **When** they're read, **Then** they say that Frunchy isn't affiliated with Crunchyroll and don't compare Frunchy with another product. They use the backend's phrase "a social stats platform for anime".
4. **Given** the screenshot generator, **When** the owner runs it again, **Then** it rebuilds the same images from the invented data, with no network access and no real history.

---

### Edge Cases

- **The production domain isn't known yet**: the store build can't be finished. The packaging command refuses to run without it, while the development build and everything else still work.
- **Trailing slash or path in the URL**: a backend URL given with a path or a trailing slash (`https://frunchy.app/`) is reduced to its origin, as the options page does today.
- **Upgrading from a development install**: a development install with a stored `localhost` backend and key switches to the build's backend. Because that counts as a different Frunchy user, the stop marker and the "sent" records reset, as they do when the backend changes today.
- **Re-uploading the same version**: the store rejects a version it already has. The zip's name carries the version, so a repeat build is easy to spot.
- **Install warnings**: the Crunchyroll and backend host permissions still produce a "read and change your data on…" warning. That's expected and explained in the permission reasons.

## Requirements *(mandatory)*

### Functional Requirements

**Builds**

- **FR-001**: The project MUST produce two builds from the same source: the development build, unchanged from today, and a store build.
- **FR-002**: The store build MUST take the production backend URL at build time. It MUST refuse to build if the URL is missing, isn't `https://`, or isn't a valid URL, and say why.
- **FR-003**: In the store build, the backend URL MUST be fixed to that origin, whatever is in storage. The options page MUST NOT offer to change it, and MUST show which site it connects to.
- **FR-004**: When a store build replaces a stored backend URL that differs from its own, the extension MUST reset the per-user sync state (stop marker, last import, last rejection, sent records), as it does when the user changes the backend today. The sync key stays.
- **FR-005**: A packaging command MUST run the store build and write a zip of it, named with the extension's version, to a folder git ignores.

**Permissions**

- **FR-006**: Both builds MUST drop the `tabs` and `activeTab` permissions and the `externally_connectable` declaration, because nothing uses them.
- **FR-007**: The store build MUST request host access only for `https://www.crunchyroll.com/*` and the production backend's origin. It MUST NOT request local addresses or optional access to every site.
- **FR-008**: Both builds MUST declare the oldest Chrome version they support, at least the version that supports every feature they use.

**Icon and listing name**

- **FR-009**: The 128 px icon MUST have its artwork in the central 96×96 px, with a 16 px transparent border. The 16, 32 and 48 px icons MUST stay unchanged.
- **FR-010**: The extension's description MUST be localized in English and Spanish. Its name stays "Frunchy".

**Store materials**

- **FR-011**: The repository MUST hold the listing texts in English and Spanish (short description of at most 132 characters, and a long description), the single purpose, a reason for each store permission, the data-use and remote-code answers, and an owner checklist.
- **FR-012**: The repository MUST hold 3 to 5 screenshots per language at 1280×800 and one 440×280 promo tile. They MUST be rendered from invented data by a generator that runs offline.
- **FR-013**: The listing texts MUST say that Frunchy isn't affiliated with Crunchyroll, MUST NOT compare Frunchy with another product, and MUST NOT use Crunchyroll's logo.

**Scope**

- **FR-014**: Scraping, storage, sync rules, the backend contract and the popup's behaviour MUST stay as they are. The only change on the options page is FR-003, and the store build's settings change only as FR-004 says.

### Key Entities

- **Store build**: the extension packaged for the Chrome Web Store, tied to one production backend origin chosen at build time.
- **Store materials**: listing texts, images and dashboard answers, kept with the code so they change together.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The store build's install prompt shows only the warning for reading and changing data on Crunchyroll and the Frunchy site. It shows no browsing-history warning and no "all sites" warning.
- **SC-002**: The store manifest lists 0 permissions without a written reason and 0 that the code doesn't use.
- **SC-003**: The packaging command writes a zip in one step when given a valid URL, and fails in 100% of cases without one.
- **SC-004**: Every popup action works the same in the store build as in the development build, on a Crunchyroll history tab and on another site.
- **SC-005**: Every text and image the store dashboard requires exists in the repository, at the required length or size, in both languages where the store allows one per language.
- **SC-006**: The store materials contain 0 real watch-history entries or real profile names.

## Assumptions

- The production backend domain isn't known yet. Everything in this feature is built, and the store build is checked with a placeholder `https://` origin. The owner runs the packaging command with the real domain once it exists.
- The website's privacy policy page doesn't exist yet. Its URL is given as `<backend>/privacy` in the dashboard answers, and adding it is a backend task.
- The store build is for everyone using the production Frunchy site. Pointing the extension at another backend stays a development feature, which is why the store build drops the URL field and access to every site.
- First publication is unlisted, as the owner's checklist recommends. Nothing in the extension depends on unlisted versus public.
- The extension's version stays 0.1.0 for the first upload. Later uploads raise it, and the checklist says so.
- The developer account, fee, verification, trader declaration and the Crunchyroll-terms decision are the owner's, and are listed in the checklist rather than done here.

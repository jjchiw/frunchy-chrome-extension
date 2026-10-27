# Feature Specification: Frunchy on Microsoft Edge Add-ons

**Feature Branch**: `008-edge-addons`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Add the Edge add-on as a follow-up [to the Firefox port]. Safari is
dropped. We should be ready for Ladybird."

## Clarifications

### Session 2026-10-27

- Q: Which other browsers get their own listing? → A: Microsoft Edge Add-ons now. Safari is dropped.
  Ladybird is revisited when it ships an extension API (see Assumptions).
- Q: Does the release workflow submit to Edge Add-ons, as it does for Chrome and Firefox? → A: Yes,
  following 007's decision for Firefox.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install Frunchy from Edge's own store (Priority: P1)

An Edge user finds Frunchy in Microsoft Edge Add-ons, the store Edge offers by default, and installs
it from there without allowing extensions from other stores. Once installed it works exactly as in
Chrome.

**Why this priority**: It is the feature. Edge can already install from the Chrome Web Store, but
only after the user allows "extensions from other stores", which many users won't do or won't
find.

**Independent Test**: Install the Edge Add-ons version in Edge, sign in to Crunchyroll, set a sync
key, scrape, and see the import on Frunchy.

**Acceptance Scenarios**:

1. **Given** Frunchy is published on Edge Add-ons, **When** an Edge user installs it, **Then** Edge
   asks for the same access as the Chrome store version, and scraping, syncing, the popup and the
   settings work as in Chrome.
2. **Given** the browser language is Spanish, **Then** the listing and the extension are in Spanish.

---

### User Story 2 - A release also updates the Edge listing (Priority: P1)

When the owner runs a release, the same package that goes to the Chrome Web Store is also sent to
Edge Add-ons and submitted for certification. The owner never builds or uploads by hand for Edge
after the first version.

**Why this priority**: Without it, the Edge version falls behind every release.

**Independent Test**: Run a release with `publish` on. A new version appears in Partner Center as
submitted for certification, built from the same commit as the Chrome and Firefox versions.

**Acceptance Scenarios**:

1. **Given** a release, **Then** the Edge submission uses the identical package as the Chrome
   submission.
2. **Given** the Edge submission fails (credentials, a previous version still in certification, a
   rejected package), **Then** the run says why, and the Chrome and Firefox submissions are not
   affected.
3. **Given** a dry run, **Then** nothing is sent to Edge Add-ons.

### Edge Cases

- A previous version is still in certification: Edge refuses a new submission. The release reports
  it, and the owner re-runs only the Edge job after certification ends.
- The Edge API key expires (Partner Center shows its expiry date): the submission fails with a
  credentials error that names the fix.
- The package is identical to the one already submitted: Edge refuses with "no updates". This can
  only happen on a re-run, and is reported as such.
- An Edge Add-ons install and a Chrome Web Store install in the same Edge profile are two
  extensions with separate storage, like Chrome and Firefox installs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST be listed on Microsoft Edge Add-ons, using the same package as the
  Chrome Web Store. No Edge-specific build is made.
- **FR-002**: A release MUST upload that package to the existing Edge Add-ons product and submit
  it for certification, from the same run and commit as the other stores.
- **FR-003**: The Edge credentials MUST be available only to the Edge publishing step, the same way
  as the other stores' credentials, and only our own script may see them. They MUST never appear
  in the log or in any process's arguments.
- **FR-004**: An Edge failure MUST NOT stop or undo the Chrome or Firefox submissions, and vice
  versa. A dry run MUST submit nothing.
- **FR-005**: A failed submission MUST say why: credentials, a version still in certification,
  nothing new to publish, or the store's own validation messages.
- **FR-006**: The Edge listing texts (English and Spanish), the privacy answers, the certification
  notes and the owner's checklist MUST be written next to the Chrome and Firefox ones.
- **FR-007**: The extension's code, its packages for Chrome and Firefox, and its behaviour MUST NOT
  change.

### Key Entities

- **Edge Add-ons product**: the listing in Partner Center, identified by its product ID, created by
  the owner by hand with the first version.
- **Edge API credentials**: a client ID and an API key with an expiry date, created in Partner
  Center.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After the first version, a release needs 0 hand steps for Edge: the new version
  appears in Partner Center as submitted for certification.
- **SC-002**: The Edge package and the Chrome package of a release are byte-identical.
- **SC-003**: In Edge, the scrape, sync and popup checks of the Chrome quickstart pass unchanged.
- **SC-004**: Every failure case in FR-005 ends the Edge job with a message naming the cause, and
  the other stores' jobs still succeed.

## Assumptions

- A spike on 2026-10-27 (Edge 156, macOS) loaded the Chrome store build unpacked. The hook
  registered in the page's world and patched the history requests, and the content script answered
  the popup. Edge needs no build of its own (`research.md`).
- Partner Center's developer registration for Edge is free. The owner creates the account, the
  first submission and the API credentials. Nothing is published by this feature's work.
- The first version must be created in Partner Center by hand: the API can only update an existing
  product.
- The listing's visibility (public or hidden) is chosen by the owner in Partner Center, as with the
  Chrome Web Store.
- **Safari** is out of scope (owner, 2026-10-27): it would need a native app wrapper, an Apple
  developer account and App Store review.
- **Ladybird** has no extension API yet. As of its August 2026 newsletter it has started the
  per-"world" script isolation that content scripts need, with an alpha planned for 2026, beta for
  2027 and stable for 2028. Being "ready" means keeping the code on standard WebExtensions APIs (no
  Chrome-only APIs, as the Firefox build already enforces). When Ladybird ships extensions, the
  next step is a spike like 007's. Not part of this feature.
- This feature builds on 007 (its release workflow layout and `store/` structure) and lands after it.

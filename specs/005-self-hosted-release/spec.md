# Feature Specification: Release from the workflow, and point the store build at your own Frunchy

**Feature Branch**: `005-self-hosted-release`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "I can't enter the version when I run the release workflow; it seems I have to update the manifest and package.json by hand. Can't that be automatic through a workflow parameter? Also, in the store build's settings I can only use https://frunchy.lacalabaza.xyz, but Frunchy is self-hosted and many people can target their own installation."

**Supersedes**: `specs/002-store-release/` FR-003 and FR-004 (the store build fixed to one backend)
and the "How a release works" part of `specs/003`'s README section.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Release a new version from the workflow page (Priority: P1)

The owner opens the release workflow on GitHub, types the new version (or leaves it blank for the
next patch), ticks "publish", and runs it. The workflow sets that version in the repository,
records it as a commit and a tag, builds the zip from exactly that commit, and submits it to the
Chrome Web Store. Nothing has to be edited by hand first.

**Why this priority**: Today a release needs a hand edit of two files, a commit and a tag before the
workflow can run, and the workflow page offers no way to enter the version.

**Independent Test**: Run the workflow by hand with `publish` on and a version. The repository's
default branch gains a commit "Release v<version>" with that version in `manifest.json`,
`package.json` and `package-lock.json`, and a tag `v<version>` on it; the zip artifact is built from
that commit; the publish step receives that version.

**Acceptance Scenarios**:

1. **Given** the workflow is run by hand from the default branch with `publish` on and `version`
   `0.2.0`, **When** it runs, **Then** it commits the version change, tags `v0.2.0`, builds from that
   commit and submits it.
2. **Given** the same but with `version` left blank, **When** it runs, **Then** it uses the next
   patch version after the one in `manifest.json` (for example `0.1.1` → `0.1.2`).
3. **Given** `publish` is off, **When** it runs, **Then** it only builds a zip from the current
   files, changes nothing in the repository, and ignores `version`.
4. **Given** a version that isn't `major.minor.patch`, isn't higher than the current one, or whose
   tag already exists, **When** it runs, **Then** it stops before changing anything, with a message
   saying why.
5. **Given** the workflow is run by hand from a branch other than the default one with `publish`
   on, **When** it runs, **Then** it stops before changing anything: releases come from the default
   branch only.
6. **Given** someone pushes a `v*` tag by hand, as today, **When** the workflow runs, **Then** it
   behaves as before: the tag must match the files' version, and it builds and publishes.

---

### User Story 2 - Point the store extension at your own Frunchy (Priority: P1)

Frunchy is self-hosted. Someone who runs their own Frunchy server installs the extension from the
Chrome Web Store, opens its settings, replaces the default server address with their own, and
syncs there. The default stays the owner's public site, so people who use it don't have to change
anything.

**Why this priority**: The store build currently hides the server field, so the extension on the
store only works with one installation. That contradicts what Frunchy is.

**Independent Test**: Load the store build, open its settings, enter another `https://` address,
save: the extension asks for permission for that address, checks the key there, and uploads
there. With the default address nothing is asked.

**Acceptance Scenarios**:

1. **Given** the store build's settings page, **When** it opens, **Then** it shows the server
   address field with the default address filled in, "Use default" when it differs, and the key
   field, the same as the development build.
2. **Given** the user enters another `https://` address and saves, **When** the extension doesn't
   yet have access to that address, **Then** it asks the browser for permission for that one
   address, and only then checks the key and uses it for uploads and links.
3. **Given** the user declines that permission, **When** saving, **Then** the settings aren't saved
   and the page says the permission was refused, as the development build does today.
4. **Given** the user enters a non-`https://` address in the store build, **When** saving, **Then**
   it's refused with the invalid-address message, because the store build only reaches secure
   sites.
5. **Given** the store build's install prompt, **When** it's shown, **Then** it still warns only
   about Crunchyroll and the default Frunchy site. Access to other sites is requested one at a
   time, only when the user enters one.
6. **Given** the store listing and privacy answers, **When** they're read, **Then** they say the
   extension can be pointed at a self-hosted Frunchy server, and the host-permission answer
   explains that optional access.

---

### Edge Cases

- **The default branch is protected against direct pushes**: the release commit can't be pushed, and
  the run stops at that step with git's message. The owner's documentation says what to allow, and
  the tag-by-hand path still works.
- **The version in the three files disagrees before a release**: the release sets all three to the
  new version, which repairs the drift. A tag pushed by hand still fails if `manifest.json` and
  `package.json` disagree.
- **Two releases started at once**: the workflow already runs one release at a time.
- **A store install that stored a non-default address, then an update arrives**: nothing changes;
  the stored address and its granted permission stay.
- **Switching the address**: as today, a different address counts as a different Frunchy user, so
  the sync progress resets and the key stays.

## Requirements *(mandatory)*

### Functional Requirements

**Release**

- **FR-001**: The release workflow MUST accept a `version` when run by hand. When `publish` is on,
  it MUST set that version (or the next patch when blank) in `manifest.json`, `package.json` and
  `package-lock.json`, commit it to the branch it was run from, tag it `v<version>`, and build and
  publish from that commit.
- **FR-002**: It MUST refuse to release when the version isn't `major.minor.patch`, isn't higher
  than the current one, when its tag already exists, or when it was run from a branch other than
  the default one. It MUST refuse before changing anything.
- **FR-003**: When `publish` is off, the workflow MUST change nothing in the repository and only
  build the zip from the files as they are.
- **FR-004**: The job that writes to the repository MUST run no third-party code: only git, Node
  and npm's own version command, with no dependency install. The job that installs dependencies
  MUST keep having no write access and no secrets.
- **FR-005**: Pushing a `v*` tag by hand MUST keep working as today.

**Self-hosted server**

- **FR-006**: The store build MUST show the same settings page as the development build: server
  address with "Use default", and the key.
- **FR-007**: The store build MUST accept any `https://` server address and MUST refuse others.
  Access to a non-default address MUST be requested from the browser only when the user saves it.
- **FR-008**: The store build's install-time access MUST stay limited to Crunchyroll and the default
  Frunchy site.
- **FR-009**: The store build MUST NOT override or rewrite a stored server address.
- **FR-010**: The store listing texts and the privacy answers MUST mention self-hosting and explain
  the optional access.

**Scope**

- **FR-011**: Scraping, storage, sync rules, the backend contract and the popup MUST NOT change.
- **FR-012**: CLAUDE.md, `store/README.md` and the 002 spec MUST be updated so they describe the
  new behaviour and no longer describe a fixed backend.

### Key Entities

- **Release**: a version, the commit that sets it, its tag, the zip built from that commit, and the
  store submission.
- **Server address**: the Frunchy origin the extension talks to. The build provides a default; the
  user may replace it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A release needs 0 hand edits: one workflow run with a version does everything.
- **SC-002**: 100% of the invalid cases in FR-002 stop before any commit, tag or upload.
- **SC-003**: The store build's install prompt lists exactly 2 sites: Crunchyroll and the default
  Frunchy site.
- **SC-004**: In the store build, saving another `https://` address asks for exactly one extra
  site permission, and a non-`https://` address is refused.
- **SC-005**: `grep` finds 0 remaining references to the fixed-backend code (`FIXED_BACKEND`,
  `__STORE_BUILD__`, `connects_to`) in the repository.

## Assumptions

- The repository's default branch is `main`, and releases are made from it.
- The owner allows the workflow's own token to push to `main` (no branch protection blocking it),
  or uses the tag path. The GitHub environment `production` allows runs from `main` as well as
  from `v*` tags; the owner adjusts that rule (documented).
- A commit or tag pushed by the workflow's token doesn't start another workflow run (GitHub's rule),
  so a release is one run.
- A Chrome Web Store install and an unpacked development install have different extension IDs and
  separate storage, so no migration between them is needed.
- The default server address for the store build is still given at build time
  (`FRUNCHY_BACKEND_URL`), and the owner's is `https://frunchy.lacalabaza.xyz`.
- Version numbers are three parts. Chrome allows four, but the project doesn't use that.

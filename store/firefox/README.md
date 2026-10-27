# Firefox Add-ons (AMO) material

Everything needed to list Frunchy on addons.mozilla.org, except what only the owner can do (see the
checklist below). The Chrome Web Store material is in the parent directory, and `../README.md` has the
release workflow that both stores share.

## What's here

- `listing.en.md`, `listing.es.md`: name, summary, description, categories and support links, in
  English and Spanish. They follow the Chrome listing texts.
- `privacy.md`: the data collection declaration and why each category, and the permissions
  explained for the reviewers.
- `approval-notes.md`: the notes for Mozilla's reviewers. The release workflow sends them with each
  version.
- `SOURCE.md`: the build instructions for the reviewers. It travels inside the source archive.
- Screenshots: reuse `../images/screenshot-<lang>-<n>.png` (1280x800). They show invented data only.

## Build the upload

```bash
git status --porcelain          # must be empty: the source archive is `git archive HEAD`
FRUNCHY_BACKEND_URL=https://<domain> npm run package:firefox
```

This writes `release/frunchy-<version>-firefox.zip` and `release/frunchy-<version>-source.zip`. The
build asks at install only for Crunchyroll and that backend origin, as the Chrome build does. It
fails if the variable is missing or not `https://`, if the output mentions `localhost`, or if the
working tree has uncommitted changes. `npx web-ext lint --source-dir dist-firefox` should report no
errors, and three `UNSAFE_VAR_ASSIGNMENT` warnings that `approval-notes.md` explains.

The add-on id is `frunchy@lacalabaza.xyz`. It needs Firefox 140 or later on the desktop and 142 on
Android.

## Owner checklist

1. Create a developer account on addons.mozilla.org, with two-factor authentication.
2. Make sure the backend publishes `/privacy` (the privacy policy URL) and that the domain used in
   `FRUNCHY_BACKEND_URL` is live.
3. Submit the first listed version by hand, at <https://addons.mozilla.org/developers/addon/submit/>:
   choose **On this site** (listed), upload `release/frunchy-<version>-firefox.zip`, answer yes to
   "Do you need to submit source code?" and upload `release/frunchy-<version>-source.zip`. Add
   `approval-notes.md` as the notes for the reviewer.
4. Fill the listing: pick a license (the repository has none, so this is your choice), the
   categories, the summary and description from `listing.*.md`, the support links, the privacy
   policy URL, and screenshots from `../images/`.
5. Create API credentials at <https://addons.mozilla.org/developers/addon/api/key/>. Put them into
   Bella Baxter as `AMO_JWT_ISSUER` (the JWT issuer) and `AMO_JWT_SECRET` (the JWT secret), in the
   same project and environment as the Chrome secrets (`../README.md`, "One-time setup").
6. For every later version, run the release workflow (`../README.md`, "How a release works"). Its
   `publish-firefox` job uploads the zip and the source archive with
   `scripts/publish-firefox.sh` and submits the version for review. It needs the add-on to exist, so
   step 3 comes first. Version create inherits the license and the listing from the previous version.

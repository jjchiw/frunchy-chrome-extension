# Chrome Web Store material

Everything needed to list Frunchy on the Chrome Web Store, except what only the owner can do (see the
checklist below). The Firefox add-on is in `firefox/README.md`. The Edge add-on is in `edge/README.md`.

## What's here

- `listing.en.md`, `listing.es.md`: name, short and long description, the not-affiliated line,
  category and language, in English and Spanish.
- `privacy-practices.md`: copy-pasteable answers for the dashboard's Privacy practices tab (single
  purpose, a reason for every permission, remote code, data usage, privacy policy URL), plus a
  section on what the extension stores and sends that the backend's privacy page can reuse.
- `images/`: `screenshot-<lang>-<n>.png` (1280x800, four per language: ready to scrape, scraping,
  synced, connected options page) and `promo-440x280.png`. They show invented data only.
- `guide/`: the same four states without the canvas (`extension-<state>-<lang>.png`: the popup at
  380 px or the options page at 480 px, rendered at 2x) for the website's install guide. See
  `guide/README.md`.

## Regenerate the images

```bash
npm run store:assets
```

This builds the generator in `scripts/store-assets/`, which mounts the real popup and options page
with invented fixtures, and screenshots it with headless Chrome. Set `CHROME` to use another Chrome
binary than the macOS default. Captions are in `scripts/store-assets/entry.ts`. Look at every image
afterwards: no real names or titles, fonts rendered, nothing clipped.

## Build the upload

```bash
FRUNCHY_BACKEND_URL=https://<domain> npm run package
```

This writes `release/frunchy-<version>.zip`. The build asks at install only for Crunchyroll and that
backend origin, which is the default server address. Users who run their own Frunchy replace it in
the extension's settings, and Chrome then asks for that one `https://` site. It fails if the variable
is missing or not `https://`, or if the output mentions `localhost`.

## Owner checklist

1. Register a Chrome Web Store developer account: a one-time $5 fee, 2-step verification, a contact
   email and the trader declaration. The account email can't be changed later.
2. Deploy the backend on HTTPS and choose the domain.
3. Have the backend publish `/privacy`, the privacy policy URL used in `privacy-practices.md`.
4. Decide how to handle Crunchyroll's terms of service.
5. Run `package` with the real domain, then upload the zip by hand (the first upload can't use the API).
6. Fill the listing from `listing.*.md`, upload the images, and fill Privacy practices from
   `privacy-practices.md`.
7. Choose **Unlisted** visibility for the first release.
8. Submit for review.
9. For every later upload, run the release workflow with the new `version` (next section; do its
   one-time setup once the first release is out). No hand edit of the version files is needed.

## Publishing from GitHub Actions

`.github/workflows/release.yml` builds the zip and sends it to the Chrome Web Store.

### How a release works

Open **Actions**, **Release**, **Run workflow**, on `main`:

1. Type the `version` (`major.minor.patch`, higher than the current one), or leave it blank for the
   next patch (`0.1.1` becomes `0.1.2`), and tick `publish`.
2. The `release` job sets the version in `manifest.json`, `package.json` and `package-lock.json`
   with `scripts/set-version.mjs`, commits "Release v<version>" to `main` and tags `v<version>`. It
   has write access and runs no `npm ci`, only git, Node and `npm version`. It stops before changing
   anything if the version is malformed, not higher, already tagged, or the run isn't on `main`.
3. The `package` job builds that commit: `npm ci`, `npm run check` and `npm run package`, and keeps
   the zip as a workflow artifact. It has no secrets. It fails if the files' versions differ.
4. The `publish` job downloads the zip, gets the Chrome secrets from Bella Baxter and runs
   `scripts/publish-chrome.sh`, which uploads the zip and submits it for review.

With `publish` off (the default) the run is a dry run: it only builds a zip artifact from the files
as they are, ignores `version` and changes nothing in the repository. A push made with the
workflow's own token starts no second run, so the tag the `release` job creates doesn't release
twice. `publish_type` is `DEFAULT_PUBLISH` (publish after review) or `STAGED_PUBLISH` (stage it,
then publish from the dashboard).

The alternative is the tag path: raise `version` in `manifest.json` and `package.json` (they must
match) and commit, then `git tag v<version>` and push the tag. The `package` and `publish` jobs run
as above; the build fails if the tag isn't `v<version>`. Use it if `main` is protected against the
workflow's push.

The API only updates an item that exists, so the first upload must be done by hand in the dashboard.
Publishes through the API keep the visibility set in the dashboard (Unlisted for the first release).

### One-time setup

- [ ] **Google Cloud** (steps in <https://developer.chrome.com/docs/webstore/using-api>):
  - In a project, enable the "Chrome Web Store API".
  - Configure the OAuth consent screen: External. Then **publish the app** (Production). While it is
    in Testing, Google expires its refresh tokens after 7 days and releases would start failing.
  - Create an OAuth client of type **Web application** with the redirect URI
    `https://developers.google.com/oauthplayground`. Its client ID and secret are
    `CHROME_CLIENT_ID` and `CHROME_CLIENT_SECRET`.
  - In the OAuth Playground, use your own OAuth credentials and authorize the scope
    `https://www.googleapis.com/auth/chromewebstore`, signed in as the account that owns the item.
    Then exchange the code for tokens: the refresh token is `CHROME_REFRESH_TOKEN`.
  - Note the Publisher ID (Developer Dashboard, Publisher, Settings) and the extension ID.
- [ ] **Bella Baxter**: create a project (for example `frunchy-extension`) with an environment
  `production`, holding the secrets `CHROME_PUBLISHER_ID`, `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`,
  `CHROME_CLIENT_SECRET` and `CHROME_REFRESH_TOKEN`.
- [ ] **Bella Baxter trust domain** (environment, Identity, Add trust domain, GitHub template):
  - issuer `https://token.actions.githubusercontent.com`
  - role `Consumer`, TTL `15`, audiences empty (the CLI requests `bella-baxter`)
  - claim rules, all of which must match: `repository_id` Equals the numeric id from
    `gh api repos/<owner>/<repo> --jq .id`, and `environment` Equals `production`

  The `environment` rule matters: without it, any workflow run in the repository could read the
  secrets.
- [ ] **GitHub environment** `production`, with deployment branches and tags limited to the branch
  `main` and the tag pattern `v*`. This is what limits when the secrets can be read; Bella Baxter
  can't express tag patterns. A release from the workflow runs on `main`; the tag path runs on a
  `v*` tag.
- [ ] **Branch `main`** must accept a push from the workflow's token (no protection rule blocking it),
  because the `release` job pushes the version commit. If `main` is protected, allow that push or
  use the tag path.
- [ ] **GitHub repository variables** (not environment variables: a job's `if:` can't see
  environment variables, and Bella's context must be repository-level): `BELLA_BAXTER_TENANT`,
  `BELLA_BAXTER_PROJECT`, `BELLA_BAXTER_ENV` (optional, defaults to `production`) and
  `FRUNCHY_BACKEND_URL` (the `https://` origin the store build uses as its default server).

### Why there is no publish action

A third-party publish action would receive the refresh token. `puzzlers-labs/chrome-webstore-publish`
runs a `ghcr.io/...:latest` image, so pinning the action doesn't pin the code that would receive the
token. `scripts/publish-chrome.sh` is a short bash script of curl calls against the documented API, and it is
the only code in the workflow that sees the secrets. Every `uses:` in the workflow is pinned to a full
commit SHA.

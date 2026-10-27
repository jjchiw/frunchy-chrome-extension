# Contract: the Firefox build and package

## Commands

| Command | Does |
|---|---|
| `npm run build:firefox` | `vite build --mode firefox` into `dist-firefox/`; needs `FRUNCHY_BACKEND_URL=https://<domain>` (same rule as the store build) |
| `npm run package:firefox` | `build:firefox`, then `node scripts/package.mjs firefox` |

`npm run build`, `build:store` and `package` don't change.

## Manifest written to `dist-firefox/manifest.json`

Derived from `manifest.json` in `vite.config.ts`. Compared with the store manifest:

```jsonc
{
  // same: name, description, version, default_locale, icons, content_scripts, options_ui, action,
  // permissions (alarms, scripting, storage, unlimitedStorage)
  "host_permissions": ["https://www.crunchyroll.com/*", "<backend origin>/*"],   // as store
  "optional_host_permissions": ["https://*/*"],                                // as store
  "background": { "scripts": ["service-worker-loader.js"], "type": "module" },  // was service_worker
  // no "minimum_chrome_version"
  "browser_specific_settings": {
    "gecko": {
      "id": "frunchy@lacalabaza.xyz",
      "strict_min_version": "140.0",
      "data_collection_permissions": {
        "required": ["websiteContent", "personallyIdentifyingInfo", "authenticationInfo"]
      }
    },
    "gecko_android": { "strict_min_version": "142.0" }
  }
  // web_accessible_resources: written by CRXJS, without use_dynamic_url
}
```

## `scripts/package.mjs firefox`

Refuses (exit 1, nothing written) when:
- `dist-firefox/manifest.json` is missing;
- any file in `dist-firefox/` contains `localhost`;
- `git status --porcelain` isn't empty (the source archive must match the package).

Writes:
- `release/frunchy-<version>-firefox.zip`: `dist-firefox/` contents at the zip root;
- `release/frunchy-<version>-source.zip`: `git archive HEAD`. It includes `store/firefox/SOURCE.md`,
  the reviewer's build instructions.

With no argument, the script behaves exactly as today (the Chrome store zip).

## Release workflow (FR-013: the workflow submits)

- `package` (no secrets): after `npm run package`, also `npm run package:firefox`; upload
  `release/frunchy-<version>-firefox.zip` and `release/frunchy-<version>-source.zip` as the
  artifact `frunchy-<version>-firefox`.
- `publish-firefox` (new): `needs: [release, package]`, the same `if:` and `environment: production`
  as `publish`, `permissions: contents: read, id-token: write`. It sparse-checks out
  `scripts/publish-firefox.sh` and `store/firefox/approval-notes.md`, downloads the artifact, sets
  up Bella with OIDC, and runs `bella run -- bash scripts/publish-firefox.sh
  "release/frunchy-$VERSION-firefox.zip" "release/frunchy-$VERSION-source.zip"` with `VERSION`.
- `publish` (Chrome) is unchanged and doesn't depend on `publish-firefox`.
- The workflow is renamed "Release". `concurrency` stays one release at a time.

## `scripts/publish-firefox.sh <zip> <source zip>`

Required environment: `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`. Optional: `VERSION` (the upload's
parsed version must equal it), `ADDON_ID` (default `frunchy@lacalabaza.xyz`), `APPROVAL_NOTES`
(path, default `store/firefox/approval-notes.md`; skipped if missing), and, for tests only,
`API_BASE` (default `https://addons.mozilla.org`) and `POLL_SECONDS`. Needs bash, curl, jq and
openssl. It masks the secrets in Actions and never puts the secret or a token in process
arguments or the log. Steps are in [research.md](../research.md) R9. Exit 0 only when the version
is created (awaiting review) with its source attached.

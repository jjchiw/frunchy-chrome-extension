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
      "id": "<owner's add-on id>",
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
- the add-on id is still the placeholder;
- `git status --porcelain` isn't empty (the source archive must match the package).

Writes:
- `release/frunchy-<version>-firefox.zip`: `dist-firefox/` contents at the zip root;
- `release/frunchy-<version>-source.zip`: `git archive HEAD`. It includes `store/firefox/SOURCE.md`,
  the reviewer's build instructions.

With no argument, the script behaves exactly as today (the Chrome store zip).

## Release workflow (assumed default for FR-013: build only)

The `package` job also runs `npm run package:firefox` and uploads both Firefox files as one
artifact, `frunchy-<version>-firefox`. `release` and `publish` don't change. AMO upload is by hand
(`store/firefox/README.md`).

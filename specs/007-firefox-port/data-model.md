# Data model: Frunchy for Firefox

No stored data changes. `chrome.storage.local` keeps the same keys and shapes in Firefox:
`page:*`, `index`, `crunchyrollProfile`, `settings`, `sync`, `uploadQueue` and `upload:*`. A Firefox
install and a Chrome install have separate storage, so nothing is migrated.

## Derived at runtime (not stored)

- **Required origins**: `https://www.crunchyroll.com/*`, plus `<settings.baseUrl origin>/*` when a
  sync key is set. Recomputed on every popup open and on `permissions.onAdded` / `onRemoved`.
- **Missing origins**: the required origins for which `permissions.contains` is false. Non-empty
  means the popup is in the `access` state ([contracts/popup-access.md](contracts/popup-access.md)).
- **Platform**: from `chrome.runtime.getPlatformInfo().os`. Only used to hide what Android can't do
  (R5.3, and later R10).

## Build-time values

| Value | Chrome dev | Chrome store | Firefox |
|---|---|---|---|
| `__BACKEND_URL__` | `http://localhost:5099` | `FRUNCHY_BACKEND_URL` origin | `FRUNCHY_BACKEND_URL` origin |
| Output | `dist/` | `dist-store/` | `dist-firefox/` |
| Background key | `service_worker` | `service_worker` | `scripts` |
| Add-on id | none | none | owner's `gecko.id` |

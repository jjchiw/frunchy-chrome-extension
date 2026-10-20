# Contract: builds and packaging

| Command | Output | Manifest differences | Backend |
|---|---|---|---|
| `npm run dev` / `npm run build` | `dist/` | `manifest.json` as is | `http://localhost:5099` by default; changeable in options |
| `npm run build:store` | `dist-store/` | host permissions: Crunchyroll plus the backend origin; no optional host permissions | `FRUNCHY_BACKEND_URL` origin, fixed |
| `npm run package` | `release/frunchy-<version>.zip` (zip of `dist-store/`) | as `build:store` | as `build:store` |
| `npm run store:assets` | `store/images/*.png` | n/a (not an extension build) | none (offline fixtures) |

## Inputs

- `FRUNCHY_BACKEND_URL`: required by `build:store` and `package`. It must parse as a URL with
  `https:` as the protocol. Only its origin is used.

## Failure messages

- **Missing variable**: `FRUNCHY_BACKEND_URL is required for the store build, e.g. FRUNCHY_BACKEND_URL=https://frunchy.example npm run package`
- **Not https or invalid**: `FRUNCHY_BACKEND_URL must be an https:// URL (got "<value>")`
- **`localhost` found in `dist-store/`** (from `package`): `dist-store contains "localhost" in <file>; the store build must not reach local addresses`

## Manifest, both builds (`manifest.json`)

- `description`: `__MSG_ext_description__`
- `minimum_chrome_version`: `119`
- `permissions`: `alarms`, `scripting`, `storage`, `unlimitedStorage`
- No `externally_connectable`.

## Options page

| | Development build | Store build |
|---|---|---|
| Backend URL field and "Use default" | shown | hidden |
| "Connects to <host>" line | hidden | shown |
| Permission prompt on save | for a non-default origin | never |

# Quickstart: validate the release input and the self-hosted server

## 1. Builds

```bash
npm ci && npm run check && npm run build
FRUNCHY_BACKEND_URL=https://frunchy.example npm run package
node -e 'const m=require("./dist-store/manifest.json");console.log(m.host_permissions,m.optional_host_permissions)'
grep -rnE 'FIXED_BACKEND|__STORE_BUILD__|connects_to' src public scripts store CLAUDE.md   # nothing
```

Expected store manifest: `host_permissions` `["https://www.crunchyroll.com/*","https://frunchy.example/*"]`,
`optional_host_permissions` `["https://*/*"]`. The dev manifest is unchanged.

## 2. `scripts/set-version.mjs`, in a scratch copy of the repository

| Case | Expected |
|---|---|
| no argument, current 0.1.1 | prints `0.1.2`; the three files say 0.1.2 |
| `0.2.0` | prints `0.2.0`; files updated |
| `0.1.1` (equal) / `0.1.0` (lower) | exit 1, "not higher", files untouched |
| `1.2` / `v1.2.3` / `1.2.3.4` | exit 1, "must be major.minor.patch", files untouched |
| `0.3.0` when tag `v0.3.0` exists locally | exit 1, "already exists", files untouched |

## 3. Workflow lint

`actionlint` with `shellcheck` on `.github/workflows/release.yml` (binaries from the earlier
feature's scratch dirs): no findings.

## 4. Options page (store build) in the harness

Screenshot of `Settings.svelte` built with the store defines: the server field shows the default
address, "Use default" is hidden, the key field and the not-affiliated line are there. Save with
`http://other.example` → the invalid-address message, and no `permissions.request` call in the
stub's log. Save with `https://other.example` → one `permissions.request` for
`https://other.example/*`.

## 5. Owner's checks

- GitHub: environment `production` → deployment rule includes branch `main`.
- Run the workflow by hand with `publish` **off**: a zip artifact appears, nothing is committed.
- Run it with `publish` on and `version` blank: a "Release v0.1.2" commit and tag appear, the store
  gets 0.1.2.
- Load the store build, enter another `https://` address in the settings: Chrome asks for that
  site, then the key check runs there.

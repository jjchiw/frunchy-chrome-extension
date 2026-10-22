# Contract: the release workflow after this feature

## Triggers and inputs

| Trigger | Inputs | Effect |
|---|---|---|
| push of a tag `v*` | none | build from the tag, publish (as today) |
| `workflow_dispatch`, `publish` off | `version` ignored | build a zip artifact from the dispatched ref; no commit, no tag, no upload |
| `workflow_dispatch`, `publish` on, from the default branch | `version` (optional), `publish_type` | set the version, commit, tag, build from that commit, publish |
| `workflow_dispatch`, `publish` on, from another branch | | fails in the `release` job before any change |

`version`: `major.minor.patch`. Blank means the next patch after `manifest.json`'s version.

## Jobs

| Job | Runs when | Permissions | Runs | Outputs |
|---|---|---|---|---|
| `release` | dispatch, `publish` on, default branch | `contents: write` | git, `node scripts/set-version.mjs`, `npm version` (via the script); no `npm ci` | `version`, `sha` |
| `package` | always, after `release` succeeded or was skipped | `contents: read` | `npm ci`, `npm run check`, `npm run package` | `version` |
| `publish` | `package` succeeded and (tag push or `publish` on) | `contents: read`, `id-token: write`, environment `production` | `scripts/publish-chrome.sh` under `bella run` | |

## `scripts/set-version.mjs [version]`

- Exit 0: prints the version it set. `manifest.json`, `package.json` and `package-lock.json` all
  carry it.
- Exit 1, nothing written, one line on stderr:
  - `version must be major.minor.patch (got "<value>")`
  - `version <value> is not higher than the current <current>`
  - `tag v<value> already exists`

## Checks in `package`

- `manifest.json` and `package.json` versions are equal.
- On a tag push: the tag is `v<version>`.
- After a `release` job: `needs.release.outputs.version` equals the files' version.

## Owner settings this depends on

- GitHub environment `production`: deployment rule allows branch `main` and tags `v*`.
- Branch `main` accepts pushes from the workflow's token (no protection rule blocking it), or the
  owner uses the tag path.

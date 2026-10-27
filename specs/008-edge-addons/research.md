# Research: Frunchy on Microsoft Edge Add-ons

## Spike (2026-10-27, Microsoft Edge 156.0.4314.42, macOS)

Throwaway harness (selenium-webdriver, msedgedriver 156, headless). It loaded the Chrome store build
(`FRUNCHY_BACKEND_URL=https://frunchy.example npm run build:store`) unpacked with
`--load-extension`, then:

| Probe | Result |
|---|---|
| Extension installed | yes (`Frunchy` listed) |
| `/history`: hook installed (XHR `open` not native) | yes |
| `scripting.getRegisteredContentScripts()` | `frunchy-xhr-hook` in world `MAIN` |
| `tabs.sendMessage(SCROLL_STATUS)` | `{ ok: true, scrolling: false }` |
| `permissions.contains(crunchyroll)` | true |

Not covered: a signed-in scrape, the Edge Add-ons install prompt, and the store's own validation of
the package (checked on the owner's first upload).

## R1. One package for Chrome and Edge

**Decision**: Edge gets the Chrome store zip `release/frunchy-<version>.zip` unchanged.

**Rationale**: Edge is Chromium; the spike runs it. Edge ignores `minimum_chrome_version` (Edge
versions follow Chromium's). A second build would add a manifest to keep in step for no gain.

**Alternatives considered**: an `edge` build mode. Rejected: nothing differs.

## R2. Edge Add-ons Update API v1.1

Source: <https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api> and
the [reference](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/addons-api-reference)
(updated 2026-09-02).

- Root `https://api.addons.microsoftedge.microsoft.com`. Every request carries
  `Authorization: ApiKey <key>` and `X-ClientID: <client id>`. The keys come from Partner Center,
  Publish API, "Create API credentials", and each key has an expiry date.
- Upload: `POST /v1/products/<productID>/submissions/draft/package`, `Content-Type:
  application/zip`, the zip as the body. The response is `202` with `Location: <operationID>`.
- Upload status: `GET /v1/products/<productID>/submissions/draft/package/operations/<operationID>`.
  The response is `200` with `{ id, status: "InProgress" | "Succeeded" | "Failed", message,
  errorCode, errors }`.
- Publish: `POST /v1/products/<productID>/submissions`, with the certification notes as the body.
  The response is `202` with `Location: <operationID>`.
- Publish status: `GET /v1/products/<productID>/submissions/operations/<operationID>`, same shape.
  Failure codes include `CreateNotAllowed`, `NoModulesUpdated`, `InProgressSubmission`,
  `UnpublishInProgress`, `ModuleStateUnPublishable` and `SubmissionValidationError`.
- There is no endpoint that creates a product or edits listing metadata, so the first version and
  the listing are made in Partner Center.

**Open detail**: the publish body. The reference says "notes for certification, in plain text";
the overview's curl example sends `{ "notes"="text value" }` (not valid JSON); the PowerShell example
sends a form-encoded `notes`. The script sends `{"notes": "<text>"}` with `Content-Type:
application/json`, which is what community publishers do. If the first real run rejects it, the
fallback is plain text. `quickstart.md` makes the owner's first automated release the check.

**`Location`**: documented as the operation ID. The script takes the last path segment, so a full
URL works too.

## R3. Script and job

**Decision**: `scripts/publish-edge.sh <zip>` (bash, curl and jq, never npm), modelled on
`publish-chrome.sh`:
- the secrets `EDGE_CLIENT_ID` and `EDGE_API_KEY` are masked in Actions;
- both headers go to curl as a config on stdin;
- the product ID `EDGE_PRODUCT_ID` isn't secret but lives with the others in Bella, like
  `CHROME_EXTENSION_ID`.

A new job `publish-edge` mirrors `publish`: the same `needs`, `if`, `environment: production`, OIDC
and Bella setup. It downloads the Chrome artifact `frunchy-<version>` and is independent of the other
two publish jobs.

**Failure messages** map `errorCode` to a cause:
- `InProgressSubmission`: "a previous version is still in certification; re-run this job when it
  ends".
- `NoModulesUpdated`: "this package was already submitted".
- `CreateNotAllowed`: "submit the first version by hand".
- 401: "check `EDGE_CLIENT_ID` and `EDGE_API_KEY`; API keys expire, renew it in Partner Center".

## R4. Other browsers (owner, 2026-10-27)

- **Brave, Vivaldi, Arc, Opera**: install from the Chrome Web Store. No listing.
- **LibreWolf, Zen, Floorp, Waterfox**: install from addons.mozilla.org (007). No listing.
- **Safari**: dropped.
- **Ladybird**: no extension API yet. The August 2026 "This Month in Ladybird" describes per-"world"
  DOM wrappers as groundwork for content scripts. Revisit with a spike when it ships.

# Contract: Edge publishing

## `scripts/publish-edge.sh <zip>`

Required environment: `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID` and `EDGE_API_KEY`.

Optional environment:
- `CERT_NOTES`: a path, default `store/edge/certification-notes.md`. If the file is missing, an
  empty note is sent.
- For tests only: `API_BASE` (default `https://api.addons.microsoftedge.microsoft.com`) and
  `POLL_SECONDS` (default 10).

Needs bash, curl and jq.

1. Mask `EDGE_CLIENT_ID` and `EDGE_API_KEY` (when `GITHUB_ACTIONS=true`) before any request.
2. `POST $API_BASE/v1/products/$EDGE_PRODUCT_ID/submissions/draft/package`, with
   `Content-Type: application/zip` and `--data-binary @<zip>`. Expect `202`. The operation ID is
   the last path segment of the `Location` header; fail if it's missing.
3. Poll `GET …/submissions/draft/package/operations/<op>` every `POLL_SECONDS`, at most 60 times,
   while `status` is `InProgress`. On `Failed`, print `message`, `errorCode` and each of `errors`,
   then fail.
4. `POST …/submissions` with `Content-Type: application/json` and
   `jq -Rs '{notes: .}' < $CERT_NOTES`. Expect `202` and an operation ID from `Location`.
5. Poll `GET …/submissions/operations/<op>` the same way. On `Succeeded`, print
   "Submitted for certification: <message>" and exit 0. On `Failed`, print the cause from the
   [research.md](../research.md) R3 table (or `message` and `errors`), then fail.

Throughout:
- Both headers go to curl as a config on stdin. Neither secret is ever in argv or printed.
- A 401 or 403 fails with the credentials message, including that keys expire.
- Any other non-2xx fails with the status and body.
- API responses may be printed.

## Release workflow

New job `publish-edge`:

```yaml
publish-edge:
    needs: [release, package]
    if: <same as publish>
    environment: production
    permissions: { contents: read, id-token: write }
    # same Bella env as publish
    steps:
        - checkout (pinned SHA, no credentials, sparse: scripts/publish-edge.sh, store/edge/certification-notes.md)
        - download-artifact (pinned SHA) name frunchy-<version>, path release/
        - bella setup (pinned SHA, oidc)
        - run: bella run -- bash scripts/publish-edge.sh "release/frunchy-$VERSION.zip"   (VERSION via env)
```

`publish` and `publish-firefox` don't change. The top comment lists the three publish jobs.

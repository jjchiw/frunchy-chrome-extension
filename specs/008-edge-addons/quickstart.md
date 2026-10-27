# Quickstart: validate Edge Add-ons

## Locally

```bash
FRUNCHY_BACKEND_URL=https://<domain> npm run package     # release/frunchy-<version>.zip, also the Edge package
```

Load `dist-store/` in Edge (`edge://extensions`, Developer mode, Load unpacked), sign in to
Crunchyroll, set a sync key, scrape. Expect the same result as in Chrome (SC-003).

Script: run the fake-API tests (tasks T004). Lint with actionlint and shellcheck (T006).

## Owner's first release (the real check)

1. Submit the first version by hand in Partner Center with that zip (`store/edge/README.md`).
2. After it's certified, create the API credentials and put `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID` and
   `EDGE_API_KEY` in Bella.
3. Run the release workflow with a new version. Expect the `publish-edge` job to end with
   "Submitted for certification". Partner Center should then show the new version in
   certification.
4. If the publish step fails on the request body (research R2, open detail), report the job log.
   The fix is in `publish-edge.sh` only.

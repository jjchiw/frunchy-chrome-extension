# Microsoft Edge Add-ons material

Everything needed to list Frunchy on the Microsoft Edge Add-ons store, except what only the owner can
do (see the checklist below). Edge runs the Chrome package unchanged, so there is no Edge build: the
upload is `release/frunchy-<version>.zip`. The Chrome Web Store material is in the parent directory,
and `../README.md` has the release workflow that all the stores share.

## What's here

- `listing.en.md`, `listing.es.md`: name, short description, description, category, search terms and
  support links, in English and Spanish. They follow the Chrome listing texts.
- `privacy.md`: the answers about personal data, why each permission is needed, and the privacy
  policy URL.
- `certification-notes.md`: the notes for Microsoft's testers. The release workflow sends them with
  each version.
- Screenshots: reuse `../images/screenshot-<lang>-<n>.png` (1280x800). They show invented data only.

## Build the upload

```bash
FRUNCHY_BACKEND_URL=https://<domain> npm run package
```

This writes `release/frunchy-<version>.zip`, the same file the Chrome Web Store gets. See
`../README.md` for what the build checks.

## Owner checklist

1. Register as an Edge developer in Partner Center. It is free.
2. Make sure the backend publishes `/privacy` (the privacy policy URL) and that the domain used in
   `FRUNCHY_BACKEND_URL` is live.
3. Make the first submission by hand: create a new extension in Partner Center and upload
   `release/frunchy-<version>.zip` from `npm run package`.
4. Fill the properties and the listing: the category, the texts from `listing.*.md`, the support
   links, the privacy policy URL (`privacy.md`) and screenshots from `../images/`. Choose the
   availability (markets) and the visibility. Paste `certification-notes.md` as the notes for
   certification. Submit it, and wait until it is certified.
5. Once the extension exists, open **Publish API** in Partner Center, enable the new experience, and
   create API credentials. Put them into Bella Baxter as `EDGE_CLIENT_ID` (the client ID) and
   `EDGE_API_KEY` (the API key), and add `EDGE_PRODUCT_ID` (the product ID, shown in the extension's
   overview), in the same project and environment as the other stores' secrets (`../README.md`,
   "One-time setup").
6. Renew the API key before its expiry date: Partner Center shows it next to the key. An expired key
   makes the `publish-edge` job fail with a message that says so. Create a new key, and replace
   `EDGE_API_KEY` in Bella Baxter.
7. For every later version, run the release workflow (`../README.md`, "How a release works"). Its
   `publish-edge` job uploads the same zip with `scripts/publish-edge.sh` and submits it for
   certification. It needs the extension to exist, so steps 3 and 4 come first. The listing and the
   visibility stay as they are in Partner Center.

The job fails with a clear message if a previous version is still in certification (re-run it when
that ends) or if the package was already submitted.

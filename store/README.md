# Chrome Web Store material

Everything needed to list Frunchy on the Chrome Web Store, except what only the owner can do (see the
checklist below).

## What's here

- `listing.en.md`, `listing.es.md`: name, short and long description, the not-affiliated line,
  category and language, in English and Spanish.
- `privacy-practices.md`: copy-pasteable answers for the dashboard's Privacy practices tab (single
  purpose, a reason for every permission, remote code, data usage, privacy policy URL), plus a
  section on what the extension stores and sends that the backend's privacy page can reuse.
- `images/`: `screenshot-<lang>-<n>.png` (1280x800, four per language: ready to scrape, scraping,
  synced, connected options page) and `promo-440x280.png`. They show invented data only.

## Regenerate the images

```bash
npm run store:assets
```

This builds the generator in `scripts/store-assets/`, which mounts the real popup and options page
with invented fixtures, and screenshots it with headless Chrome. Set `CHROME` to use another Chrome
binary than the macOS default. Captions are in `scripts/store-assets/entry.ts`. Look at every image
afterwards: no real names or titles, fonts rendered, nothing clipped.

## Build the upload

```bash
FRUNCHY_BACKEND_URL=https://<domain> npm run package
```

This writes `release/frunchy-<version>.zip`. The build asks only for Crunchyroll and that backend
origin, and is fixed to it. It fails if the variable is missing or not `https://`, or if the output
mentions `localhost`.

## Owner checklist

1. Register a Chrome Web Store developer account: a one-time $5 fee, 2-step verification, a contact
   email and the trader declaration. The account email can't be changed later.
2. Deploy the backend on HTTPS and choose the domain.
3. Have the backend publish `/privacy`, the privacy policy URL used in `privacy-practices.md`.
4. Decide how to handle Crunchyroll's terms of service.
5. Run `package` with the real domain, then upload the zip.
6. Fill the listing from `listing.*.md`, upload the images, and fill Privacy practices from
   `privacy-practices.md`.
7. Choose **Unlisted** visibility for the first release.
8. Submit for review.
9. For every later upload, raise `version` in `manifest.json` and `package.json` first.

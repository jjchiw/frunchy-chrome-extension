# Quickstart: validate the store release build

Run every command from the repository root.

## 1. Development build is unchanged apart from permissions

```bash
npm run build && npm run check
grep -o 'service-worker.ts-[^"]*' dist/service-worker-loader.js
node -e 'const m=require("./dist/manifest.json");console.log(m.permissions,m.host_permissions,m.optional_host_permissions,m.minimum_chrome_version,m.description,m.externally_connectable)'
```

Expected:
- `[alarms, scripting, storage, unlimitedStorage]`
- the three dev host permissions
- the optional `http(s)` permissions
- `119`
- `__MSG_ext_description__`
- `undefined` (no `externally_connectable`)

## 2. Store build guards

```bash
npm run build:store                                     # fails: variable missing
FRUNCHY_BACKEND_URL=http://frunchy.example npm run build:store   # fails: not https
FRUNCHY_BACKEND_URL=https://frunchy.example/some/path npm run package
```

Expected:
- The first two fail with the messages in `contracts/build.md`, and write no `release/` zip.
- The third writes `release/frunchy-0.1.0.zip`.
  - Its manifest's `host_permissions` are exactly `https://www.crunchyroll.com/*` and
    `https://frunchy.example/*`, with no `optional_host_permissions`.
  - `grep -r localhost dist-store` prints nothing.

## 3. Behaviour in Chrome (the owner, or the harness for the options page)

- Load `dist/` unpacked. On a Crunchyroll history tab, the popup reaches Scrape; on another site
  it offers to open the history page. Scrape, Stop and Reload work. The install details on
  `chrome://extensions` list no "Read your browsing history".
- Load `dist-store/` unpacked. The options page shows "Connects to frunchy.example" and no URL
  field.
- With a `localhost` backend stored from a dev install, loading the store build switches it to the
  build's backend, keeps the key, and resets the marker.

## 4. Icon

Open `src/assets/icons/frunchy128.png`. The tile's bounding box is x and y 16–111, and the corner
pixels are fully transparent.

## 5. Store materials

```bash
npm run store:assets
file store/images/*.png    # screenshots 1280 x 800 (4 per language), promo 440 x 280
```

- The short descriptions in `store/listing.*.md` are at most 132 characters.
- Every permission in the store manifest has a reason in `store/privacy-practices.md`.
- No image or text shows a real profile name or a real watch-history entry.

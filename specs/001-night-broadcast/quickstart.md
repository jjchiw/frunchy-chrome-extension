# Quickstart: validate the Night Broadcast change

Run all commands from the repository root (the worktree, during development).

## 1. Build and type check

```bash
npm i
npm run build    # must succeed
npm run check    # svelte-check: 0 errors, 0 warnings
grep -o 'service-worker.ts-[^"]*' dist/service-worker-loader.js   # the worker loads its own chunk
du -sh dist      # SC-007: under 1 MB
```

## 2. Token parity (SC-001)

The backend runs this check, but it can be reproduced here: compare every `--name: value;` in
`src/styles/tokens.css` (except `--font-family`) with `Theme.fs` on the backend branch
`010-night-broadcast`, using the same regex as `DesignSystemTests.fs` (research R1). Expected
result: 0 missing names and 0 different values.

## 3. Nothing from the old system is left (SC-006, FR-007, FR-012)

```bash
grep -rnE 'gradient|plus-jakarta|jetbrains|#0f131c|76 215 246|6 182 212|192 193 255|49 53 62|255 255 255 /' src public/manifest.json manifest.json 2>/dev/null
# expected: no output
grep -rnE 'text-transform: *uppercase' src/components   # expected: no output
```

Also, every token in `tokens.css` is used somewhere in `src/` (`data-model.md`, validation rules).

## 4. Contrast (SC-002)

Run the contrast script from research R9 over the pairs in `contracts/popup-ui.md`. Expected:
every text pair is at least 4.5:1, and field borders are at least 3:1.

## 5. Popup height (SC-003, FR-017)

Use the headless harness from research R7, kept outside the repository. Expected:

| State | Language | Height |
|---|---|---|
| Tab needs a reload, sync error, 3 pages waiting, import line, 3 recent episodes, footer | es | ≤ 600px (record the number) |
| Ready to scrape, synced, 3 recent episodes | en | ≤ 600px |

Look at the screenshots of both states. Nothing overlaps, the profile pill truncates with an
ellipsis, and the fonts are Figtree, Bricolage Grotesque for the wordmark and titles, and IBM
Plex Mono on the options page.

## 6. Icons (FR-019)

`src/assets/icons/frunchy{16,32,48,128}.png` show the amber, darker amber and rose mark on a
`#13111a` tile. `src/assets/brand/frunchy-mark.svg` is identical to the backend's
`design/brand/frunchy-mark.svg` (`cmp` returns 0).

## 7. Manual check in Chrome (the owner)

Load `dist/` as an unpacked extension, then:
- Open the popup on `https://www.crunchyroll.com/history` and on another site.
- Scrape a few pages and check that the running line shows, also with "Reduce motion" turned on
  in the OS settings.
- Open the options page and enter a wrong key.
- Check the toolbar icon on a light and a dark Chrome theme.

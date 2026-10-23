# Guide screenshots

`extension-{ready,scraping,synced,options}-{en,es}.png`: the popup (380 px wide) or the options page
(480 px wide) alone, at 2x, with no canvas or caption. They are for the website's install guide: the
backend's `/guide` copies them (`wwwroot/guide/`), so tell the backend session when they change.

Regenerate them, with the Chrome Web Store images, with `npm run store:assets` (see
`../README.md`). The generator page is `scripts/store-assets/entry.ts` (`kind=plain`).

The data is invented: profile "Mika", "Example Series" and the other titles, and a made-up backend
(`https://frunchy.example`). Nothing comes from a real account.

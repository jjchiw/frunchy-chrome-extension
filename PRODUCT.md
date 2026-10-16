# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anime viewers who watch on Crunchyroll and want their watch history in Frunchy. Today that is the owner alone; next, people invited to Frunchy (sign-up is invite-only); later, anyone installing it from the Chrome Web Store. Work that assumes the user already knows the setup (sync key, history page) won't hold for the later audiences, so first-run states matter.

## Product Purpose

The extension is the only way Crunchyroll watch history gets into Frunchy. It captures the watch-history responses Crunchyroll's own site loads on `/history`, stores them verbatim, uploads them to the Frunchy backend with the user's sync key, and can export them as JSON. Success: the user's full history reaches Frunchy, and later visits only add what's new.

Right now people open the popup mainly to scrape: start the auto-scroll on the history page, watch it progress, stop it.

## Positioning

Frunchy is a Last.fm-style home for anime watch history, independent of Crunchyroll. The extension is the bridge: it reads the history the user's own logged-in browser already receives, so nothing about the user's Crunchyroll account (tokens, password) ever leaves the browser.

## Operating Context

- A Chrome toolbar popup (MV3; at most 800×600) plus an options page for backend URL and sync key.
- Used alongside a `www.crunchyroll.com/history` tab; scraping only works when that tab is active.
- A Crunchyroll account can have several profiles; history is tracked per profile.
- The web dashboard (FrunchyBackend, `/u/{username}`) is where history is browsed; the popup links to it.

## Capabilities and Constraints

- Popup: scrape (auto-scroll) / stop, capture summary, sync status and last import status, resend stored pages, download JSON, clear stored data, link to the dashboard and to settings.
- Data shown must come from stored pages, the upload queue, sync state, or `GET /api/me`. No invented numbers (levels, ranks, trends, ratings).
- New API needs are agreed with the FrunchyBackend session as a contract change before either side builds them.
- English and Spanish via `chrome.i18n`; Spanish uses "tú".
- No remote fonts or scripts; assets ship with the extension. Episode thumbnails load from Crunchyroll's image server, as on the site.
- Undecided: auto-sync on visiting `/history` and success notifications (out of scope for now).

## Brand Commitments

- Name: Frunchy.
- Visual system: Night Broadcast, `../FrunchyBackend/design/night_broadcast/DESIGN.md`, is binding and shared with the web dashboard, so the popup and site read as one product. Design token names are kept identical across both.

## Evidence on Hand

- Real watch-history samples: `../test-read-json/db/*.json` (Crunchyroll response shape).
- Mockups: `../FrunchyBackend/design/` (popup, dashboard, Anime DNA). Mockup elements with no data source stay out.
- Brand mark: `src/assets/brand/frunchy-mark.svg` (copied from `../FrunchyBackend/design/brand/`), used for the popup header and, on a dark tile, the extension icons.

## Product Principles

1. Never lose or silently skip history; make partial states (stopped scrape, pending uploads, errors) visible.
2. Show only what the extension actually knows.
3. Crunchyroll credentials never leave the browser.
4. One product with the web dashboard: same tokens, same voice.

## Accessibility & Inclusion

Aim for full accessibility: WCAG 2.2 AA as the floor (contrast, focus visibility, target size), complete keyboard operation, screen-reader-announced status changes (scrape progress, sync results), and respect for `prefers-reduced-motion`.

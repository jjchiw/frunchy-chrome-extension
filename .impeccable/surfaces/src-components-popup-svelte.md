---
version: 1
slug: "src-components-popup-svelte"
primary_target: "src/components/Popup.svelte"
related_targets: ["src/components/Settings.svelte"]
---

# Popup (toolbar popup, `src/components/Popup.svelte`)

Mode: Operate. Audience: Crunchyroll viewers syncing to Frunchy (owner now, invitees next, Web Store later). Job right now: start, watch and stop a history scrape; secondarily, confirm sync health. Constraints: Chrome popup (≤800×600, designed at 380 wide, target ≤600 tall), en/es, offline assets, only real data. Approved composition: `../FrunchyBackend/design/extensi_n_frunchy_popup_sincronizador/` minus elements without a data source (level/avatar, PRO, trends, engine label, toggles, bottom nav). Options page restyled in the same tokens.

## Direction contract

THESIS: The popup is a capture console: one hero card whose single action follows the real state (open history → scrape → stop), with the evidence of what was captured right under it. It refuses the generic extension-popup stack of equal gray buttons.

OWN-WORLD: Night Broadcast tokens: deep plum #13111a canvas, solid surface-container cards at radius-lg with no border or shadow, amber #ffb547 for the one live action and live state, lilac #c9bcff for tags and waiting, rose #ff6fa8 for a failed import, coral #ff9b85 for errors, Figtree with Bricolage Grotesque headings, Material Symbols as SVG, tabular numerals.

STORY: The user sees whether this tab can be scraped, presses the one amber button, watches entries count up live, and sees their newest episodes appear with a stored/pending/synced state, then follows the dashboard link.

FIRST VIEWPORT: Header (the mark without a tile, Frunchy, sync status dot + text, settings icon). Hero card (state title with the Crunchyroll profile chip beside it, state sentence, full-width amber primary button, meta rows: sync error with its link above last sync, waiting uploads, last import). Recent episodes (section label with stored date range, 16:9 thumbnail with progress bar, series, Ep · duration · when, status). Footer, only once something exists: Dashboard and Anime DNA links, Sync stored / Download / Clear icon actions. No version, no tab strip, no stat tiles (owner rules; the tiles repeated the hero).

FORM: Mockup composition, adapted. The original request pins it ("redesign the popup from ../FrunchyBackend/design/extensi_n_frunchy_popup_sincronizador/"), so no concept roll and no seed key.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

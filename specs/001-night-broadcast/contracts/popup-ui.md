# UI contract: popup and options page on Night Broadcast

The extension's side of the backend's
`FrunchyBackend/specs/010-night-broadcast/contracts/design-system.md`. The token values come from
there, and `data-model.md` lists the ones the extension uses. This file fixes what each element
looks like, so implementation and review check against the same list. A tint written as
"`X` @ n%" is `rgb(from var(--color-X) r g b / n)`.

## Popup (`src/components/Popup.svelte`)

| Element (class) | Text / icon | Background | Border / shape | Font |
|---|---|---|---|---|
| Brand mark (`.mark`) | the new mark, 32px | none (no tile) | none | |
| Wordmark (`h1.wordmark`) | `on-surface` | | | display, headline-md size, 800, -0.025em |
| Sync status, on (`.sync-on`) | text `on-surface-variant`, dot `primary` | | dot full radius | label-md |
| Sync status, off (`.sync-off`) | text `on-surface-variant`, dot `outline` | | | label-md |
| Sync status, issue (`.sync-issue`) | `error` (text and dot) | | | label-md |
| Icon buttons (`.icon-button`) | `on-surface-variant`; hover `on-surface` | hover `surface-container` | full radius, 36px | |
| Icon button, disabled | `outline-variant` | | | |
| Main card (`.hero`) | | `surface-container-low`, solid | `radius-lg`, no border, no shadow | |
| Main card, running (`.hero.running`) | | | a solid 2px `primary` top line, plus a ~30% `primary-fixed` segment sweeping over it (hidden with reduced motion) | |
| Card title (`h2.hero-title`) | `on-surface` | | | display, headline-md size, line, weight and tracking tokens |
| Profile pill (`.profile`) | `tertiary` | `tertiary` @ 14% | 1px `tertiary` @ 25%, full radius | label-md |
| Card text (`.hero-text`) | `on-surface-variant` | | | body-md |
| Main button (`.action`) | `on-primary` | `primary`; hover `primary-fixed` and `--glow-primary` | full radius, min 48px tall | body-lg, 700 |
| Main button, disabled | `on-surface-variant` | `surface-container-highest` | | |
| Stop (`.action-stop`) | `primary` | `primary` @ 8%; hover `primary` @ 14% | inset 1px `primary` @ 50%, full radius | body-lg, 700 |
| Meta rows (`.meta-row`) | `on-surface-variant` | | | label-md, numbers tabular |
| Sync error (`.meta-error` for `lastError`) | `error` | | | |
| Failed import (`lastImport.status === "failed"`) | `secondary` (rose, a warning) | | | |
| Pending uploads, import in progress (`.meta-pending`) | `tertiary` (neutral attention, like the website's "processing") | | | |
| Import completed (`.meta-done`) | `primary` (done, like the website's "completed") | | | |
| Inline links (`.link`) | `primary`, underlined | | | label-md weight |
| "Recent episodes" (`h2.section-title`) | `on-surface-variant` | | sentence case, no uppercase, no letter spacing | display, label-md size and line, 700 |
| Date range (`.section-note`) | `outline` | | | label-sm size and line, tabular |
| Episode row (`.episode`) | | `surface-container-low` | `radius-lg`, no border | |
| Thumbnail (`.thumb`) | | `surface-container-high` | `radius-sm`, inset `rgb(0 0 0 / 0.4)` edge | |
| Watched bar (`.watched`) | | `primary`, solid | | |
| Series title (`.series`) | `on-surface` | | | body-md, 700 |
| Episode meta (`.episode-meta`) | `on-surface-variant` | | | label-md, tabular |
| Status synced (`.entry-synced`) | `primary` | | | 700 |
| Status waiting (`.entry-pending`) | `tertiary` | | | 700 |
| Status stored (`.entry-stored`) | `on-surface-variant` | | | 700 |
| Notice (`.notice`) / error (`.notice-error`) | `on-surface-variant` / `error` | | | label-md |
| Footer (`.bottom`) | | | top 1px solid `outline-variant` | |
| Web links (`.web-link`) | `primary`; hover `primary-fixed`, underlined | | | label-md size, 700 |
| Clear confirm text (`.confirm-text`) | `on-surface` | | | label-md |
| Cancel (`.small-button`) | `on-surface` | transparent; hover `surface-container-high` | `--border-ghost`, full radius, min 36px | label-md size, 700 |
| Clear confirm (`.small-button.danger`) | `on-error` | `error`; hover the same | no border, full radius | label-md size, 700 |

## Options page (`src/components/Settings.svelte`)

| Element | Text | Background | Border / shape | Font |
|---|---|---|---|---|
| Title (`h1`) | `on-surface` | | | display, headline-md tokens |
| Field label (`.label`) | `on-surface-variant` | | | label-md |
| Input | `on-surface`; placeholder `outline`; caret `primary` | `surface-container` | 1px `outline` (hover `on-surface-variant`), `radius-default`; focus: `primary` border plus 1px `primary` ring (2px amber in total) | URL and key: mono |
| Show/hide key (`.reveal`) | `on-surface-variant`; pressed `primary`; hover `on-surface` | hover `surface-container-high` | full radius | |
| Hint (`.hint`) | `on-surface-variant` | | | label-md |
| Text buttons (`.link`: "Use default", "Connect extension") | `primary`; hover `primary-fixed` | | | label-md |
| Save (primary button) | `on-primary` | `primary`; hover `primary-fixed` and `--glow-primary` | full radius | 700 |
| Save, disabled | `on-surface-variant` | `surface-container-highest` | | |
| Result, success / error | `primary` / `error` | | | label-md |

## Both pages (`src/styles/base.css`)

- Fonts: `@fontsource-variable/figtree/wght.css`, `@fontsource/bricolage-grotesque/700.css` and
  `800.css`, and `@fontsource/ibm-plex-mono/500.css`. Nothing else, and nothing remote.
- `h1, h2, h3 { font-family: var(--font-display); }`
- `body`: `font-variant-numeric: tabular-nums`.
- `::selection`: `primary` @ 30% background, `on-surface` text.
- `:focus-visible`: 2px solid `primary` outline with a 2px offset (unchanged).
- Reduced motion: the global rule stays as it is. The popup hides the running sweep segment, and
  the static top line still shows the scrape is running.

## Must not change

Markup and behaviour stay the same, except removing the mark's tile and adding whatever element
the running indicator needs. Every `t(...)` key, ARIA attribute and live region, and all scripts,
stay as they are. No locale strings change.

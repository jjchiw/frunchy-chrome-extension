# Data model: the extension's shared design tokens

This feature stores no data. Its one entity is the token list in `src/styles/tokens.css`, which the
backend's `DesignSystemTests` reads. Each value must equal `Theme.fs` byte for byte (research R1),
except `--font-family`.

## Final token list

| Token | Value | Status | Used by |
|---|---|---|---|
| `--color-surface` | `#13111a` | changed | page background |
| `--color-surface-container-low` | `#1a1722` | changed | main card, episode rows |
| `--color-surface-container` | `#1e1a27` | **added** | options page inputs, ghost-button hover |
| `--color-surface-container-high` | `#2a2435` | changed | thumbnail placeholder, secondary/reveal hover |
| `--color-surface-container-highest` | `#352e42` | changed | disabled main button, scrollbar |
| `--color-on-surface` | `#f1ece4` | changed | text |
| `--color-on-surface-variant` | `#d2cabe` | changed | secondary text, icon buttons, stored status |
| `--color-outline` | `#9b9286` | changed | date range note, placeholders, field borders, sync-off dot |
| `--color-outline-variant` | `#4a4255` | changed | footer divider, disabled icon buttons |
| `--color-primary` | `#ffb547` | changed | main action, links, synced, watched bar, focus ring |
| `--color-on-primary` | `#2a1700` | changed | text on amber |
| `--color-primary-fixed` | `#ffd08a` | changed | primary hover, link hover, the running sweep |
| `--color-secondary` | `#ff6fa8` | changed | failed import only |
| `--color-tertiary` | `#c9bcff` | **added** | profile pill, pending uploads, waiting status |
| `--color-error` | `#ff9b85` | changed | errors, clear confirm fill |
| `--color-on-error` | `#4a0b00` | **added** | text on the clear confirm |
| `--font-family` | `"Figtree Variable", system-ui, sans-serif` | changed (not checked) | text |
| `--font-display` | `"Bricolage Grotesque", "Figtree", system-ui, sans-serif` | **added** | wordmark, `h1`/`h2` |
| `--font-mono` | `"IBM Plex Mono", ui-monospace, monospace` | changed | backend URL, sync key |
| `--text-headline-md-size` | `20px` | unchanged | |
| `--text-headline-md-line` | `28px` | unchanged | |
| `--text-headline-md-weight` | `700` | **added** | main card title, options page title |
| `--text-headline-md-tracking` | `-0.015em` | changed | |
| `--text-body-lg-size` | `16px` | unchanged | main button |
| `--text-body-md-size` | `14px` | unchanged | |
| `--text-body-md-line` | `20px` | unchanged | |
| `--text-label-md-size` | `13px` | unchanged | |
| `--text-label-md-line` | `18px` | unchanged | |
| `--text-label-md-weight` | `600` | unchanged | |
| `--text-label-md-tracking` | `0.01em` | unchanged | |
| `--text-label-sm-size` | `11px` | unchanged | date range note |
| `--text-label-sm-line` | `14px` | unchanged | date range note |
| `--radius-sm` | `0.375rem` | changed | thumbnails |
| `--radius-default` | `0.75rem` | changed | inputs |
| `--radius-lg` | `1.25rem` | changed | cards |
| `--radius-full` | `9999px` | unchanged | buttons, icon buttons, pills, dots |
| `--space-xs`, `-sm`, `-md`, `-lg` | `0.25rem`, `0.5rem`, `1rem`, `1.5rem` | unchanged | |
| `--border-ghost` | `1px solid rgb(241 236 228 / 0.14)` | changed | secondary button |
| `--glow-primary` | `0 4px 20px -4px rgb(255 181 71 / 0.45)` | changed | primary button hover |

**Removed** (no longer used; research R3): `--color-error-container`, `--color-on-error-container`,
`--text-label-sm-weight`, `--text-label-sm-tracking`, `--radius-md`, `--border-micro`,
`--edge-highlight`, `--shadow-level-2`.

## Validation rules

- Every name except `--font-family` exists in `Theme.fs` with the identical value (SC-001).
- Every token in the table is referenced at least once in `src/` (the rule that the extension
  lists only what it uses). A grep confirms it after implementation.
- No `#rrggbb` or `rgb(r g b …)` colour of the old palette remains in `src/` (SC-006). The neutral
  `rgb(0 0 0 / 0.4)` thumbnail edge is the only colour literal left outside `tokens.css`, apart from
  tints derived with `rgb(from var(--…) …)`.

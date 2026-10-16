# Research: Night Broadcast design system in the extension

Sources: the backend contract `FrunchyBackend/specs/010-night-broadcast/contracts/design-system.md`
(with its Clarifications), `design/night_broadcast/DESIGN.md`, `Views/Theme.fs` (values and the
website's component CSS) and `tests/FrunchyBackend.Tests/DesignSystemTests.fs`, all on branch
`010-night-broadcast` (read from the backend's `.claude/worktrees/009-episode-comments` worktree on
2026-10-15).

## R1. How the parity check compares values

- **Decision**: Write every shared token in `src/styles/tokens.css` as `--name: value;` with the
  value byte-identical to `Theme.fs`: same quotes, spaces and case. Don't write `--x: y;` inside a
  comment either.
- **Rationale**: The test pulls every `(--[a-z0-9-]+)\s*:\s*([^;]+);` match from the whole file,
  comments included, trims each value, and compares the strings exactly. Only `--font-family` is
  skipped, and every other name must exist on the website.
- **Alternatives considered**: None. The test defines the format.

## R2. Font packages and family names

- **Decision**:
  - Text: `@fontsource-variable/figtree` (`wght.css`), with
    `--font-family: "Figtree Variable", system-ui, sans-serif`. That's allowed because the test
    skips `--font-family`.
  - Display: `@fontsource/bricolage-grotesque` static weights `700.css` (headings) and `800.css`
    (wordmark). They register the family `'Bricolage Grotesque'`, so `--font-display` can be the
    contract string unchanged: `"Bricolage Grotesque", "Figtree", system-ui, sans-serif`.
  - Mono: `@fontsource/ibm-plex-mono` `500.css`, which registers `'IBM Plex Mono'` and matches
    `--font-mono` unchanged. The website loads 500 and 600; the extension only needs 500.
  - Remove `@fontsource-variable/plus-jakarta-sans` and `@fontsource/jetbrains-mono`.
- **Rationale**: Only `--font-family` may differ from the website. `@fontsource-variable/bricolage-grotesque`
  registers `'Bricolage Grotesque Variable'`, which `--font-display` doesn't name, so headings
  would silently fall back to Figtree. The static package registers the exact name.
- **Alternatives considered**:
  - The variable package with its optical-size axis (`opsz.css`, about 77 KB for Latin), re-declared
    under our own `@font-face { font-family: "Bricolage Grotesque" }`. It's closer to the
    website, which has `opsz` 12–96 from Google Fonts, but it duplicates the package's
    `unicode-range` blocks in our CSS. At the popup's 20px heading size, optical sizing changes
    little. Rejected for now; revisit if a side-by-side review shows a difference.
  - Adding `"Bricolage Grotesque Variable"` to `--font-display`: fails the parity check.

## R3. Which tokens the extension defines

The extension lists only the tokens it uses (CLAUDE.md, contract). After this feature:

- **Added**:
  - `--font-display`
  - `--text-headline-md-weight: 700` (the popup hard-codes 700 today)
  - `--color-tertiary` (lilac: profile pill, waiting states)
  - `--color-on-error: #4a0b00` (a website-only token; the clear confirm becomes the website's
    destructive button)
  - `--color-surface-container` (the options page's inputs, as on the website's `.fr-input`)
- **Dropped**, because nothing uses them any more (the backend agreed on 2026-10-15):
  - `--border-micro`, `--edge-highlight` and `--shadow-level-2`: cards have no border or shadow.
  - `--color-error-container` and `--color-on-error-container`: the destructive button is solid
    coral now.
  - `--radius-md`: episode rows move to `--radius-lg`.
  - `--text-label-sm-weight` and `--text-label-sm-tracking`: the uppercase "Recent" heading goes.
- **Kept**: all other current names with new values. `data-model.md` has the full list.
- **Rationale**: Any token defined but unused is noise, and so is any value hard-coded where a
  token exists.

## R4. Colour roles, element by element

- **Decision**: Use the mapping in `contracts/popup-ui.md`. In short:
  - Amber for the main action (stop included), links, synced, the sync-on dot and the watched bar.
  - Lilac for the profile pill, pending uploads and the "waiting" episode status.
  - Rose only for a failed import.
  - Coral for sync errors, error notices, the sync-issue status, the options page's failed check,
    and the clear confirm (solid coral, `on-error` text).
- **Rationale**: Contract Clarifications 2 and 3, and backend commit `8d9605b` (a failed import is
  rose). The website's `.fr-btn-destructive` is `bg-error text-on-error`.
- **Alternatives considered**: Keeping the clear confirm on `error-container`. It passes contrast
  (7.1:1), but it would differ from the website's destructive button.

## R5. Removing the gradients

- **Decision**:
  - The main card's background becomes solid `surface-container-low`.
  - The running indicator becomes a solid 2px amber line across the card's top edge, which is
    visible with or without motion.
  - On top of that line, a short solid `primary-fixed` segment (about 30% wide) sweeps from left
    to right, and it's hidden under `prefers-reduced-motion`.
- **Rationale**: FR-012 and FR-018. Today's sweep is a `transparent → primary → transparent`
  gradient. Under `base.css`'s reduced-motion rule, it jumps to its end position and stops
  showing anything.
- **Alternatives considered**: A pulsing card border: borders on cards are gone. Only the button
  changing to Stop: too weak as the only signal while a scrape runs.

## R6. Shapes and component styles, matched to the website's CSS (`Theme.fs`)

| Website class | Website style | Popup or options element |
|---|---|---|
| `.fr-card` | `surface-container-low`, `radius-lg`, no border or shadow | Main card, episode rows |
| `.fr-btn-primary` | full radius, `primary`/`on-primary`, hover `primary-fixed` and `--glow-primary` | Main button, options page "Save" |
| `.fr-btn-secondary` | full radius, transparent, `on-surface`, `--border-ghost`, hover `surface-container-high` | Footer "Cancel" (`.small-button`) |
| `.fr-btn-ghost` | `on-surface-variant`, hover `on-surface` on `surface-container` | Icon buttons (now full radius) |
| `.fr-btn-destructive` | full radius, `error`/`on-error` | Clear confirm (`.danger`) |
| `.fr-pill-tertiary` | full radius, `tertiary` text, `tertiary` at 14% background, 25% border | Profile pill |
| `.fr-input` | `radius-default`, `surface-container`, 1px `outline` border, focus `primary` border | Options page fields |
| brand | 32px mark, no tile, `font-display` 800, tracking-tight (-0.025em) | Popup header |
| `h1, h2, h3` | `font-display` | Wordmark, main card title, "Recent episodes", options page title |
| `body` | `font-variant-numeric: tabular-nums` | `base.css` body |
| `::selection` | `rgb(255 181 71 / 0.3)`, `on-surface` | `base.css` |

- "Recent episodes" stays small, as an `h2` in `font-display`, label-md size and line height,
  weight 700, `on-surface-variant`, and sentence case. The website's section title is headline-md
  (28px line), but in the popup that would add about 14px to a layout already at 598 of 600px.
- Tints are written as `rgb(from var(--color-…) r g b / a)` (Chrome 119+, and the extension
  targets current Chrome). The website uses Tailwind's `primary/10` for the same thing.
- The footer divider becomes `1px solid var(--color-outline-variant)`, a token. The thumbnail's
  `inset 0 0 0 1px rgb(0 0 0 / 0.4)` is neutral black, not a palette colour, so it stays.

## R7. Measuring the popup height (FR-017, SC-003)

- **Decision**: Use a throwaway harness kept outside the repository, under the job's tmp
  directory:
  1. A Vite root that stubs `globalThis.chrome` (`i18n.getMessage` from the real
     `public/_locales/es/messages.json`, `storage.local` from a fixture, plus `tabs.query`,
     `tabs.sendMessage`, `runtime.sendMessage` and the `onChanged`/`onUpdated` listeners).
  2. It mounts `src/components/Popup.svelte` into a 380px window.
  3. Headless Chrome (`/Applications/Google Chrome.app`, `--headless=new --window-size=380,800
     --virtual-time-budget=5000 --dump-dom`) loads it, and a script writes
     `document.documentElement.scrollHeight` into the DOM. A screenshot is taken too.
  4. It runs for the tallest state (Spanish: the tab needs a reload, a sync error, 3 pages
     waiting, an import line, 3 recent episodes and the footer) and for the plain English "ready"
     state.
- **Rationale**: Nothing records how the original 598px was measured. The popup only needs the
  `tabs`, `storage`, `runtime` and `i18n` APIs, which are easy to stub. Real Chrome renders the
  real fonts.
- **Alternatives considered**: Loading the unpacked extension in the owner's Chrome. That needs
  manual steps, and its screenshots would show real watch history, which can't be committed.

## R8. Mark and toolbar icons

- **Decision**:
  - Copy `design/brand/frunchy-mark.svg` from the backend's 010 branch unchanged into
    `src/assets/brand/frunchy-mark.svg`.
  - In `frunchy-icon.svg`, change the tile fill from `#0f131c` to `#13111a`, and update its
    comment.
  - Re-render `src/assets/icons/frunchy{16,32,48,128}.png` with
    `rsvg-convert -w N -h N frunchy-icon.svg`, run from `src/assets/brand/`
    (`/opt/homebrew/bin/rsvg-convert` is installed).
- **Rationale**: FR-019, using the existing documented process.

## R9. Contrast verification (FR-015, SC-002)

- **Decision**: A one-off script outside the repository applies the WCAG 2.1 formula. It covers
  each foreground/background pair in `contracts/popup-ui.md`, compositing the alpha tints over
  their real background, and checks field borders against 3:1. All pairs computed during
  planning pass; the lowest are rose on a 14% rose tint at about 5.6:1 and `outline` on
  `surface-container` at 5.56:1.
- **Rationale**: The repository has no test runner (CLAUDE.md). The backend's own contrast test
  covers the token pairs, but not the extension's tinted compositions.

## R10. Documentation (FR-021)

- **Decision**: Update CLAUDE.md, PRODUCT.md and the popup's design brief:
  - CLAUDE.md: its "Fonts and icons are bundled" bullet names Figtree, Bricolage Grotesque and
    IBM Plex Mono; its icon bullet names the `#13111a` tile; its Design paragraph names Night
    Broadcast and the colour roles.
  - PRODUCT.md: name Night Broadcast.
  - `.impeccable/surfaces/src-components-popup-svelte.md`: name Night Broadcast, the roles, and
    the 598px re-measurement.
- **Rationale**: Future sessions read these first. Stale font names would send them to removed
  packages.

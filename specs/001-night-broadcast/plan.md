# Implementation Plan: Night Broadcast design system in the extension

**Branch**: `001-night-broadcast` | **Date**: 2026-10-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-night-broadcast/spec.md`

## Summary

Move the extension to the backend's Night Broadcast design system (FrunchyBackend feature 010).
The work has four parts:
- Rewrite `src/styles/tokens.css` with the contract's values, so the backend's parity test passes
  again.
- Swap the bundled fonts for Figtree, Bricolage Grotesque and IBM Plex Mono.
- Restyle the popup and options page following the element-by-element mapping in
  [contracts/popup-ui.md](contracts/popup-ui.md): solid fills, rounded controls, cards with no
  border, the agreed colour roles, and a sentence-case section heading.
- Recolour the mark and re-render the toolbar icons.

No behaviour, strings or data change. Most of the risk is in two constraints: the parity test's
exact string comparison, and the popup's 600px height limit.

## Technical Context

**Language/Version**: TypeScript 6 (strict, `verbatimModuleSyntax`), Svelte 5 runes, CSS (Chrome's
relative colour syntax `rgb(from …)`, Chrome 119+)

**Primary Dependencies**: Vite 8, `@crxjs/vite-plugin` 2.7. The fonts change:
- add `@fontsource-variable/figtree`, `@fontsource/bricolage-grotesque` and
  `@fontsource/ibm-plex-mono` (all 5.3.0);
- remove `@fontsource-variable/plus-jakarta-sans` and `@fontsource/jetbrains-mono`.

**Storage**: N/A (no stored data changes)

**Testing**: No test suite. Checks:
- `npm run build` and `npm run check`;
- a token parity comparison against `Theme.fs` and a WCAG contrast script, both one-off and kept
  outside the repository;
- the popup height measured with a headless Chrome harness (research R7);
- a manual check of the unpacked extension (quickstart §7).

**Target Platform**: Chrome (Manifest V3), current stable

**Project Type**: Browser extension (popup, options page, content scripts, service worker). Only
the two UI pages and the assets change.

**Performance Goals**: The popup renders its fonts on first paint with no network requests. The
built extension stays under 1 MB (today about 356 KB).

**Constraints**:
- The popup is 380px wide and at most 600px tall in every state, in both languages. The tallest
  state measured 598px before this change.
- WCAG 2.1 AA on every pair.
- `tokens.css` values must be byte-identical to `Theme.fs`.
- No gradients.

**Scale/Scope**: 2 Svelte components (`Popup.svelte` about 940 lines, `Settings.svelte` about 300
lines), 2 stylesheets, 2 SVGs, 4 PNGs and 3 docs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template, so it defines no gates. The
project rules in CLAUDE.md act as the gates instead:

| Rule (CLAUDE.md) | Status |
|---|---|
| Token names and values match `Theme.fs`; tell the backend before changing one | Pass: the values come from the contract, and the backend is informed and agreed to the dropped tokens |
| Fonts and icons are bundled, never loaded remotely | Pass: Fontsource packages (research R2) |
| The popup fits 600px, Spanish included; re-check the tallest state | Planned: measured with the harness (R7, quickstart §5) |
| Show only data the extension really has | Pass: no content changes |
| Import with the `src/...` alias; type-only imports use `type` | Pass: no new TS modules |
| Review screenshots stay out of the repository | Pass: the harness and its screenshots live in the job's tmp directory |

Re-check after design: all pass. Nothing needs justifying.

## Project Structure

### Documentation (this feature)

```text
specs/001-night-broadcast/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R10: parity format, fonts, tokens, roles, gradients, shapes, height, icons, contrast, docs
├── data-model.md        # the final token list
├── quickstart.md        # validation steps
├── contracts/
│   └── popup-ui.md      # element → colour, shape and font mapping
├── checklists/
│   └── requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
package.json, package-lock.json         # font dependencies swapped
src/styles/tokens.css                   # new values, added and dropped tokens (data-model.md)
src/styles/base.css                     # font imports, h1–h3 display font, tabular-nums, selection
src/components/Popup.svelte             # styles per contracts/popup-ui.md; mark without its tile; running indicator
src/components/Settings.svelte          # styles per contracts/popup-ui.md
src/assets/brand/frunchy-mark.svg       # copied from the backend's 010 branch
src/assets/brand/frunchy-icon.svg       # tile #13111a
src/assets/icons/frunchy{16,32,48,128}.png   # re-rendered
CLAUDE.md, PRODUCT.md, .impeccable/surfaces/src-components-popup-svelte.md   # docs (R10)
```

**Structure Decision**: Existing single-project layout. No new source files. The measurement
harness is temporary and lives outside the repository.

## Implementation order

1. **Tokens and fonts** (User Story 1): `tokens.css`, `base.css` and `package.json`. After this
   step the parity check can pass, and the backend can be told.
2. **Popup** (User Story 2): `Popup.svelte` styles, the mark without its tile, the running
   indicator, then the height measurement.
3. **Options page** (User Story 3): `Settings.svelte`.
4. **Mark and icons** (User Story 4): copy the SVG, change the tile colour, re-render the PNGs.
5. **Docs and final checks**: CLAUDE.md, PRODUCT.md, the design brief, then quickstart §1–§6.

Step 1 alone breaks nothing visually, because the components still reference existing names.
Dropped tokens must lose their last use before they are removed, so in step 1 keep the tokens
that are to be dropped. Remove them in step 5 once a grep shows they're unused.

## Complexity Tracking

No violations.

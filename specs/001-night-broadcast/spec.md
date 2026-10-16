# Feature Specification: Night Broadcast design system in the extension

**Feature Branch**: `001-night-broadcast`

**Created**: 2026-10-15

**Status**: Draft

**Input**: User description: "The website's shared design system moved to Night Broadcast (FrunchyBackend feature 010). Move the extension's popup, options page, brand mark and toolbar icons to it, so both sides share the same tokens again and the backend's shared-token check passes."

**Contract**: FrunchyBackend `specs/010-night-broadcast/contracts/design-system.md`, including its "Clarifications" section agreed with this extension on 2026-10-15. Design doc: FrunchyBackend `design/night_broadcast/DESIGN.md`. Both are on the backend branch `010-night-broadcast` (not merged yet). Where this spec and the contract differ, the contract wins.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Shared tokens match the website again (Priority: P1)

The extension and the website share one set of design tokens, and the backend has a test that compares them. Since the website moved to Night Broadcast, that test fails in the owner's checkout, where both repositories sit side by side. After this story, every token the extension defines has the website's value again.

**Why this priority**: A failing test in the owner's main checkout blocks the backend from merging feature 010 with a green suite. It is also the base that every other story builds on.

**Independent Test**: Run the backend's `DesignSystemTests` from a checkout with this extension beside it. It passes with no token mismatches.

**Acceptance Scenarios**:

1. **Given** the extension's shared tokens, **When** the backend's shared-token check runs, **Then** every token the extension defines, except the text font family, exists on the website with the same value.
2. **Given** the contract adds a display font token and sets the headline weight, **When** the extension needs them, **Then** it defines them under the contract's names and values, and it uses no hard-coded value where a shared token exists.

---

### User Story 2 - The popup looks like the website (Priority: P1)

A user who opens the popup after using the website sees the same product: the same dark violet-black page, warm paper-coloured text, amber for their own action, and the same fonts and shapes. Each colour means what it means on the website.

**Why this priority**: The popup is the extension's main screen and the user's daily entry point. Today it still shows the old cyan palette while the website does not.

**Independent Test**: Load the built extension, open the popup in every state (no sync key, ready to scrape, scraping, the tab needs a reload, a sync error, pages waiting, an import in progress, completed or failed, the inline clear confirm), in English and in Spanish, and compare it with the website and the contract.

**Acceptance Scenarios**:

1. **Given** the popup in any state, **When** it is shown, **Then** its surfaces, text, accent colours, fonts and corner shapes come from the Night Broadcast tokens, and no colour of the old palette remains.
2. **Given** a Crunchyroll profile is known, **When** the popup shows the profile pill, **Then** the pill is a lilac tag, so amber stays with the main button.
3. **Given** pages are waiting to upload, **When** the popup shows the pending line and the episodes' "waiting" status, **Then** both are lilac. Synced episodes are amber and stored-only episodes use the secondary text colour.
4. **Given** the extension's own request to the backend failed (a sync error, an error notice), **When** it is shown, **Then** it is coral, never rose.
5. **Given** the backend reports the last import as failed, **When** the popup shows it, **Then** it is rose, as a warning, like the same status on the website's account page.
6. **Given** a scrape is running, **When** the main card shows that it is busy, **Then** the indicator uses solid fills only, and with reduced motion the card still shows that a scrape is running.
7. **Given** the popup's list of recent episodes, **When** its heading is shown, **Then** it reads in sentence case, as written in the locale files, not uppercase and tracked.

---

### User Story 3 - The options page matches (Priority: P2)

The options page, where the user enters the backend URL and sync key, follows the same system as the popup.

**Why this priority**: Users open it once to connect and again only when something breaks, so it matters less than the popup. It still has to look like the same product.

**Independent Test**: Open the options page with no settings, with a valid key, with an invalid key and with the key shown, and compare it with the contract.

**Acceptance Scenarios**:

1. **Given** the options page, **When** it is shown, **Then** its heading uses the display font, its buttons are fully rounded, and the backend URL and the sync key use the monospace font.
2. **Given** a text field, **When** it is shown at rest, **Then** its border is visible against its background (at least 3:1). **When** it has focus, **Then** it shows the amber focus treatment.
3. **Given** a successful or failed check, **When** its result is shown, **Then** success is amber and failure is coral.

---

### User Story 4 - The brand mark and toolbar icons take the new colours (Priority: P3)

The clapperboard-and-bars mark in the popup header and the extension's toolbar icon use the Night Broadcast colours, so the icon in Chrome's toolbar matches the website's favicon.

**Why this priority**: It is visible on every page, but the old icon still works and stays recognisable.

**Independent Test**: Load the built extension and look at the toolbar icon on a light and a dark Chrome toolbar, the icon on `chrome://extensions`, and the mark in the popup header.

**Acceptance Scenarios**:

1. **Given** the backend's updated mark, **When** the extension is built, **Then** the popup header and the 16, 32, 48 and 128 px icons show the same shape in its new colours (amber arm and frame, darker amber middle bars, rose last bar) on a `#13111a` tile.
2. **Given** a light Chrome toolbar, **When** the 16 px icon is shown, **Then** the mark stays visible. The clapper's cut lines may blur at that size, as they do today.

---

### Edge Cases

- **The tallest popup state**: a tab that needs a reload, a sync error, pages waiting and an import line, in Spanish, measures 598 of the 600 px Chrome allows. New fonts change text widths, so a line that wraps differently can push it past 600 px. That state must be measured again.
- **Long text in narrow places**: a long Crunchyroll profile name in the pill, a long series title, and the main card's title in the wider display font still truncate or wrap without overlapping the button or the pill.
- **Characters outside the bundled fonts**: series titles and profile names can contain Japanese or other scripts. They fall back to system fonts and stay readable.
- **Focus on amber**: the amber focus ring must stay visible around the amber main button, and on every other control.
- **Disabled controls**: the main button while the tab is being checked, and disabled icon buttons, still look disabled, not like a different action.
- **Hover states**: the main button's hover, link hover and secondary-button hover use Night Broadcast colours, and no old cyan tint is left in any state.
- **Text selection**: selected text in the popup and options page uses the website's selection colour.
- **Offline**: when the popup or options page opens with no network, fonts and icons still render, because nothing is loaded remotely.

## Requirements *(mandatory)*

### Functional Requirements

**Shared tokens**

- **FR-001**: Every design token the extension defines MUST have the contract's value for that name. The text font family is the only exception: it MAY name the bundled variable family.
- **FR-002**: The extension MUST define only tokens the website also defines, keep every existing token name, and list only tokens it uses. A token the extension starts using MUST take its name and value from the website.
- **FR-003**: The extension MUST define the new display font token for headings and the wordmark, and the headline weight and tracking from the contract.
- **FR-004**: Colours that are tints of a token (a transparent amber, lilac or rose) MUST be derived from that token, not written as fixed colour values. There are no tint tokens.

**Fonts**

- **FR-005**: Body text MUST use Figtree, headings and the wordmark MUST use Bricolage Grotesque, and keys, URLs and usernames MUST use IBM Plex Mono.
- **FR-006**: Numbers inside localized sentences (pages waiting, import counts, date ranges) MUST stay in the text font with tabular figures. The popup has no standalone figures.
- **FR-007**: All fonts MUST ship inside the extension. Opening the popup or options page MUST NOT load fonts or icons from the network. Fonts the extension no longer uses (Plus Jakarta Sans, JetBrains Mono) MUST be removed from the bundle.

**Colour roles**

- **FR-008**: Amber MUST mark the primary action (the main button, including its stop state), links, the synced status and the "sync is on" indicator.
- **FR-009**: Lilac MUST mark the user's Crunchyroll profile pill and neutral attention states that are not warnings: pages waiting to upload, and the "waiting" episode status.
- **FR-010**: Rose MUST be used only for real warnings. In the popup that is only a failed import reported by the backend.
- **FR-011**: Coral MUST mark errors: the extension's sync errors, error notices, the options page's failed check and the destructive clear confirmation. Errors MUST NOT use rose.

**Shapes, fills and labels**

- **FR-012**: Every fill MUST be solid. The main card's background glow and the running scrape's sweeping line MUST NOT use gradients.
- **FR-013**: Buttons, icon buttons and pills MUST be fully rounded. Cards (the main card and each episode row) MUST use the card radius and have no border, as in the design doc.
- **FR-014**: Headings MUST NOT be uppercase and tracked. The recent episodes heading MUST be sentence case. Its locale strings are already sentence case, so no strings change.

**Accessibility and layout**

- **FR-015**: Every text and background pair in the popup and options page, hover and focus states included, MUST meet WCAG 2.1 AA. Text field borders MUST meet 3:1 against their background.
- **FR-016**: Every focusable control MUST show a visible 2 px amber focus ring. Selected text MUST use the contract's selection colour.
- **FR-017**: The popup MUST stay 380 px wide, and every state MUST fit within 600 px without scrolling, in English and in Spanish.
- **FR-018**: Motion MUST keep respecting reduced-motion settings. Without motion, a running scrape MUST still be visible as running.

**Brand**

- **FR-019**: The popup header's mark MUST be the backend's updated mark, copied unchanged. The toolbar icons MUST be rendered from it at 16, 32, 48 and 128 px on a `#13111a` tile.

**Scope**

- **FR-020**: Scraping, storage, sync behaviour, the backend contract and every UI string MUST stay as they are. This feature changes only how the extension looks.
- **FR-021**: The repository's design guidance (the project instructions' design and font notes, the product brief and the popup's design brief) MUST name Night Broadcast and the new fonts instead of the old system.

### Key Entities

- **Shared design token**: a named value (colour, font, radius, type style, effect) that both the website and the extension define. The website's value is the source of truth, and the backend's test checks that the extension uses the same value.
- **Colour role**: the meaning a colour carries in both products: amber for the user and the primary action, lilac for tags and neutral attention, rose for warnings and spoilers, coral for errors.
- **Brand mark**: the clapperboard-and-bars symbol, shared with the website, used in the popup header and as the extension icon.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The backend's shared-token check passes against this extension with 0 mismatched tokens.
- **SC-002**: 100% of text and background pairs in the popup and options page meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text and field borders), measured on the final values.
- **SC-003**: All popup states listed in User Story 2 fit within 600 px in both languages, with the tallest state measured and recorded.
- **SC-004**: With the network turned off, the popup and options page render with their bundled fonts and icons, and make no font or icon requests.
- **SC-005**: For each fact the popup and website both show (synced, waiting or processing, failed import, error, the user's own profile), a side-by-side review finds the same colour role on both, with 0 differences.
- **SC-006**: No colour from the old palette (the cyan, blue-violet and pink accents and the blue-grey surfaces) remains anywhere in the built extension.
- **SC-007**: The built extension stays under 1 MB, so the new fonts don't noticeably slow installs or updates.

## Assumptions

- The contract and its Clarifications section are final for this work. The backend's `Views/Theme.fs` is the source of truth for any value the contract doesn't list. The visual pitch (row 2 of the owner's private canvas) isn't required; the owner can supply screenshots if a detail is unclear.
- The backend's branch `010-night-broadcast` isn't merged yet. The mark is copied from that branch, and this feature can merge before or after it. Until both land, the shared-token check fails in the owner's checkout, which is expected.
- A failed import is shown as rose, to match the website's account page (backend commit `8d9605b`). The extension's own request errors stay coral. If the backend changes that rule, the popup follows it.
- The bundled fonts cover Latin text, including Spanish. Other scripts fall back to system fonts, as they do today.
- The new fonts only change text widths, not type sizes or line heights. So the popup's height can change only where a line wraps differently.
- The design tokens the extension stops using (for example, borders and the top-edge highlight once cards have no border) are removed from its list, not kept with old values.
- The old version of the extension icon isn't kept; the new icon replaces it.

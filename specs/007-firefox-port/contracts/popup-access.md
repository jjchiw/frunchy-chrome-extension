# Contract: the popup's access check

Applies to both browsers. Only the main card changes. The header, sync line, recent episodes and
footer stay as they are.

## Order of checks when the popup opens (and on `chrome.permissions.onAdded` / `onRemoved`)

1. **Access**: `chrome.permissions.contains({ origins })` for:
   - `https://www.crunchyroll.com/*`, always;
   - `<backend origin>/*`, only when a sync key is set (`isConfigured(settings)`).

   If any is missing, the main card is in the **access** state, and steps 2–3 are skipped (without
   access the tab's URL isn't readable).
2. **Private window**: the active tab is `incognito` and `chrome.extension.isAllowedIncognitoAccess()`
   is false → **private** state.
3. **Tab**: today's `checking` / `other` / `reload` / `ready`, unchanged. On Firefox for Android,
   if the active tab is the extension's own page, use the most recently accessed
   `https://www.crunchyroll.com/*` tab instead (R5.2).

## States added to `TabState`

| State | Title | Text | Button |
|---|---|---|---|
| `access` (Crunchyroll missing) | `hero_access_title`: "Allow Frunchy on Crunchyroll" | `hero_access_text`: Frunchy reads your history on crunchyroll.com and needs your browser's permission for that site. | `allow_access` (icon `lock_open`): asks for every missing origin at once |
| `access` (only the server missing) | `hero_access_server_title`: "Allow Frunchy to reach your server" | `hero_access_server_text`: uploads to <host> are blocked until you allow it. | same button |
| `private` | `hero_private_title`: "Not available in private windows" | `hero_private_text`: allow Frunchy in private windows in your browser's add-on settings, or use a normal window. | none |

The wording is a draft. The final texts and their Spanish versions are written in the locale files
(`hero_*` keys), and the tallest Spanish state is re-measured within 600 px.

## Button behaviour

- `chrome.permissions.request({ origins: missing })` is called directly in the click handler,
  with no `await` before it (Firefox needs the user gesture).
- Granted → re-run the checks. The existing flow then offers "reload the tab" or Scrape.
- Refused or rejected → the card stays, with no error text. The next click asks again.
- The popup never calls `request` outside a click.

## Invariants

- With all access granted and a normal window, the popup renders exactly as today (SC-005).
- Settings keep their own request for a non-default backend when it's saved (unchanged).

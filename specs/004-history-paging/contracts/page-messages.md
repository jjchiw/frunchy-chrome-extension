# Contract: messages between the content script and the page hook

All messages use `window.postMessage(message, "*")`. Every receiver ignores events whose `source`
isn't `window`. **No message ever carries a header, token or cookie.**

| Direction | `type` | Other fields | Meaning |
|---|---|---|---|
| hook → content | `frunchyroll` | `url`, `responseText` | A watch-history response, from the site or a paged request (existing) |
| hook → content | `frunchyroll-profile` | `source`, `accountId`, `profileId`, `profileName?` | The active profile (existing) |
| content → hook | `frunchyroll-hello` | | Re-send the last profile (existing) |
| content → hook | `frunchyroll-next` | | Request the next history page now (new) |
| hook → content | `frunchyroll-paging` | `state: "end"` | The last response had an empty `next_page`; nothing was requested (new) |
| hook → content | `frunchyroll-paging` | `state: "unavailable"` | No cursor or no sign-in header seen yet; nothing was requested (new) |
| hook → content | `frunchyroll-paging` | `state: "failed"`, `status: number \| "timeout"` | The paged request failed: HTTP status ≥ 400, 0 for a network error, or a timeout after 30 s (new) |

## Rules

- **One answer per request**: each `frunchyroll-next` gets exactly one outcome. Either a page,
  which is a `frunchyroll` message, or one `frunchyroll-paging` message.
- **One request at a time**: a `frunchyroll-next` that arrives while a paged request is in flight
  is ignored.
- **Where requests go**: only to `nextUrl`, which has the same origin as the site's history request
  it came from, and a path containing `/watch-history`.
- **The header**: it's read from the site's own `watch-history` requests, kept in the hook's
  closure, and set on the paged request. It never goes anywhere else.

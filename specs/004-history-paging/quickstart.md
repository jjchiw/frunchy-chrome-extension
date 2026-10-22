# Quickstart: validate reading the history page by page

## 1. Build

```bash
npm run build && npm run check      # 0 errors, 0 warnings
grep -o 'service-worker.ts-[^"]*' dist/service-worker-loader.js
```

## 2. Harness scenarios (research R7, outside the repository)

| Scenario | Expected |
|---|---|
| Happy path, 5 pages | Pages 2–5 requested by paging, no scroll; `RUN_END` reason `end`; paged requests start ≥ 1000 ms apart |
| Marker on page 3 | Page 4 never requested; `RUN_END` `marker` |
| Stop after page 2 | No request after the stop; `RUN_END` `user` |
| No header (the site's request is unsigned) | Paging `unavailable` → scrolls; ends `end` |
| Page 3 answers 500, 401 or 429 | One failed request, no retry; scrolls on; ends `end` |
| Page 3 slow (> 30 s) | `failed` with `timeout`; scrolls on |
| `next_page` pointing at another host | Not followed; scrolls |
| Leak check over all scenarios | `TEST-TOKEN-SECRET-123` appears 0 times in posted messages, `sendMessage` payloads and stored pages |

## 3. Docs

- CLAUDE.md data-flow items 1–2 describe paging, the header rule and the fallback.
- `store/privacy-practices.md` describes the page hook's paging.

## 4. Owner's manual check on crunchyroll.com

1. Build and load `dist/`, and open `https://www.crunchyroll.com/history`.
2. Open DevTools on the Crunchyroll tab, go to the Network tab and filter `watch-history`.
3. Press Scrape.
   - **Paging works**: new `watch-history?…page=N` requests appear about once a second, the page
     doesn't scroll, and the popup count rises quickly.
   - **Paging didn't start**: the page scrolls, as today. Tell Claude, because the site may sign its
     requests differently (research R2).
4. Switch to another tab during the run. It keeps going.

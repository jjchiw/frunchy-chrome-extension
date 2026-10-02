// Scraped watch-history pages live in chrome.storage.local (sync caps items at
// 8 KB). Each page is its own key so adding one doesn't rewrite the others;
// `index` holds small per-page stats so the popup never loads page bodies.

export type HistoryEntry = { id?: string; date_played?: string };

export type HistoryPage = {
  url: string;
  capturedAt: string;
  body: { total?: number; data?: HistoryEntry[]; meta?: unknown };
};

type PageStats = { entries: number; oldest: string | null; newest: string | null };

type PageIndex = Record<string, PageStats>;

export type ScrapeSummary = PageStats & { pages: number };

const pageKey = (url: string) => `page:${url}`;

const statsOf = (page: HistoryPage): PageStats => {
  const dates = (page.body.data ?? [])
    .map((entry) => entry.date_played)
    .filter(Boolean)
    .sort();
  return {
    entries: page.body.data?.length ?? 0,
    oldest: dates[0] ?? null,
    newest: dates[dates.length - 1] ?? null,
  };
};

const getIndex = async (): Promise<PageIndex> =>
  (await chrome.storage.local.get({ index: {} })).index as PageIndex;

// Pages arrive every couple of seconds; chain writes so two can't race on `index`.
let writes: Promise<void> = Promise.resolve();

export const storage = {
  addPage: (page: HistoryPage): Promise<void> =>
    (writes = writes
      .then(async () => {
        const index = await getIndex();
        index[page.url] = statsOf(page);
        await chrome.storage.local.set({ [pageKey(page.url)]: page, index });
      })
      .catch(console.error)),

  getPages: async (): Promise<HistoryPage[]> => {
    const keys = Object.keys(await getIndex()).map(pageKey);
    const stored = await chrome.storage.local.get(keys);
    return keys.map((key) => stored[key] as HistoryPage).filter(Boolean);
  },

  getSummary: async (): Promise<ScrapeSummary> => {
    const stats = Object.values(await getIndex());
    const dates = stats.flatMap((s) => [s.oldest, s.newest]).filter(Boolean).sort();
    return {
      pages: stats.length,
      entries: stats.reduce((sum, s) => sum + s.entries, 0),
      oldest: dates[0] ?? null,
      newest: dates[dates.length - 1] ?? null,
    };
  },

  clear: (): Promise<void> =>
    (writes = writes
      .then(async () => {
        const keys = Object.keys(await getIndex()).map(pageKey);
        await chrome.storage.local.remove([...keys, "index"]);
      })
      .catch(console.error)),
};

// Scraped watch-history pages live in chrome.storage.local (sync caps items at
// 8 KB). Each page is its own key so adding one doesn't rewrite the others;
// `index` holds small per-page stats so the popup never loads page bodies.

// Only the fields the extension reads; bodies are stored and uploaded verbatim.
export type HistoryEntry = {
  id?: string;
  date_played?: string;
  playhead?: number;
  fully_watched?: boolean;
  panel?: {
    title?: string;
    episode_metadata?: { series_title?: string; episode?: string; duration_ms?: number };
    images?: { thumbnail?: { source: string; width: number }[][] };
  };
};

export type RecentEntry = { pageId: string; entry: HistoryEntry };

export type HistoryPage = {
  url: string;
  capturedAt: string;
  // The Crunchyroll profile active when the page was captured. The URL only
  // names the account, and two profiles share it.
  profileId: string | null;
  body: { total?: number; data?: HistoryEntry[]; meta?: unknown };
};

type PageStats = { entries: number; oldest: string | null; newest: string | null };

type PageIndex = Record<string, PageStats>;

export type ScrapeSummary = PageStats & { pages: number };

// Profiles of one account request identical URLs, so the profile is part of the id.
export const pageId = (page: Pick<HistoryPage, "url" | "profileId">) =>
  `${page.profileId ?? "unknown"} ${page.url}`;

const pageKey = (id: string) => `page:${id}`;

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
        const id = pageId(page);
        index[id] = statsOf(page);
        // Drop a copy of the same page stored before its profile was known
        // (older versions keyed pages by URL alone).
        const stale = page.profileId ? [page.url, pageId({ ...page, profileId: null })].filter((key) => key in index) : [];
        for (const key of stale) delete index[key];
        await chrome.storage.local.set({ [pageKey(id)]: page, index });
        if (stale.length) await chrome.storage.local.remove(stale.map(pageKey));
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

  // The newest entries of one Crunchyroll profile (all profiles when null),
  // loading only the pages that hold them.
  getRecent: async (profileId: string | null, limit: number): Promise<RecentEntry[]> => {
    const pages = Object.entries(await getIndex())
      .filter(([id, stats]) => stats.newest && (!profileId || id.startsWith(`${profileId} `)))
      .sort(([, a], [, b]) => b.newest!.localeCompare(a.newest!));
    const recent: RecentEntry[] = [];
    for (const [id, stats] of pages) {
      // Every remaining page is older than the entries already collected.
      if (recent.length >= limit && recent[limit - 1].entry.date_played! >= stats.newest!) break;
      const page = (await chrome.storage.local.get(pageKey(id)))[pageKey(id)] as HistoryPage | undefined;
      for (const entry of page?.body.data ?? []) {
        if (entry.date_played) recent.push({ pageId: id, entry });
      }
      recent.sort((a, b) => b.entry.date_played!.localeCompare(a.entry.date_played!));
    }
    return recent.slice(0, limit);
  },

  clear: (): Promise<void> =>
    (writes = writes
      .then(async () => {
        const keys = Object.keys(await getIndex()).map(pageKey);
        await chrome.storage.local.remove([...keys, "index"]);
      })
      .catch(console.error)),
};

// The last Crunchyroll profile the page-world hook reported, for the popup.
export type CrunchyrollProfile = { profileId: string; profileName: string | null };

export const crunchyrollProfile = {
  get: async (): Promise<CrunchyrollProfile | null> =>
    ((await chrome.storage.local.get("crunchyrollProfile")).crunchyrollProfile as CrunchyrollProfile | undefined) ??
    null,
  set: (profile: CrunchyrollProfile): Promise<void> => chrome.storage.local.set({ crunchyrollProfile: profile }),
};

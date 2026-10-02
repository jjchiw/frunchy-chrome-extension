// Upload queue and sync state, driven by the background service worker.
//
// Each queued page is its own `upload:<url>` key and `uploadQueue` holds the
// retry bookkeeping, mirroring how storage.ts keeps scraped pages. Retries use
// chrome.alarms because the service worker is suspended between events.

import { api, ApiFailure, type ImportCounts, type ImportStatus } from "src/api";
import { getSettings, isConfigured } from "src/settings";
import type { HistoryPage } from "src/storage";

// The newest entry of a scrape that reached the end of the history (or the
// previous marker) without rejections: everything up to it has been sent.
export type Marker = { id: string; datePlayed: string };

export type LastImport = {
  importId: string;
  statusUrl: string;
  acceptedAt: string;
  entriesReceived: number;
  status: ImportStatus["status"];
  counts: ImportCounts | null;
};

export type SyncError = { code: string; message: string; at: string };

export type SyncState = {
  marker: Marker | null;
  lastImport: LastImport | null;
  lastError: SyncError | null;
  lastRejectionAt: string | null;
};

const emptyState: SyncState = {
  marker: null,
  lastImport: null,
  lastError: null,
  lastRejectionAt: null,
};

type QueueItem = { attempts: number; nextAttemptAt: number };
type Queue = Record<string, QueueItem>;

const RETRY_ALARM = "frunchy-upload-retry";
const RETRY_DELAYS_MS = [30, 60, 120, 300, 600, 1800].map((s) => s * 1000);

const uploadKey = (url: string) => `upload:${url}`;

// Serializes read-modify-write cycles within one extension context.
let writes: Promise<unknown> = Promise.resolve();
const serialized = <T>(fn: () => Promise<T>): Promise<T> => {
  const result = writes.then(fn);
  writes = result.catch(console.error);
  return result;
};

export const syncState = {
  get: async (): Promise<SyncState> => ({
    ...emptyState,
    ...((await chrome.storage.local.get("sync")).sync as Partial<SyncState> | undefined),
  }),

  update: (patch: Partial<SyncState>): Promise<void> =>
    serialized(async () => {
      await chrome.storage.local.set({ sync: { ...(await syncState.get()), ...patch } });
    }),
};

const getQueue = async (): Promise<Queue> =>
  ((await chrome.storage.local.get({ uploadQueue: {} })).uploadQueue as Queue);

const updateQueue = (change: (queue: Queue) => void): Promise<void> =>
  serialized(async () => {
    const queue = await getQueue();
    change(queue);
    await chrome.storage.local.set({ uploadQueue: queue });
  });

export const queueSize = async () => Object.keys(await getQueue()).length;

export const newestEntry = (page: HistoryPage): Marker | null => {
  let newest: Marker | null = null;
  for (const entry of page.body.data ?? []) {
    if (entry.id && entry.date_played && (!newest || entry.date_played > newest.datePlayed)) {
      newest = { id: entry.id, datePlayed: entry.date_played };
    }
  }
  return newest;
};

// True once the page reaches entries at or before the marker, i.e. everything
// further down has already been sent.
export const reachesMarker = (page: HistoryPage, marker: Marker | null) =>
  !!marker &&
  (page.body.data ?? []).some((entry) => !!entry.date_played && entry.date_played <= marker.datePlayed);

export const enqueue = (pages: HistoryPage[]): Promise<void> =>
  serialized(async () => {
    const queue = await getQueue();
    const items: Record<string, HistoryPage> = {};
    for (const page of pages) {
      queue[page.url] = { attempts: 0, nextAttemptAt: 0 };
      items[uploadKey(page.url)] = page;
    }
    await chrome.storage.local.set({ ...items, uploadQueue: queue });
  });

const dequeue = async (url: string) => {
  await updateQueue((queue) => delete queue[url]);
  await chrome.storage.local.remove(uploadKey(url));
};

const failureOf = (err: unknown) =>
  err instanceof ApiFailure ? err : new ApiFailure(null, "network", String(err));

// Uploads one queued page. Returns false when the rest of the queue should wait.
const uploadOne = async (url: string): Promise<boolean> => {
  const settings = await getSettings();
  const page = (await chrome.storage.local.get(uploadKey(url)))[uploadKey(url)] as HistoryPage | undefined;
  if (!page) {
    await dequeue(url);
    return true;
  }

  try {
    const accepted = await api.submitImport(settings, { pages: [page] });
    await dequeue(url);
    await syncState.update({
      lastError: null,
      lastImport: {
        importId: accepted.importId,
        statusUrl: accepted.statusUrl,
        acceptedAt: new Date().toISOString(),
        entriesReceived: accepted.entriesReceived,
        status: accepted.status,
        counts: null,
      },
    });
    return true;
  } catch (err) {
    const failure = failureOf(err);
    const now = new Date().toISOString();
    const lastError = { code: failure.code, message: failure.message, at: now };

    if (failure.retryable) {
      await updateQueue((queue) => {
        const item = queue[url];
        if (!item) return;
        item.attempts++;
        item.nextAttemptAt = Date.now() + RETRY_DELAYS_MS[Math.min(item.attempts, RETRY_DELAYS_MS.length) - 1];
      });
      await syncState.update({ lastError });
      return false;
    }

    // A bad key would reject every page: keep the queue and wait for new settings.
    if (failure.code === "unauthorized") {
      await syncState.update({ lastError, lastRejectionAt: now });
      return false;
    }

    // Any other 4xx is final for this page.
    await dequeue(url);
    await syncState.update({ lastError, lastRejectionAt: now });
    return true;
  }
};

const scheduleRetry = async () => {
  const times = Object.values(await getQueue()).map((item) => item.nextAttemptAt);
  if (times.length === 0) {
    await chrome.alarms.clear(RETRY_ALARM);
    return;
  }
  // Alarms can't fire sooner than 30 s.
  await chrome.alarms.create(RETRY_ALARM, { when: Math.max(Math.min(...times), Date.now() + 30_000) });
};

let processing = false;
let rerun = false;

export const processQueue = async (): Promise<void> => {
  if (processing) {
    rerun = true;
    return;
  }
  processing = true;
  try {
    do {
      rerun = false;
      if (!isConfigured(await getSettings())) return;
      if ((await syncState.get()).lastError?.code === "unauthorized") return;

      const due = Object.entries(await getQueue())
        .filter(([, item]) => item.nextAttemptAt <= Date.now())
        .map(([url]) => url);
      for (const url of due) {
        if (!(await uploadOne(url))) break;
      }
    } while (rerun);
    await scheduleRetry();
  } finally {
    processing = false;
  }
};

export const isRetryAlarm = (alarm: chrome.alarms.Alarm) => alarm.name === RETRY_ALARM;

// Called when a scrape ends. Only a scrape that ran to the end of the history
// or to the previous marker, with nothing rejected since the history tab
// loaded, may move the marker forward.
export const finishRun = async (reason: string, newest: Marker | null, sessionStartedAt: string) => {
  if (reason === "user" || !newest) return;
  if (!isConfigured(await getSettings())) return;
  const state = await syncState.get();
  if (state.lastRejectionAt && state.lastRejectionAt >= sessionStartedAt) return;
  if (!state.marker || newest.datePlayed > state.marker.datePlayed) {
    await syncState.update({ marker: newest });
  }
};

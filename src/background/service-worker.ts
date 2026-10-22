import { getSettings, isConfigured } from "src/settings";
import { storage, type HistoryPage } from "src/storage";
import { enqueue, finishRun, isRetryAlarm, processQueue, reachesMarker, syncState } from "src/sync";

// A page intercepted by the content script: keep it locally, queue it for the
// backend when sync is set up, and tell the content script whether scrolling
// can stop because the page reaches already-synced history.
const handleCapturedPage = async (page: HistoryPage) => {
  await storage.addPage(page);
  if (!isConfigured(await getSettings())) return { reachedMarker: false };

  await enqueue([page]);
  processQueue();
  return { reachedMarker: reachesMarker(page, (await syncState.get()).marker) };
};

const syncStoredPages = async () => {
  const pages = await storage.getPages();
  // An explicit resend, e.g. after the backend reset a binding: no dedup.
  const queued = await enqueue(pages, { force: true });
  processQueue();
  return { queued, skipped: pages.length - queued };
};

// The XHR hook must run in the page's world before Crunchyroll's own scripts,
// so it's registered here (world: "MAIN") rather than injected as a <script>
// tag by the content script, which loads too late to see the first token
// response. Registrations persist, so replace any from a previous version.
const HOOK_ID = "frunchy-xhr-hook";
const registerHook = async () => {
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [HOOK_ID] });
  if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [HOOK_ID] });
  await chrome.scripting.registerContentScripts([
    {
      id: HOOK_ID,
      matches: ["https://www.crunchyroll.com/*"],
      js: ["injected.js"],
      runAt: "document_start",
      world: "MAIN",
      persistAcrossSessions: true,
    },
  ]);
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.message) {
    case "PAGE_CAPTURED":
      handleCapturedPage(request.page).then(sendResponse);
      return true;
    case "RUN_END":
      finishRun(request.reason, request.newest, request.sessionStartedAt).then(() => sendResponse({ ok: true }));
      return true;
    case "SYNC_STORED":
      syncStoredPages().then(sendResponse);
      return true;
    case "SETTINGS_CHANGED":
      processQueue();
      return;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (isRetryAlarm(alarm)) processQueue();
});

chrome.runtime.onStartup.addListener(() => {
  registerHook().catch(console.error);
  processQueue();
});
chrome.runtime.onInstalled.addListener(() => {
  registerHook().catch(console.error);
  processQueue();
});

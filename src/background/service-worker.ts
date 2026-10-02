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
  await enqueue(pages);
  processQueue();
  return { queued: pages.length };
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

chrome.runtime.onStartup.addListener(() => processQueue());
chrome.runtime.onInstalled.addListener(() => processQueue());

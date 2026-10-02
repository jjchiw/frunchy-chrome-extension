import type { HistoryPage } from "src/storage";
import { newestEntry, type Marker } from "src/sync";

const s = document.createElement("script");
s.src = chrome.runtime.getURL("src/content/injected.js");
s.onload = function () {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  this.remove();
};
(document.head || document.documentElement).appendChild(s);

// Pages captured since this tab loaded start at the newest history page and
// run contiguously while scrolling, so their newest entry is what a completed
// scrape has synced up to.
const sessionStartedAt = new Date().toISOString();
let sessionNewest: Marker | null = null;

let lastBodyScrollHeight = 0;
let isSameHeightTimes = 0;
let scrollTimer: number | undefined;

// Tell an open popup that scrolling started or stopped. Fails harmlessly when
// no popup is open.
const notifyScrolling = (scrolling: boolean) =>
  chrome.runtime.sendMessage({ message: "SCROLL_STATE", scrolling }).catch(() => undefined);

// reason: "end" (history exhausted), "marker" (reached synced history) or "user".
const stopScrolling = (reason: "end" | "marker" | "user") => {
  if (scrollTimer === undefined) return;
  clearTimeout(scrollTimer);
  scrollTimer = undefined;
  notifyScrolling(false);
  chrome.runtime
    .sendMessage({ message: "RUN_END", reason, newest: sessionNewest, sessionStartedAt })
    .catch(console.error);
};

const scrollDown = () => {
  scrollTimer = window.setTimeout(() => {
    window.scrollTo(0, document.body.scrollHeight);
    if (lastBodyScrollHeight !== document.body.scrollHeight) {
      lastBodyScrollHeight = document.body.scrollHeight;
      isSameHeightTimes = 0;
      scrollDown();
      return;
    }
    if (isSameHeightTimes < 3) {
      isSameHeightTimes++;
      scrollDown();
      return;
    }
    // Page height stopped growing: reached the end of the history.
    stopScrolling("end");
  }, 2000);
};

const startScrolling = () => {
  clearTimeout(scrollTimer);
  lastBodyScrollHeight = 0;
  isSameHeightTimes = 0;
  scrollDown();
  notifyScrolling(true);
};

window.addEventListener(
  "message",
  async (event) => {
    // We only accept messages from ourselves
    if (event.source !== window || event.data?.type !== "frunchyroll") {
      return;
    }
    let body: HistoryPage["body"];
    try {
      body = JSON.parse(event.data.responseText);
    } catch (err) {
      console.error("Frunchy: watch-history response is not JSON", err);
      return;
    }
    const page: HistoryPage = { url: event.data.url, capturedAt: new Date().toISOString(), body };

    const newest = newestEntry(page);
    if (newest && (!sessionNewest || newest.datePlayed > sessionNewest.datePlayed)) {
      sessionNewest = newest;
    }

    const response = await chrome.runtime
      .sendMessage({ message: "PAGE_CAPTURED", page })
      .catch(console.error);
    if (response?.reachedMarker) stopScrolling("marker");
  },
  false
);

// Injected on every Crunchyroll page because it's an SPA: the history page is
// often reached without a full page load, so a /history match would miss it.
const isHistoryPage = () => /\/history\/?$/.test(location.pathname);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.message) {
    case "SCROLL_DOWN":
      if (!isHistoryPage()) {
        sendResponse({ ok: false, error: "not_history_page" });
        return;
      }
      startScrolling();
      sendResponse({ ok: true, scrolling: true });
      return;
    case "SCROLL_STOP":
      stopScrolling("user");
      sendResponse({ ok: true, scrolling: false });
      return;
    case "SCROLL_STATUS":
      sendResponse({ ok: true, scrolling: scrollTimer !== undefined });
      return;
    default:
      sendResponse("pong");
  }
});

import { crunchyrollProfile, type HistoryPage } from "src/storage";
import { newestEntry, type Marker } from "src/sync";

// public/injected.js runs in the page world (registered by the service worker)
// and posts watch-history responses and the active Crunchyroll profile here.
// It also requests the next history page when asked (the sign-in header it
// needs never leaves the page world).

// Pages captured since this tab loaded start at the newest history page and
// run contiguously while paging or scrolling, so their newest entry is what a
// completed scrape has synced up to.
const sessionStartedAt = new Date().toISOString();
let sessionNewest: Marker | null = null;

// A scrape pages through the history one request at a time, at least a second
// apart, and falls back to scrolling when the page hook can't page or a
// request fails.
let mode: "idle" | "paging" | "scrolling" = "idle";
const PAGE_INTERVAL_MS = 1000;
// Longer than the hook's own 30 s request timeout: no answer at all means the
// hook isn't there or is an older one without paging.
const PAGE_ANSWER_TIMEOUT_MS = 40000;
let pagingTimer: number | undefined;
let answerTimer: number | undefined;
// True from asking the hook for a page until its page or reply arrives, so a
// page the site loads by itself doesn't schedule another request.
let pageRequested = false;
let lastRequestAt = 0;

let lastBodyScrollHeight = 0;
let isSameHeightTimes = 0;
let scrollTimer: number | undefined;

// The active Crunchyroll profile, from the token or multiprofile response.
// Pages captured before it's known wait here, since uploads need it.
let profileId: string | null = null;
let waitingForProfile: HistoryPage[] = [];

// Tell an open popup that a scrape started or stopped. Fails harmlessly when
// no popup is open.
const notifyScrolling = (scrolling: boolean) =>
  chrome.runtime.sendMessage({ message: "SCROLL_STATE", scrolling }).catch(() => undefined);

// reason: "end" (history exhausted), "marker" (reached synced history) or "user".
const stopRun = (reason: "end" | "marker" | "user") => {
  if (mode === "idle") return;
  clearTimeout(pagingTimer);
  clearTimeout(answerTimer);
  clearTimeout(scrollTimer);
  pagingTimer = undefined;
  scrollTimer = undefined;
  pageRequested = false;
  mode = "idle";
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
    stopRun("end");
  }, 2000);
};

const startScrolling = () => {
  clearTimeout(scrollTimer);
  lastBodyScrollHeight = 0;
  isSameHeightTimes = 0;
  scrollDown();
};

// Ask the page hook for the next history page. Its answer is the page itself,
// which arrives like any other history response, or a "frunchyroll-paging"
// message.
const requestNextPage = () => {
  pagingTimer = undefined;
  if (mode !== "paging") return;
  pageRequested = true;
  lastRequestAt = Date.now();
  clearTimeout(answerTimer);
  answerTimer = window.setTimeout(() => {
    if (mode === "paging" && pageRequested) fallBackToScrolling("got no answer");
  }, PAGE_ANSWER_TIMEOUT_MS);
  window.postMessage({ type: "frunchyroll-next" }, "*");
};

const scheduleNextPage = () => {
  if (mode !== "paging") return;
  clearTimeout(answerTimer);
  clearTimeout(pagingTimer);
  pagingTimer = window.setTimeout(
    requestNextPage,
    Math.max(0, PAGE_INTERVAL_MS - (Date.now() - lastRequestAt))
  );
};

const startRun = () => {
  clearTimeout(pagingTimer);
  clearTimeout(scrollTimer);
  mode = "paging";
  pageRequested = false;
  notifyScrolling(true);
  requestNextPage();
};

// The popup is already told the scrape is running, so this doesn't notify.
const fallBackToScrolling = (reason: string) => {
  if (mode !== "paging") return;
  console.info(`Frunchy: paging ${reason}, scrolling instead`);
  clearTimeout(pagingTimer);
  clearTimeout(answerTimer);
  pagingTimer = undefined;
  pageRequested = false;
  mode = "scrolling";
  startScrolling();
};

const sendPage = async (page: HistoryPage) => {
  const newest = newestEntry(page);
  if (newest && (!sessionNewest || newest.datePlayed > sessionNewest.datePlayed)) {
    sessionNewest = newest;
  }
  const response = await chrome.runtime
    .sendMessage({ message: "PAGE_CAPTURED", page })
    .catch(console.error);
  if (response?.reachedMarker) stopRun("marker");
};

const setProfile = (data: { profileId: string; profileName?: string | null }) => {
  if (data.profileId !== profileId) {
    // A different profile's pages don't continue this session's sequence.
    sessionNewest = null;
    profileId = data.profileId;
  }
  crunchyrollProfile
    .get()
    .then((stored) =>
      crunchyrollProfile.set({
        profileId: data.profileId,
        // The token response has no name; keep the one multiprofile gave.
        profileName: data.profileName ?? (stored?.profileId === data.profileId ? stored.profileName : null),
      })
    )
    .catch(console.error);

  const waiting = waitingForProfile;
  waitingForProfile = [];
  for (const page of waiting) sendPage({ ...page, profileId });
};

window.addEventListener(
  "message",
  (event) => {
    // We only accept messages from ourselves
    if (event.source !== window) return;

    if (event.data?.type === "frunchyroll-profile" && typeof event.data.profileId === "string") {
      setProfile(event.data);
      return;
    }
    if (event.data?.type === "frunchyroll-paging") {
      if (mode !== "paging") return;
      pageRequested = false;
      const { state, status } = event.data;
      if (state === "end") {
        stopRun("end");
      } else {
        // Only the state and a status code are logged, never data.
        const detail = typeof status === "number" || status === "timeout" ? ` (${status})` : "";
        fallBackToScrolling(`${state === "failed" ? "failed" : "unavailable"}${detail}`);
      }
      return;
    }
    if (event.data?.type !== "frunchyroll") return;

    // The page that answers a request of ours, as opposed to one the site loaded.
    const requested = mode === "paging" && pageRequested;
    if (requested) pageRequested = false;

    let body: HistoryPage["body"];
    try {
      body = JSON.parse(event.data.responseText);
    } catch (err) {
      console.error("Frunchy: watch-history response is not JSON", err);
      if (requested) fallBackToScrolling("got an unreadable page");
      return;
    }
    const page: HistoryPage = {
      url: event.data.url,
      capturedAt: new Date().toISOString(),
      profileId,
      body,
    };
    if (profileId) {
      const sent = sendPage(page);
      // A marker stop in sendPage ends the run first, which cancels the schedule.
      if (requested) sent.catch(console.error).then(scheduleNextPage);
    } else {
      waitingForProfile.push(page);
      if (requested) scheduleNextPage();
    }
  },
  false
);

// Ask the page-world hook for a profile it saw before this script was listening.
window.postMessage({ type: "frunchyroll-hello" }, "*");

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
      startRun();
      sendResponse({ ok: true, scrolling: true });
      return;
    case "SCROLL_STOP":
      stopRun("user");
      sendResponse({ ok: true, scrolling: false });
      return;
    case "SCROLL_STATUS":
      sendResponse({ ok: true, scrolling: mode !== "idle" });
      return;
    default:
      sendResponse("pong");
  }
});

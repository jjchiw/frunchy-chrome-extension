import { storage, type HistoryPage } from "src/storage";

console.log("injected");
const s = document.createElement("script");
s.src = chrome.runtime.getURL("src/content/injected.js");
s.onload = function () {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  this.remove();
};
(document.head || document.documentElement).appendChild(s);

window.addEventListener(
  "message",
  (event) => {
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
    storage.addPage({
      url: event.data.url,
      capturedAt: new Date().toISOString(),
      body,
    });
  },
  false
);

let lastBodyScrollHeight = 0;
let isSameHeightTimes = 0;
let scrollTimer: number | undefined;

// Tell an open popup that scrolling started or stopped. Fails harmlessly when
// no popup is open.
const notifyScrolling = (scrolling: boolean) =>
  chrome.runtime
    .sendMessage({ message: "SCROLL_STATE", scrolling })
    .catch(() => undefined);

const stopScrolling = () => {
  clearTimeout(scrollTimer);
  scrollTimer = undefined;
  notifyScrolling(false);
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
    stopScrolling();
  }, 2000);
};

const startScrolling = () => {
  clearTimeout(scrollTimer);
  lastBodyScrollHeight = 0;
  isSameHeightTimes = 0;
  scrollDown();
  notifyScrolling(true);
};

// console.log("Frunchy", "Try to connect");
// const port = chrome.runtime.connect();

// port.onMessage.addListener((evt) => {
//   console.log("frunchy", evt);
//   console.log("frunchy", "yay");
// });

// chrome.runtime.onConnect.addListener((port) => {
//   console.log("frunchy", "connected!!!!!");
//   port.onMessage.addListener((msg) => {
//     console.log(msg);
//   });
// });

chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener((msg) => {
    // Handle message however you want
  });
});

// Injected on every Crunchyroll page because it's an SPA: the history page is
// often reached without a full page load, so a /history match would miss it.
const isHistoryPage = () => /\/history\/?$/.test(location.pathname);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.message) {
    case "SCROLL_DOWN":
      if (!isHistoryPage()) {
        sendResponse({ ok: false, error: "Open your Crunchyroll history page first." });
        return;
      }
      startScrolling();
      sendResponse({ ok: true, scrolling: true });
      return;
    case "SCROLL_STOP":
      stopScrolling();
      sendResponse({ ok: true, scrolling: false });
      return;
    case "SCROLL_STATUS":
      sendResponse({ ok: true, scrolling: scrollTimer !== undefined });
      return;
    default:
      sendResponse("pong");
  }
});

// console.log("add listener");
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) =>
//   sendResponse("pong")
// );

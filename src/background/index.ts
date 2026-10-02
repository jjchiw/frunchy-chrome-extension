import { storage } from "../storage";

chrome.runtime.onInstalled.addListener(() => {
  storage.getSummary().then(console.log);
});

// chrome.webRequest.onCompleted.addListener(
//   (details) => {
//     console.log(details);
//   },
//   { urls: ["*://*.crunchyroll.com/"] }
// );

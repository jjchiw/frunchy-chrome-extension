import "./styles.css";

const s = document.createElement("script");
s.src = chrome.runtime.getURL("src/content/injected.js");
s.onload = function () {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  this.remove();
};
(document.head || document.documentElement).appendChild(s);

console.log("injected");
const s = document.createElement("script");
s.src = chrome.runtime.getURL("src/content/injected.js");
s.onload = function () {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  this.remove();
};
(document.head || document.documentElement).appendChild(s);

const getQueryStringValue = (url, key) => {
  var queryString = url.split("&");
  var getParameter;
  var i;
  for (i = 0; i < queryString.length; i++) {
    getParameter = queryString[i].split("=");
    if (getParameter[0] === key) {
      return getParameter[1] === undefined
        ? true
        : decodeURIComponent(getParameter[1]);
    }
  }
};

window.addEventListener(
  "message",
  (event) => {
    // We only accept messages from ourselves
    if (event.source !== window) {
      return;
    }

    if (event.data.type === "frunchyroll") {
      console.log("send message frunchy");
      console.log("event", event.data);
      // chrome.runtime.sendMessage(
      //   chrome.runtime.id,
      //   { url: event.data.url, responseText: event.data.responseText },
      //   function (response) {
      //     console.log("Message Sent");
      //   }
      // );
      chrome.storage.sync.get().then((db) => {
        console.log(event.data.url);
        const page = getQueryStringValue(event.data.url, "page") ?? 1;
        const jsonResult = JSON.parse(event.data.responseText);
        const total = (db.total ?? 0) + jsonResult.total;
        console.log("page", page);
        console.log("db", db);
        console.log("total", total);
        chrome.storage.sync.set({ count: 0, page: page, total: total });
      });
    }
  },
  false
);

let lastBodyScrollHeight = 0;
let isSameHeightTimes = 0;

const scrollDown = () => {
  setTimeout(() => {
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
    // alert("Finish Scrapping");
  }, 2000);
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "SCROLL_DOWN") {
    lastBodyScrollHeight = 0;
    isSameHeightTimes = 0;
    scrollDown();
  }
  sendResponse("pong");
});

// console.log("add listener");
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) =>
//   sendResponse("pong")
// );

export {};

// Runs in the page's own JS world (registered by the service worker with
// world: "MAIN", runAt: "document_start"), so it patches XMLHttpRequest before
// Crunchyroll's scripts make their first request. Results go to the content
// script with window.postMessage.
//
// It also pages through the watch history: when the content script asks, it
// requests the next page with the sign-in header the site used for its own
// history requests. That header stays inside this function: it is never
// posted, logged or stored anywhere else.

(function () {
  var XHR = XMLHttpRequest.prototype;

  var open = XHR.open;
  var send = XHR.send;
  var setRequestHeader = XHR.setRequestHeader;

  var post = function (message) {
    window.postMessage(message, "*");
  };

  // The content script loads asynchronously and may miss the first profile
  // message, so the last one is re-sent when it says hello.
  var lastProfile = null;
  var postProfileMessage = function (message) {
    lastProfile = message;
    post(message);
  };
  window.addEventListener("message", function (event) {
    if (event.source === window && event.data && event.data.type === "frunchyroll-hello" && lastProfile) {
      post(lastProfile);
    }
  });

  // Only ids and the profile name leave this function. The token response also
  // carries access and refresh tokens; they are never copied or posted.
  var postProfile = function (url, responseText) {
    try {
      var json = JSON.parse(responseText);
      if (url.indexOf("/auth/v1/token") >= 0 && json.profile_id) {
        postProfileMessage({
          type: "frunchyroll-profile",
          source: "token",
          accountId: json.account_id || null,
          profileId: json.profile_id,
        });
      } else if (url.indexOf("/accounts/v1/me/multiprofile") >= 0) {
        var selected = (json.profiles || []).filter(function (p) {
          return p.is_selected;
        })[0];
        if (selected && selected.profile_id) {
          postProfileMessage({
            type: "frunchyroll-profile",
            source: "multiprofile",
            accountId: null,
            profileId: selected.profile_id,
            profileName: selected.profile_name || null,
          });
        }
      }
    } catch (err) {
      console.error("Frunchy: couldn't read the Crunchyroll profile", err);
    }
  };

  var isHistoryRequest = function (xhr) {
    return !!xhr._url && String(xhr._url).toLowerCase().indexOf("watch-history") >= 0;
  };

  var originOf = function (url) {
    return new URL(url, location.href).origin;
  };

  // The site's sign-in header for its history requests, and the origin it was
  // sent to. Only the latest is kept, since the site renews its token.
  var historyAuth = null;
  var historyOrigin = null;

  // Where the next history page is: null when unknown or not trusted, "" when
  // the last response was the final page, otherwise a same-origin URL.
  var nextUrl = null;
  var pagingInFlight = false;

  // Follow meta.next_page of a history response, resolved against its request.
  // Anything not on the request's origin and a /watch-history path is dropped.
  var updateNextUrl = function (requestUrl, responseText) {
    try {
      var meta = JSON.parse(responseText).meta;
      var next = meta && meta.next_page;
      if (!next) {
        nextUrl = "";
        return;
      }
      var base = new URL(requestUrl, location.href);
      var resolved = new URL(next, base);
      nextUrl = resolved.origin === base.origin && resolved.pathname.indexOf("/watch-history") >= 0 ? resolved.href : null;
    } catch (err) {
      nextUrl = null;
    }
  };

  // status: the HTTP status, 0 for a network error, or "timeout".
  var postPagingFailed = function (status) {
    post({ type: "frunchyroll-paging", state: "failed", status: status });
  };

  // Request the next page like the site does. The patched open/send capture
  // the response as any other watch-history response.
  var requestNextPage = function () {
    pagingInFlight = true;
    var xhr = new XMLHttpRequest();
    xhr.addEventListener("load", function () {
      if (this.status >= 400 || !this.responseText) postPagingFailed(this.status);
    });
    xhr.addEventListener("error", function () {
      postPagingFailed(0);
    });
    xhr.addEventListener("timeout", function () {
      postPagingFailed("timeout");
    });
    xhr.addEventListener("loadend", function () {
      pagingInFlight = false;
    });
    xhr.open("GET", nextUrl);
    xhr.setRequestHeader("Authorization", historyAuth);
    xhr.timeout = 30000;
    xhr.send();
  };

  window.addEventListener("message", function (event) {
    if (event.source !== window || !event.data || event.data.type !== "frunchyroll-next") return;
    if (pagingInFlight) return;
    if (nextUrl === "") {
      post({ type: "frunchyroll-paging", state: "end" });
      return;
    }
    var usable = false;
    try {
      usable = !!nextUrl && !!historyAuth && originOf(nextUrl) === historyOrigin;
    } catch (err) {}
    if (!usable) {
      post({ type: "frunchyroll-paging", state: "unavailable" });
      return;
    }
    try {
      requestNextPage();
    } catch (err) {
      pagingInFlight = false;
      postPagingFailed(0);
    }
  });

  XHR.open = function (method, url) {
    this._url = url;
    return open.apply(this, arguments);
  };

  XHR.setRequestHeader = function (name, value) {
    if (isHistoryRequest(this) && String(name).toLowerCase() === "authorization") this._auth = value;
    return setRequestHeader.apply(this, arguments);
  };

  XHR.send = function () {
    if (isHistoryRequest(this) && this._auth) {
      try {
        historyOrigin = originOf(this._url);
        historyAuth = this._auth;
      } catch (err) {}
    }

    this.addEventListener("load", function () {
      var url = this._url ? String(this._url).toLowerCase() : "";
      if (this.responseType !== "" && this.responseType !== "text") return;
      if (!this.responseText) return;

      if (url.indexOf("watch-history") >= 0) {
        // An error body isn't a history page.
        if (this.status >= 400) return;
        post({ type: "frunchyroll", url: this._url, responseText: this.responseText });
        updateNextUrl(this._url, this.responseText);
      } else if (url.indexOf("/auth/v1/token") >= 0 || url.indexOf("/accounts/v1/me/multiprofile") >= 0) {
        postProfile(url, this.responseText);
      }
    });

    return send.apply(this, arguments);
  };
})();

// Runs in the page's own JS world (registered by the service worker with
// world: "MAIN", runAt: "document_start"), so it patches XMLHttpRequest before
// Crunchyroll's scripts make their first request. Results go to the content
// script with window.postMessage.

(function () {
  var XHR = XMLHttpRequest.prototype;

  var open = XHR.open;
  var send = XHR.send;

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

  XHR.open = function (method, url) {
    this._url = url;
    return open.apply(this, arguments);
  };

  XHR.send = function () {
    this.addEventListener("load", function () {
      var url = this._url ? String(this._url).toLowerCase() : "";
      if (this.responseType !== "" && this.responseType !== "text") return;
      if (!this.responseText) return;

      if (url.indexOf("watch-history") >= 0) {
        post({ type: "frunchyroll", url: this._url, responseText: this.responseText });
      } else if (url.indexOf("/auth/v1/token") >= 0 || url.indexOf("/accounts/v1/me/multiprofile") >= 0) {
        postProfile(url, this.responseText);
      }
    });

    return send.apply(this, arguments);
  };
})();

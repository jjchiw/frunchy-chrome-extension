# Microsoft Edge Add-ons: privacy and permissions

For the Properties page in Partner Center (privacy policy URL and the questions about personal
data) and for the certification testers. It follows `../privacy-practices.md`, which has the Chrome
Web Store answers; Edge runs the same package. `<backend>` is the HTTPS origin the store build was
made for (the `FRUNCHY_BACKEND_URL` of `npm run package`), the extension's default server. If
Partner Center words a question differently from what is below, answer from the same facts.

## Single purpose

Frunchy reads the user's own Crunchyroll watch history while they are signed in to Crunchyroll in
their browser, and syncs it to the user's Frunchy account, where it becomes anime stats the user
can share.

## Personal data

The extension handles personal data, and only to do its single purpose:

- **Website content**: the Crunchyroll watch-history responses (episodes, series, dates, progress)
  are uploaded to the Frunchy backend as received.
- **Personally identifiable information**: the Crunchyroll profile name is shown in the popup and
  the profile id is sent with each upload.
- **Authentication information**: the sync key, a bearer credential for the Frunchy backend, is
  stored locally and sent to the backend with each request.
- **User activity**: on `www.crunchyroll.com` only, the page hook reads the responses of
  Crunchyroll's watch-history and profile requests, and while the user's scrape runs it requests
  the next pages of the user's own watch history from Crunchyroll. There is no click, keystroke or
  mouse logging, and no monitoring on any other site.

Not collected: the browser's own history (Frunchy reads Crunchyroll's watch-history API
responses, not the list of pages the user visited), health information, financial and payment
information, location, personal communications.

Nothing is sent until the user enters a sync key, and then only the watch history goes to the
server they configured. The extension has no analytics and contacts no other server. It does not
sell or transfer user data to third parties, does not use it for purposes unrelated to its single
purpose, and does not use it to determine creditworthiness or for lending.

## Permissions

**alarms**
Retries failed uploads to the Frunchy backend. The extension's background service worker is
suspended between events, so an alarm is what wakes it to retry.

**scripting**
Registers one content script, `injected.js`, that runs in Crunchyroll's own page context
(`world: "MAIN"`) at document start. It observes Crunchyroll's watch-history responses and the
selected profile's id and name. It also requests the next pages of the user's own watch history
from Crunchyroll, using the sign-in the page already has, which never leaves the page. It is
registered with `scripting.registerContentScripts` because it has to run before Crunchyroll's own
scripts do. The file is plain JavaScript, copied unminified.

**storage**
Keeps the scraped history pages, the upload queue, the settings (including the sync key) and the
last seen Crunchyroll profile in `storage.local`.

**unlimitedStorage**
A full watch history is tens of megabytes, which is above the default `storage.local` quota. Pages
are stored so the user can re-sync or download them without scraping again.

**Host permission `https://www.crunchyroll.com/*`**
The extension's content script and the page hook run on Crunchyroll pages to read the user's own
watch history, and the popup reads the active tab's URL to tell whether it is the history page.

**Host permission `<backend>/*`**
The default Frunchy backend API. The extension uploads history pages and checks the sync key there.
It talks to no server other than Crunchyroll and the Frunchy server the user configured.

**Optional host permission `https://*/*`**
Frunchy can be self-hosted, so the user can enter the address of their own Frunchy server in the
extension's settings. Edge asks for access to that one `https://` site only when the user saves
the address, and the extension then uploads history pages and checks the sync key there. Nothing is
requested at install for it, and the extension contacts no other site.

## Remote code

None. Everything the extension runs is bundled in the package. It loads no script, WebAssembly or
module from a remote server, and fonts and icons are bundled too.

## Privacy policy URL

`<backend>/privacy`

The backend publishes this page. Do not submit for certification before it is live.

## What the extension stores and sends

This section can be reused by the backend's privacy page.

**Stored locally, in the browser (`storage.local`)**

- The Crunchyroll watch-history pages the user scraped.
- The upload queue and its retry state.
- The settings, including the sync key.
- The last seen Crunchyroll profile id and name.

The user can remove the stored history with Clear in the popup, and all of it by uninstalling the
extension.

**Sent to the Frunchy backend**

- The watch-history pages, with the Crunchyroll profile id, only to the configured backend (the
  default server, or the user's own Frunchy server).
- The sync key, as a bearer token, so the backend knows which Frunchy account the history belongs
  to.

**Never sent**

- The user's Crunchyroll password.
- Crunchyroll's sign-in tokens. The page hook reads only the profile id and name from those
  responses, and the sign-in header of the site's history requests is only used for its own
  requests to Crunchyroll.
- Anything to any server other than Crunchyroll and the Frunchy server the user configured.

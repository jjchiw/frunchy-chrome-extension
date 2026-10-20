# Chrome Web Store: Privacy practices answers

Copy each answer into the matching field of the developer dashboard (Store listing, then Privacy
practices). `<backend>` is the HTTPS origin the store build was made for (the
`FRUNCHY_BACKEND_URL` of `npm run package`).

## Single purpose

Frunchy reads the user's own Crunchyroll watch history while they are signed in to Crunchyroll in
their browser, and syncs it to the user's Frunchy account, where it becomes anime stats the user
can share.

## Permission justifications

**alarms**
Retries failed uploads to the Frunchy backend. The extension's background service worker is
suspended between events, so an alarm is what wakes it to retry.

**scripting**
Registers one content script, `injected.js`, that runs in Crunchyroll's own page context at
document start. It observes Crunchyroll's watch-history responses and the selected profile's id
and name. It must be registered with `chrome.scripting.registerContentScripts` because it has to
run before Crunchyroll's scripts do.

**storage**
Keeps the scraped history pages, the upload queue, the settings (including the sync key) and the
last seen Crunchyroll profile in `chrome.storage.local`.

**unlimitedStorage**
A full watch history is tens of megabytes, which is above the default `chrome.storage.local`
quota. Pages are stored so the user can re-sync or download them without scraping again.

**Host permission `https://www.crunchyroll.com/*`**
The extension's content script and the page hook run on Crunchyroll pages to read the user's own
watch history, and the popup reads the active tab's URL to tell whether it is the history page.

**Host permission `<backend>/*`**
The Frunchy backend API. The extension uploads history pages and checks the sync key there. It
talks to no other server.

## Remote code

Select: **No, I am not using remote code.**

Reason: everything the extension runs is bundled in the package. It loads no script, WebAssembly
or module from a remote server, and fonts and icons are bundled too.

## Data usage

Tick these categories:

- **Website content**: the Crunchyroll watch-history responses (episodes, series, dates, progress)
  are uploaded to the Frunchy backend as received.
- **Personally identifiable information**: the Crunchyroll profile name is shown in the popup and
  the profile id is sent with each upload.
- **Authentication information**: the sync key, a bearer credential for the Frunchy backend, is
  stored locally and sent to the backend with each request.

Leave these unticked:

- **Web history**: Frunchy reads Crunchyroll's own watch-history API responses, not the browser's
  history. It doesn't read or collect the list of pages the user has visited.
- **User activity**: there is no click, keystroke, mouse or network monitoring. The extension only
  scrolls the history page when the user presses Scrape.
- Health information, financial and payment information, location, personal communications:
  not collected.

Certifications (tick all three):

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

`<backend>/privacy`

The backend publishes this page (it doesn't exist until the backend creates it). Do not submit for
review before it is live.

## What the extension stores and sends

This section can be reused by the backend's privacy page.

**Stored locally, in the browser (`chrome.storage.local`)**

- The Crunchyroll watch-history pages the user scraped.
- The upload queue and its retry state.
- The settings, including the sync key.
- The last seen Crunchyroll profile id and name.

The user can remove the stored history with Clear in the popup, and all of it by uninstalling the
extension.

**Sent to the Frunchy backend**

- The watch-history pages, with the Crunchyroll profile id, only to the configured backend.
- The sync key, as a bearer token, so the backend knows which Frunchy account the history belongs
  to.

**Never sent**

- The user's Crunchyroll password.
- Crunchyroll's sign-in tokens. The page hook reads only the profile id and name from those
  responses.
- Anything to any other server.

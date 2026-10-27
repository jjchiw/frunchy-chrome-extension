Notes for the reviewers

Build: the source archive has the build instructions in store/firefox/SOURCE.md (Node 22, `npm ci`, `FRUNCHY_BACKEND_URL=https://frunchy.lacalabaza.xyz npm run build:firefox`). The output in dist-firefox/ matches the submitted package file by file.

What it does: Frunchy reads the signed-in user's own Crunchyroll watch history and uploads it to the user's Frunchy account, only after the user enters a sync key. It talks to www.crunchyroll.com and to the Frunchy server the user configured, and to nothing else. It has no remote code.

public/injected.js is registered with scripting.registerContentScripts in the page's own world (world: "MAIN") at document_start. It has to run there, before Crunchyroll's scripts, because it wraps XMLHttpRequest to read the responses of Crunchyroll's own watch-history and profile requests. It posts only the history responses and the profile id and name to the extension's content script with window.postMessage. The sign-in header of the site's requests is reused only for the next-page requests to Crunchyroll and is never posted, logged or stored. The file is plain JavaScript, copied unminified.

Validator warnings: web-ext lint reports three UNSAFE_VAR_ASSIGNMENT warnings (innerHTML) in the bundled shared chunk. They come from Svelte's template cloning of compile-time static markup and from the bundled Material Symbols SVG icons, which Icon.svelte inserts with {@html} from ?raw imports. They are static strings, never page or user data.

Testing: exercising the extension needs a Crunchyroll account, signed in at https://www.crunchyroll.com/history, and a Frunchy sync key from a Frunchy server. Without a key it only stores the history in the browser. The popup and the settings page open without an account.

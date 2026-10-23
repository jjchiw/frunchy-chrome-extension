// Generator page for the Chrome Web Store images (see render.mjs). It stubs chrome.*, mounts the
// real Popup or Settings component with invented data, and lays the result out on a 1280x800
// screenshot canvas or a 440x280 promo tile. Nothing here comes from a real account.
// kind=plain skips the canvas: the component alone at its natural height, for the website's guide.
//
// Query: kind=shot|plain|promo, state=ready|scraping|synced|options, lang=en|es.
import enMessages from "@repo/public/_locales/en/messages.json";
import esMessages from "@repo/public/_locales/es/messages.json";
import mark from "src/assets/brand/frunchy-mark.svg";

const params = new URLSearchParams(location.search);
const kind = params.get("kind") ?? "shot";
const state = params.get("state") ?? "ready";
const lang = params.get("lang") === "es" ? "es" : "en";
const messages: Record<string, any> = lang === "es" ? esMessages : enMessages;

// One caption per state and language. They live here, not in the components.
const captions: Record<string, Record<string, string>> = {
  en: {
    ready: "Open your Crunchyroll history and press Scrape.",
    scraping: "Frunchy scrolls through your history for you.",
    synced: "Your history syncs to your Frunchy account.",
    options: "Paste your sync key once and you're connected.",
  },
  es: {
    ready: "Abre tu historial de Crunchyroll y pulsa Escanear.",
    scraping: "Frunchy recorre tu historial por ti.",
    synced: "Tu historial se sincroniza con tu cuenta de Frunchy.",
    options: "Pega tu clave de sincronización una vez y listo.",
  },
};

// Invented fixtures.
const HISTORY = "https://www.crunchyroll.com/history";
const PROFILE = "00000000-0000-4000-8000-000000000001";
const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

// Solid-colour thumbnails in the Night Broadcast palette.
const thumb = (color: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="${color}"/></svg>`);

const series = [
  { title: "Example Series", color: "#ffb547" },
  { title: "Another Show", color: "#ff6fa8" },
  { title: "Third Story", color: "#c9bcff" },
];
const entries = series.map(({ title, color }, i) => ({
  id: `EXAMPLE${i + 1}`,
  date_played: ago(2 + i * 26),
  playhead: [1440, 900, 600][i],
  fully_watched: i === 0,
  panel: {
    title,
    episode_metadata: { series_title: title, episode: String(12 - i * 3), duration_ms: 24 * 60_000 },
    images: { thumbnail: [[{ source: thumb(color), width: 160 }]] },
  },
}));

const pageUrl = "https://www.crunchyroll.com/content/v2/discover/example-account/watch-history?page_size=100";
const pageId = `${PROFILE} ${pageUrl}`;
const stored = state === "ready" ? 0 : state === "scraping" ? 186 : 248;
const dates = entries.map((entry) => entry.date_played).sort();

const me = {
  username: "mika",
  displayName: "Mika",
  dashboardUrl: "https://frunchy.example/dashboard",
  lastSyncAt: state === "ready" ? null : state === "scraping" ? ago(26) : ago(0.1),
  historyOwnerBound: true,
};

const store: Record<string, any> = {
  settings: { baseUrl: "https://frunchy.example", syncKey: "frk_example_0000000000" },
  crunchyrollProfile: { profileId: PROFILE, profileName: "Mika" },
};
if (stored) {
  store.index = { [pageId]: { entries: stored, oldest: ago(24 * 400), newest: dates[dates.length - 1] } };
  store[`page:${pageId}`] = {
    url: pageUrl,
    capturedAt: ago(0.2),
    profileId: PROFILE,
    body: { total: stored, data: entries },
  };
}
if (state === "synced") {
  store.sync = {
    marker: null,
    lastRejectionAt: null,
    lastError: null,
    sent: { [pageId]: "example" },
    lastImport: {
      importId: "example-import",
      statusUrl: "/api/imports/example-import",
      acceptedAt: ago(0.1),
      entriesReceived: stored,
      status: "completed",
      counts: { received: stored, processed: stored, unresolved: 0, unsupported: 0, failed: 0 },
    },
  };
}
if (state === "scraping") {
  store.sync = { marker: null, lastRejectionAt: null, lastError: null, sent: {}, lastImport: null };
  // Three pages waiting, so the "Waiting to upload" line reads naturally.
  store.uploadQueue = Object.fromEntries(
    [pageId, `${pageId}&page=2`, `${pageId}&page=3`].map((id) => [id, { attempts: 0, nextAttemptAt: Date.now() + 60_000, hash: "example" }]),
  );
}

const pick = (keys: any) => {
  if (keys == null) return { ...store };
  if (typeof keys === "string") return keys in store ? { [keys]: store[keys] } : {};
  if (Array.isArray(keys)) return Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]]));
  return Object.fromEntries(Object.entries(keys).map(([k, fallback]) => [k, k in store ? store[k] : fallback]));
};

const listeners = () => ({ addListener() {}, removeListener() {} });
const chromeStub: any = {
  i18n: {
    getUILanguage: () => lang,
    getMessage(key: string, substitutions: string[] = []) {
      const message = messages[key];
      if (!message) return "";
      const placeholders = message.placeholders ?? {};
      return (message.message as string)
        .replace(/\$([A-Za-z0-9_]+)\$/g, (_, name) => placeholders[name.toLowerCase()]?.content ?? "")
        .replace(/\$(\d)/g, (_, n) => substitutions[Number(n) - 1] ?? "");
    },
  },
  storage: {
    local: {
      get: async (keys?: any) => pick(keys),
      set: async (items: Record<string, any>) => void Object.assign(store, items),
      remove: async (keys: string | string[]) => void ([] as string[]).concat(keys).forEach((k) => delete store[k]),
    },
    onChanged: listeners(),
  },
  tabs: {
    query: async () => [{ id: 1, url: HISTORY }],
    sendMessage: (_id: number, _message: any, callback: (response?: any) => void) =>
      callback({ scrolling: state === "scraping" }),
    onUpdated: listeners(),
    create: async () => ({}),
    update: async () => ({}),
    reload: async () => {},
  },
  runtime: {
    sendMessage: async () => ({ queued: 0 }),
    onMessage: listeners(),
    openOptionsPage: async () => {},
    // The store build's manifest: it reaches https servers only.
    getManifest: () => ({ optional_host_permissions: ["https://*/*"] }),
    lastError: undefined,
  },
  permissions: { request: async () => true },
};
(globalThis as any).chrome = chromeStub;

// api.me goes through fetch; there is no network.
globalThis.fetch = (async (input: any) => {
  const url = String(input instanceof URL ? input.href : (input?.url ?? input));
  if (url.includes("/api/me")) {
    return new Response(JSON.stringify(me), { status: 200, headers: { "content-type": "application/json" } });
  }
  throw new TypeError("network");
}) as typeof fetch;

document.documentElement.lang = lang;
await import("src/styles/base.css");

const stage = document.getElementById("stage")!;
// Hidden until laid out, so a screenshot taken too early is plainly blank and gets retried.
stage.style.visibility = "hidden";
document.body.style.cssText = "margin:0;overflow:hidden;";

if (kind === "promo") {
  document.body.style.width = "440px";
  document.body.style.height = "280px";
  stage.style.cssText = "display:flex;align-items:center;justify-content:center;gap:16px;width:440px;height:280px;visibility:hidden;";
  stage.innerHTML = `<img src="${mark}" alt="" width="88" height="88" /><span style="font-family:var(--font-display);font-weight:800;font-size:60px;letter-spacing:-0.025em;line-height:1">Frunchy</span>`;
} else if (kind === "plain") {
  // No canvas, caption or frame: the page is the component, 380 px (popup) or 480 px (options).
  document.body.style.width = `${state === "options" ? 480 : 380}px`;
  document.body.style.background = "var(--color-surface)";
  stage.style.cssText = "visibility:hidden;";
  stage.innerHTML = `<div id="window"></div>`;

  const { mount } = await import("svelte");
  const App =
    state === "options"
      ? (await import("src/components/Settings.svelte")).default
      : (await import("src/components/Popup.svelte")).default;
  mount(App, { target: document.getElementById("window")! });
} else {
  // The popup is 380 px wide and the options form at most 480, shown at 1.25x on the left,
  // with the caption on the right.
  const SCALE = 1.25;
  const width = state === "options" ? 480 : 380;
  const left = 120;
  const gap = 80;
  document.body.style.width = "1280px";
  document.body.style.height = "800px";
  stage.style.cssText = "position:relative;width:1280px;height:800px;visibility:hidden;";
  stage.innerHTML = `
    <div id="window" style="position:absolute;left:${left}px;top:0;width:${width}px;transform:scale(${SCALE});transform-origin:top left;border-radius:12px;overflow:hidden;box-shadow:0 0 0 1px var(--color-outline-variant),0 24px 60px rgb(0 0 0 / 0.5);background:var(--color-surface)"></div>
    <p id="caption" style="position:absolute;left:${left + width * SCALE + gap}px;right:${gap}px;margin:0;font-family:var(--font-display);font-weight:700;font-size:40px;line-height:1.15;letter-spacing:-0.015em;text-wrap:balance"></p>`;
  document.getElementById("caption")!.textContent = captions[lang][state];

  const { mount } = await import("svelte");
  const App =
    state === "options"
      ? (await import("src/components/Settings.svelte")).default
      : (await import("src/components/Popup.svelte")).default;
  mount(App, { target: document.getElementById("window")! });
}

await document.fonts.ready;
// Let the components' onMount reads settle.
await new Promise((resolve) => setTimeout(resolve, 600));
if (kind !== "promo" && state === "options") {
  document.querySelector("form")!.requestSubmit();
  await new Promise((resolve) => setTimeout(resolve, 400));
}
await document.fonts.ready;

if (kind === "plain") {
  // render.mjs reads this to size the window.
  const height = document.getElementById("window")!.getBoundingClientRect().height;
  document.documentElement.setAttribute("data-height", String(Math.ceil(height)));
} else if (kind !== "promo") {
  const frame = document.getElementById("window")!;
  const caption = document.getElementById("caption")!;
  const SCALE = 1.25;
  const height = frame.offsetHeight * SCALE;
  frame.style.top = `${Math.round((800 - height) / 2)}px`;
  caption.style.top = `${Math.round((800 - caption.offsetHeight) / 2)}px`;
  document.documentElement.setAttribute("data-window-height", String(Math.round(height)));
}
stage.style.visibility = "visible";
document.documentElement.setAttribute("data-ready", "true");

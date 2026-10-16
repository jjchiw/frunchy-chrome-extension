<script lang="ts">
  import { onMount, tick } from "svelte";
  import { api, webPages, type Me } from "src/api";
  import mark from "src/assets/brand/frunchy-mark.svg";
  import Icon from "src/components/Icon.svelte";
  import { errorText, formatDate, formatRelative, t } from "src/i18n";
  import { getSettings, isConfigured, type Settings } from "src/settings";
  import {
    crunchyrollProfile,
    storage,
    type CrunchyrollProfile,
    type RecentEntry,
    type ScrapeSummary,
  } from "src/storage";
  import { queuedPageIds, syncState, type SyncState } from "src/sync";

  const POLL_MS = 3000;
  const RECENT_LIMIT = 3;
  const HISTORY_URL = "https://www.crunchyroll.com/history";

  // "other": the active tab isn't a Crunchyroll history page. "reload": it is,
  // but has no content script yet (opened before Frunchy was installed or updated).
  type TabState = "checking" | "other" | "reload" | "ready";
  type EntryStatus = "synced" | "pending" | "stored";

  let tabId: number | undefined;
  let tabUrl: string | undefined;
  let tab = $state<TabState>("checking");
  let scrolling = $state(false);
  let summary = $state<ScrapeSummary>({ pages: 0, entries: 0, oldest: null, newest: null });
  let recent = $state<RecentEntry[]>([]);
  let settings = $state<Settings | null>(null);
  let me = $state<Me | null>(null);
  let sync = $state<SyncState | null>(null);
  let queued = $state<string[]>([]);
  let profile = $state<CrunchyrollProfile | null>(null);
  let notice = $state<{ text: string; isError: boolean } | null>(null);
  let confirmingClear = $state(false);
  let clearButton = $state<HTMLButtonElement>();
  let cancelButton = $state<HTMLButtonElement>();

  // Screen-reader announcements for changes that happen while the popup is open
  // (the hero title is live too). Only changes are announced, not the state on open.
  const ANNOUNCE_EVERY = 500;
  let announcement = $state("");
  let announcedEntries = 0;
  let wasScrolling = false;
  let seenError: string | null | undefined;
  let seenImport: string | null | undefined;

  $effect(() => {
    if (scrolling && !wasScrolling) {
      announcedEntries = summary.entries;
    } else if (scrolling && summary.entries - announcedEntries >= ANNOUNCE_EVERY) {
      announcedEntries = summary.entries;
      announcement = t("scrape_progress", summary.entries.toLocaleString());
    } else if (!scrolling && wasScrolling) {
      announcement = t("scrape_finished", summary.entries.toLocaleString());
    }
    wasScrolling = scrolling;
  });

  $effect(() => {
    if (!sync) return;
    const error = sync.lastError?.code ?? null;
    const lastImport = sync.lastImport;
    const finished =
      lastImport && (lastImport.status === "completed" || lastImport.status === "failed")
        ? `${lastImport.importId} ${lastImport.status}`
        : null;
    if (seenError !== undefined && error && error !== seenError) announcement = errorText(error);
    if (seenImport !== undefined && finished && finished !== seenImport) {
      announcement =
        lastImport!.status === "completed" && lastImport!.counts
          ? t("import_finished", lastImport!.counts.processed, lastImport!.counts.unresolved)
          : t("import_failed");
    }
    seenError = error;
    seenImport = finished;
  });

  const configured = $derived(settings !== null && isConfigured(settings));
  const syncStatus = $derived(!configured ? "off" : sync?.lastError ? "issue" : "on");
  const lastSyncAt = $derived(me?.lastSyncAt ?? sync?.lastImport?.acceptedAt ?? null);
  const profileName = $derived(profile ? (profile.profileName ?? profile.profileId.slice(0, 8)) : null);
  const hero = $derived.by(() => {
    if (scrolling) return { title: t("hero_running_title"), text: t("hero_running_text", summary.entries.toLocaleString()) };
    if (tab === "ready") {
      const text =
        summary.entries && summary.newest
          ? t("hero_ready_again", summary.entries.toLocaleString(), formatDate(summary.newest))
          : t("hero_ready_first");
      return { title: t("hero_ready_title"), text };
    }
    if (tab === "reload") return { title: t("hero_reload_title"), text: t("hero_reload_text") };
    return { title: t("hero_open_title"), text: t("hero_open_text") };
  });

  const statusIcons = { synced: "cloud_done", pending: "cloud_upload", stored: "download_done" } as const;

  const entryStatus = (pageId: string): EntryStatus =>
    queued.includes(pageId) ? "pending" : sync?.sent[pageId] ? "synced" : "stored";

  // What a recent-episodes row shows, from the stored Crunchyroll entry.
  const describe = ({ pageId, entry }: RecentEntry) => {
    const meta = entry.panel?.episode_metadata;
    const durationMs = meta?.duration_ms ?? 0;
    const watched = entry.fully_watched
      ? 100
      : durationMs
        ? Math.min(100, Math.round(((entry.playhead ?? 0) * 1000 * 100) / durationMs))
        : 0;
    // Smallest thumbnail that's still sharp at 2x.
    const sizes = [...(entry.panel?.images?.thumbnail?.[0] ?? [])].sort((a, b) => a.width - b.width);
    const thumbnail = (sizes.find((size) => size.width >= 160) ?? sizes[sizes.length - 1])?.source;
    const details = [
      meta?.episode ? t("episode_number", meta.episode) : null,
      durationMs ? t("duration_minutes", Math.round(durationMs / 60_000)) : null,
    ].filter(Boolean);
    return {
      title: meta?.series_title || entry.panel?.title || "",
      details: details.join(" · "),
      watched,
      thumbnail,
      status: entryStatus(pageId),
    };
  };

  const isHistoryUrl = (url?: string) => {
    if (!url) return false;
    const { hostname, pathname } = new URL(url);
    return hostname === "www.crunchyroll.com" && /\/history\/?$/.test(pathname);
  };

  // Resolves to null when the tab has no content script to answer.
  const sendToTab = (message: string): Promise<any> =>
    new Promise((resolve) => {
      if (tabId === undefined) return resolve(null);
      chrome.tabs.sendMessage(tabId, { message }, (response) => {
        resolve(chrome.runtime.lastError ? null : response);
      });
    });

  const probeTab = async () => {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = active?.id;
    tabUrl = active?.url;
    if (!isHistoryUrl(tabUrl)) {
      tab = "other";
      scrolling = false;
      return;
    }
    const status = await sendToTab("SCROLL_STATUS");
    tab = status ? "ready" : "reload";
    scrolling = status?.scrolling ?? false;
  };

  const refreshRecent = async () => (recent = await storage.getRecent(profile?.profileId ?? null, RECENT_LIMIT));
  const refreshSummary = async () => {
    const newest = summary.newest;
    summary = await storage.getSummary();
    if (summary.newest !== newest || recent.length === 0) refreshRecent();
  };
  const refreshSync = async () => {
    sync = await syncState.get();
    queued = await queuedPageIds();
  };
  const refreshProfile = async () => {
    profile = await crunchyrollProfile.get();
    refreshRecent();
  };

  // Follows the newest import until the backend finishes it.
  const pollLastImport = async () => {
    const lastImport = sync?.lastImport;
    if (!settings || !lastImport || lastImport.status === "completed" || lastImport.status === "failed") return;
    try {
      const status = await api.importStatus(settings, lastImport.statusUrl);
      await syncState.update({ lastImport: { ...lastImport, status: status.status, counts: status.counts } });
    } catch {
      // Status is informational; the next tick or popup open tries again.
    }
  };

  onMount(() => {
    probeTab();
    refreshSummary();
    refreshSync();
    refreshProfile();
    getSettings().then((loaded) => {
      settings = loaded;
      if (isConfigured(loaded)) {
        api.me(loaded).then((who) => (me = who)).catch(() => (me = null));
      }
    });

    const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") return;
      if (changes.index) refreshSummary();
      if (changes.sync || changes.uploadQueue) refreshSync();
      if (changes.crunchyrollProfile) refreshProfile();
    };
    const onMessage = (request: any) => {
      if (request.message === "SCROLL_STATE") scrolling = request.scrolling;
    };
    // Re-check once the tab we opened or reloaded has loaded.
    const onTabUpdated = (id: number, change: chrome.tabs.OnUpdatedInfo) => {
      if (id === tabId && change.status === "complete") probeTab();
    };
    chrome.storage.onChanged.addListener(onStorageChanged);
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    const poll = setInterval(pollLastImport, POLL_MS);

    return () => {
      chrome.storage.onChanged.removeListener(onStorageChanged);
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
      clearInterval(poll);
    };
  });

  const openSettings = () => chrome.runtime.openOptionsPage();

  async function openHistory() {
    // Reuse a Crunchyroll tab so its session and profile carry over.
    if (tabId !== undefined && tabUrl && new URL(tabUrl).hostname === "www.crunchyroll.com") {
      tab = "checking";
      await chrome.tabs.update(tabId, { url: HISTORY_URL });
    } else {
      await chrome.tabs.create({ url: HISTORY_URL });
    }
  }

  async function reloadTab() {
    if (tabId === undefined) return;
    tab = "checking";
    await chrome.tabs.reload(tabId);
  }

  async function scrap() {
    const response = await sendToTab("SCROLL_DOWN");
    if (!response) {
      tab = "reload";
      return;
    }
    notice = response.ok === false ? { text: errorText(response.error), isError: true } : null;
    scrolling = response.scrolling ?? false;
  }

  async function stop() {
    await sendToTab("SCROLL_STOP");
    scrolling = false;
  }

  async function syncStored() {
    const response = await chrome.runtime.sendMessage({ message: "SYNC_STORED" });
    notice = {
      text: response?.skipped
        ? t("queued_pages_skipped", response.queued, response.skipped)
        : t("queued_pages", response?.queued ?? 0),
      isError: false,
    };
  }

  async function download() {
    const pages = await storage.getPages();
    // Same envelope as POST /api/imports; profileId only when it's unambiguous.
    const profileIds = [...new Set(pages.map((page) => page.profileId).filter(Boolean))];
    const json = JSON.stringify({
      exportedAt: new Date().toISOString(),
      ...(profileIds.length === 1 ? { profileId: profileIds[0] } : {}),
      pages,
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    link.download = `crunchyroll-history-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  }

  async function askClear() {
    confirmingClear = true;
    await tick();
    cancelButton?.focus();
  }

  async function cancelClear() {
    confirmingClear = false;
    await tick();
    clearButton?.focus();
  }

  async function clear() {
    await storage.clear();
    confirmingClear = false;
    recent = [];
    refreshSummary();
  }
</script>

<main class="popup">
  <header class="top">
    <div class="brand">
      <span class="mark"><img src={mark} alt="" width="28" height="28" /></span>
      <div class="brand-text">
        <h1 class="wordmark">Frunchy</h1>
        <p class="sync-status sync-{syncStatus}">
          <span class="dot" aria-hidden="true"></span>{t(`status_sync_${syncStatus}`)}
        </p>
      </div>
    </div>
    <button class="icon-button" onclick={openSettings} aria-label={t("settings")} title={t("settings")}>
      <Icon name="tune" />
    </button>
  </header>

  <section class="hero" class:running={scrolling} aria-labelledby="hero-title">
    <!-- Only the title is announced: the running count changes every couple of seconds. -->
    <div>
      <div class="hero-head">
        <h2 id="hero-title" class="hero-title" aria-live="polite">{hero.title}</h2>
        {#if profileName}
          <span class="profile" title={t("crunchyroll_profile", profileName)}>
            <span class="visually-hidden">{t("crunchyroll_profile", "")}</span>{profileName}
          </span>
        {/if}
      </div>
      <p class="hero-text">{hero.text}</p>
    </div>

    {#if scrolling}
      <button class="action action-stop" onclick={stop}><Icon name="stop" />{t("stop")}</button>
    {:else if tab === "ready"}
      <button class="action" onclick={scrap}><Icon name="bolt" />{t("scrap")}</button>
    {:else if tab === "reload"}
      <button class="action" onclick={reloadTab}><Icon name="refresh" />{t("reload_tab")}</button>
    {:else}
      <button class="action" onclick={openHistory} disabled={tab === "checking"}>
        <Icon name="history" />{t("open_history")}
      </button>
    {/if}

    <!-- An error is shown above the sync lines, never instead of them: pages can still be waiting. -->
    <div class="hero-meta">
      {#if !configured}
        <p class="meta-row">
          <Icon name="cloud_off" size={16} />
          <span>{t("sync_off")} <button class="link" onclick={openSettings}>{t("set_up")}</button></span>
        </p>
      {:else}
        {@const error = sync?.lastError}
        {@const lastImport = sync?.lastImport}
        {#if error}
          <p class="meta-row meta-error">
            <Icon name="error" size={16} />
            <span>
              {errorText(error.code)}
              {#if error.code === "unauthorized"}
                <button class="link" onclick={openSettings}>{t("open_settings")}</button>
              {:else if settings && (error.code === "history_owner_mismatch" || error.code === "history_owner_taken")}
                <!-- The binding is reset from the account page. -->
                <a class="link" href={webPages.account(settings.baseUrl)} target="_blank" rel="noreferrer">
                  {t("open_account")}
                </a>
              {/if}
            </span>
          </p>
        {/if}
        <p class="meta-row">
          <Icon name="schedule" size={16} />
          <span>{lastSyncAt ? t("last_sync", formatRelative(lastSyncAt)) : t("never_synced")}</span>
        </p>
        {#if queued.length > 0}
          <p class="meta-row meta-pending">
            <Icon name="cloud_upload" size={16} /><span>{t("pending_uploads", queued.length)}</span>
          </p>
        {/if}
        {#if lastImport?.status === "completed" && lastImport.counts}
          <p class="meta-row">
            <Icon name="check_circle" size={16} />
            <span>{t("import_completed", lastImport.counts.processed, lastImport.counts.unresolved)}</span>
          </p>
        {:else if lastImport?.status === "failed"}
          <p class="meta-row meta-error"><Icon name="error" size={16} /><span>{t("import_failed")}</span></p>
        {:else if lastImport}
          <p class="meta-row">
            <Icon name="sync" size={16} /><span>{t("import_in_progress", lastImport.entriesReceived)}</span>
          </p>
        {/if}
      {/if}
    </div>
  </section>

  {#if recent.length}
    <section class="recent" aria-labelledby="recent-title">
      <div class="section-head">
        <h2 id="recent-title" class="section-title">{t("recent_title")}</h2>
        {#if summary.oldest && summary.newest}
          <p class="section-note">{t("summary_range", formatDate(summary.oldest), formatDate(summary.newest))}</p>
        {/if}
      </div>
      <ul class="episodes">
        {#each recent as item, i (`${item.pageId} ${item.entry.id ?? i}`)}
          {@const episode = describe(item)}
          <li class="episode">
            <div class="thumb">
              {#if episode.thumbnail}
                <img src={episode.thumbnail} alt="" width="64" height="36" loading="lazy" />
              {/if}
              <span class="watched" style:width="{episode.watched}%"></span>
            </div>
            <div class="episode-text">
              <p class="series">{episode.title}</p>
              <p class="episode-meta">
                <span class="episode-details"
                  >{episode.details ? `${episode.details} · ` : ""}<time datetime={item.entry.date_played}
                    >{formatRelative(item.entry.date_played!)}</time
                  ><span class="visually-hidden">, {t("watched_percent", episode.watched)}</span></span
                >
                <span class="entry-status entry-{episode.status}">
                  <Icon name={statusIcons[episode.status]} size={14} />{t(`entry_${episode.status}`)}
                </span>
              </p>
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <p class="notice" class:notice-error={notice?.isError} role="status">{notice?.text ?? ""}</p>

  {#if me || summary.pages || confirmingClear}
    <footer class="bottom">
      {#if confirmingClear}
        <p class="confirm-text">{t("confirm_clear", summary.entries.toLocaleString())}</p>
        <button class="small-button danger" onclick={clear}><Icon name="delete" size={18} />{t("clear_confirm")}</button>
        <button class="small-button" bind:this={cancelButton} onclick={cancelClear}>{t("cancel")}</button>
      {:else}
        {#if me}
          <!-- Short labels, as in the website's navigation; the full wording is the accessible name. -->
          <a
            class="web-link"
            href={me.dashboardUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={t("open_dashboard")}
            title={t("open_dashboard")}
          >
            {t("dashboard")}<Icon name="open_in_new" size={16} />
          </a>
          {#if settings}
            <a class="web-link" href={webPages.dna(settings.baseUrl, me.username)} target="_blank" rel="noreferrer">
              {t("anime_dna")}<Icon name="open_in_new" size={16} />
            </a>
          {/if}
        {/if}
        <!-- Nothing to sync, export or delete until something is stored. -->
        {#if summary.pages}
          <div class="tools" role="group" aria-label={t("more_actions")}>
            {#if configured}
              <button class="icon-button" onclick={syncStored} aria-label={t("sync_stored")} title={t("sync_stored")}>
                <Icon name="sync" />
              </button>
            {/if}
            <button class="icon-button" onclick={download} aria-label={t("download_json")} title={t("download_json")}>
              <Icon name="download" />
            </button>
            <button
              class="icon-button"
              bind:this={clearButton}
              onclick={askClear}
              aria-label={t("clear")}
              title={t("clear")}
            >
              <Icon name="delete" />
            </button>
          </div>
        {/if}
      {/if}
    </footer>
  {/if}
  <p class="visually-hidden" role="status">{announcement}</p>
</main>

<style>
  .popup {
    width: 380px;
    padding: 14px var(--space-md);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  p,
  h1,
  h2,
  ul {
    margin: 0;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-full);
    background: currentColor;
    flex: none;
  }

  /* Header */

  .top {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-right: auto;
    min-width: 0;
  }

  .mark {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex: none;
    border-radius: var(--radius-default);
    background: var(--color-surface-container-high);
    border: var(--border-micro);
  }

  .wordmark {
    font-size: var(--text-headline-md-size);
    line-height: 24px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .sync-status {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
    font-size: var(--text-label-md-size);
    line-height: var(--text-label-md-line);
    font-weight: var(--text-label-md-weight);
    color: var(--color-on-surface-variant);
  }

  .sync-on .dot {
    color: var(--color-primary);
  }

  .sync-off .dot {
    color: var(--color-outline);
  }

  .sync-issue {
    color: var(--color-error);
  }

  .icon-button {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex: none;
    padding: 0;
    border: none;
    border-radius: var(--radius-default);
    background: transparent;
    color: var(--color-on-surface-variant);
    transition:
      color 150ms ease-out,
      background-color 150ms ease-out;
  }

  .icon-button:hover:not(:disabled) {
    color: var(--color-on-surface);
    background: var(--color-surface-container-high);
  }

  .icon-button:disabled {
    color: var(--color-outline-variant);
  }

  /* Hero */

  .hero {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: 14px var(--space-md);
    border-radius: var(--radius-lg);
    background:
      radial-gradient(120% 90% at 100% 0%, rgb(6 182 212 / 0.14), transparent 60%),
      var(--color-surface-container-low);
    border: var(--border-micro);
    border-top-color: var(--edge-highlight);
    box-shadow: var(--shadow-level-2);
  }

  /* While scraping, a scan line sweeps the card's top edge. */
  .hero.running::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--color-primary), transparent);
    transform: translateX(-100%);
    animation: scan 1.6s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  }

  @keyframes scan {
    to {
      transform: translateX(100%);
    }
  }

  .hero-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .profile {
    flex: none;
    max-width: 40%;
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 2px 10px;
    border-radius: var(--radius-full);
    background: rgb(192 193 255 / 0.12);
    border: 1px solid rgb(192 193 255 / 0.3);
    color: var(--color-secondary);
    font-size: var(--text-label-md-size);
    line-height: var(--text-label-md-line);
    font-weight: var(--text-label-md-weight);
  }

  .hero-title {
    font-size: var(--text-headline-md-size);
    line-height: var(--text-headline-md-line);
    font-weight: 700;
    letter-spacing: var(--text-headline-md-tracking);
    text-wrap: balance;
  }

  .hero-text {
    margin-top: var(--space-xs);
    color: var(--color-on-surface-variant);
    text-wrap: pretty;
  }

  .action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    min-height: 48px;
    padding: 0 var(--space-md);
    border: none;
    border-radius: var(--radius-default);
    background: var(--color-primary);
    color: var(--color-on-primary);
    font-size: var(--text-body-lg-size);
    font-weight: 700;
    transition:
      box-shadow 200ms ease-out,
      background-color 200ms ease-out;
  }

  .action:hover:not(:disabled) {
    background: var(--color-primary-fixed);
    box-shadow: var(--glow-primary);
  }

  .action:disabled {
    background: var(--color-surface-container-highest);
    color: var(--color-on-surface-variant);
  }

  .action-stop,
  .action-stop:hover:not(:disabled) {
    background: rgb(76 215 246 / 0.08);
    color: var(--color-primary);
    box-shadow: inset 0 0 0 1px rgb(76 215 246 / 0.5);
  }

  .hero-meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    color: var(--color-on-surface-variant);
    font-size: var(--text-label-md-size);
    line-height: var(--text-label-md-line);
  }

  .meta-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  /* Keep the icon on the first line of a wrapped row. */
  .meta-row > :global(.icon) {
    margin-top: 1px;
  }

  .meta-error {
    color: var(--color-error);
  }

  .meta-pending {
    color: var(--color-secondary);
  }

  .link {
    padding: 0;
    border: none;
    background: none;
    color: var(--color-primary);
    font-weight: var(--text-label-md-weight);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  /* Recent episodes */

  .section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
    margin-bottom: var(--space-sm);
  }

  .section-note {
    color: var(--color-outline);
    font-size: var(--text-label-sm-size);
    line-height: var(--text-label-sm-line);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .section-title {
    font-size: var(--text-label-sm-size);
    line-height: var(--text-label-sm-line);
    font-weight: var(--text-label-sm-weight);
    letter-spacing: var(--text-label-sm-tracking);
    text-transform: uppercase;
    color: var(--color-on-surface-variant);
  }

  .episodes {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .episode {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px;
    border-radius: var(--radius-md);
    background: var(--color-surface-container-low);
    border: var(--border-micro);
  }

  .thumb {
    position: relative;
    flex: none;
    width: 64px;
    height: 36px;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--color-surface-container-high);
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.4);
  }

  .thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .watched {
    position: absolute;
    left: 0;
    bottom: 0;
    height: 3px;
    background: var(--color-primary);
  }

  .episode-text {
    flex: 1;
    min-width: 0;
  }

  .series {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 700;
  }

  .episode-meta {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    color: var(--color-on-surface-variant);
    font-size: var(--text-label-md-size);
    line-height: var(--text-label-md-line);
    font-variant-numeric: tabular-nums;
  }

  .episode-details {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-status {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: none;
    margin-left: auto;
    font-weight: 700;
  }

  .entry-synced {
    color: var(--color-primary);
  }

  .entry-pending {
    color: var(--color-secondary);
  }

  .entry-stored {
    color: var(--color-on-surface-variant);
  }

  /* Footer */

  .notice {
    color: var(--color-on-surface-variant);
    font-size: var(--text-label-md-size);
    line-height: var(--text-label-md-line);
  }

  .notice:empty {
    display: none;
  }

  .notice-error {
    color: var(--color-error);
  }

  .bottom {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-height: 44px;
    padding-top: var(--space-sm);
    border-top: 1px solid rgb(49 53 62 / 0.6);
  }

  .web-link {
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: var(--text-label-md-size);
    font-weight: 700;
    text-decoration: none;
  }

  .web-link:hover {
    color: var(--color-primary-fixed);
    text-decoration: underline;
  }

  .tools {
    display: flex;
    margin-left: auto;
  }



  .confirm-text {
    flex: 1;
    font-size: var(--text-label-md-size);
    line-height: var(--text-label-md-line);
    font-weight: var(--text-label-md-weight);
  }

  .small-button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    min-height: 36px;
    padding: 0 12px;
    border-radius: var(--radius-default);
    background: rgb(255 255 255 / 0.04);
    border: var(--border-ghost);
    font-size: var(--text-label-md-size);
    font-weight: 700;
  }

  .small-button:hover {
    border-color: var(--color-primary);
    background: rgb(6 182 212 / 0.08);
  }

  .danger,
  .danger:hover {
    background: var(--color-error-container);
    border-color: transparent;
    color: var(--color-on-error-container);
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import { api, type Me } from "src/api";
  import { errorText, t } from "src/i18n";
  import { getSettings, isConfigured, type Settings } from "src/settings";
  import { crunchyrollProfile, storage, type CrunchyrollProfile, type ScrapeSummary } from "src/storage";
  import { queueSize, syncState, type SyncState } from "src/sync";

  const POLL_MS = 3000;

  let summary = $state<ScrapeSummary>({ pages: 0, entries: 0, oldest: null, newest: null });
  let scrolling = $state(false);
  let notice = $state<{ text: string; isError: boolean } | null>(null);
  let settings = $state<Settings | null>(null);
  let me = $state<Me | null>(null);
  let sync = $state<SyncState | null>(null);
  let pending = $state(0);
  let profile = $state<CrunchyrollProfile | null>(null);

  const configured = $derived(settings !== null && isConfigured(settings));
  const lastSyncAt = $derived(me?.lastSyncAt ?? sync?.lastImport?.acceptedAt ?? null);

  const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "");
  const formatTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "");

  const refreshSummary = async () => (summary = await storage.getSummary());
  const refreshSync = async () => {
    sync = await syncState.get();
    pending = await queueSize();
  };
  const refreshProfile = async () => (profile = await crunchyrollProfile.get());

  // Resolves to null when the active tab has no content script to answer.
  const sendToActiveTab = (message: string): Promise<any> =>
    new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id!, { message }, (response) => {
          resolve(chrome.runtime.lastError ? null : response);
        });
      });
    });

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
    refreshSummary();
    refreshSync();
    refreshProfile();
    sendToActiveTab("SCROLL_STATUS").then((status) => (scrolling = status?.scrolling ?? false));
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
    chrome.storage.onChanged.addListener(onStorageChanged);
    chrome.runtime.onMessage.addListener(onMessage);
    const poll = setInterval(pollLastImport, POLL_MS);

    return () => {
      chrome.storage.onChanged.removeListener(onStorageChanged);
      chrome.runtime.onMessage.removeListener(onMessage);
      clearInterval(poll);
    };
  });

  async function scrap() {
    const response = await sendToActiveTab("SCROLL_DOWN");
    if (!response) {
      notice = { text: t("err_reload_tab"), isError: true };
      return;
    }
    notice = response.ok === false ? { text: errorText(response.error), isError: true } : null;
    scrolling = response.scrolling ?? false;
  }

  async function stop() {
    await sendToActiveTab("SCROLL_STOP");
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

  async function clear() {
    if (!confirm(t("confirm_clear", summary.entries))) return;
    await storage.clear();
    refreshSummary();
  }
</script>

<div class="container">
  <header>
    {#if me}
      <span>{t("signed_in_as", me.displayName)}</span>
      <a href={me.dashboardUrl} target="_blank" rel="noreferrer">{t("open_dashboard")}</a>
    {:else}
      <span class="muted">{configured ? "" : t("sync_off")}</span>
    {/if}
    <button class="link" onclick={() => chrome.runtime.openOptionsPage()}>{t("settings")}</button>
  </header>

  {#if profile}
    <p class="muted">{t("crunchyroll_profile", profile.profileName ?? profile.profileId.slice(0, 8))}</p>
  {/if}
  <p>{t("summary_counts", summary.pages, summary.entries)}</p>
  {#if summary.oldest}
    <p>{t("summary_range", formatDate(summary.oldest), formatDate(summary.newest))}</p>
  {/if}

  {#if configured}
    <p>{lastSyncAt ? t("last_sync", formatTime(lastSyncAt)) : t("never_synced")}</p>
    {#if pending > 0}<p>{t("pending_uploads", pending)}</p>{/if}
    {#if sync?.lastImport}
      {@const lastImport = sync.lastImport}
      <p class="muted">
        {#if lastImport.status === "completed" && lastImport.counts}
          {t("import_completed", lastImport.counts.processed, lastImport.counts.unresolved)}
        {:else if lastImport.status === "failed"}
          {t("import_failed")}
        {:else}
          {t("import_in_progress", lastImport.entriesReceived)}
        {/if}
      </p>
    {/if}
    {#if sync?.lastError}<p class="error">{errorText(sync.lastError.code)}</p>{/if}
  {/if}

  <div class="actions">
    {#if scrolling}
      <button class="stop" onclick={stop}>{t("stop")}</button>
    {:else}
      <button onclick={scrap}>{t("scrap")}</button>
    {/if}
    {#if configured}
      <button onclick={syncStored} disabled={!summary.pages}>{t("sync_stored")}</button>
    {/if}
    <button onclick={download} disabled={!summary.pages}>{t("download_json")}</button>
    <button class="secondary" onclick={clear} disabled={!summary.pages}>{t("clear")}</button>
  </div>
  {#if notice}<p class={notice.isError ? "error" : "muted"}>{notice.text}</p>{/if}
</div>

<style>
  .container {
    min-width: 320px;
  }

  header {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }

  header .link {
    margin-left: auto;
  }

  button {
    border-radius: 2px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
    background-color: #2ecc71;
    color: #ecf0f1;
    transition: background-color 0.3s;
    padding: 5px 10px;
    border: none;
  }

  button:hover,
  button:focus {
    background-color: #27ae60;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  button.link,
  button.link:hover,
  button.link:focus {
    background: none;
    box-shadow: none;
    color: #2980b9;
    padding: 0;
    text-decoration: underline;
    cursor: pointer;
  }

  .stop,
  .stop:hover,
  .stop:focus {
    background-color: #c0392b;
  }

  .secondary,
  .secondary:hover,
  .secondary:focus {
    background-color: #7f8c8d;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .muted {
    color: #7f8c8d;
  }

  .error {
    color: #c0392b;
  }
</style>

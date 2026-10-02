<script lang="ts">
  import { onMount } from "svelte";
  import { storage, type ScrapeSummary } from "src/storage";

  let errorMessage: string = null;
  let scrolling = false;
  let summary: ScrapeSummary = { pages: 0, entries: 0, oldest: null, newest: null };

  const refreshSummary = async () => (summary = await storage.getSummary());

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  // Resolves to null when the active tab has no content script to answer.
  const sendToActiveTab = (message: string): Promise<any> =>
    new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { message }, (response) => {
          resolve(chrome.runtime.lastError ? null : response);
        });
      });
    });

  onMount(async () => {
    refreshSummary();
    scrolling = (await sendToActiveTab("SCROLL_STATUS"))?.scrolling ?? false;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.index) refreshSummary();
  });

  chrome.runtime.onMessage.addListener((request) => {
    if (request.message === "SCROLL_STATE") scrolling = request.scrolling;
  });

  async function scrap() {
    const response = await sendToActiveTab("SCROLL_DOWN");
    if (!response) {
      errorMessage =
        "Open your Crunchyroll history page (reload it if the extension was just updated).";
      return;
    }
    errorMessage = response.ok === false ? response.error : null;
    scrolling = response.scrolling ?? false;
  }

  async function stop() {
    await sendToActiveTab("SCROLL_STOP");
    scrolling = false;
  }

  async function download() {
    const pages = await storage.getPages();
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), pages }, null, 2);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    link.download = `crunchyroll-history-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  }

  async function clear() {
    if (!confirm(`Delete ${summary.entries} scraped entries?`)) return;
    await storage.clear();
    refreshSummary();
  }
</script>

<div class="container">
  <p>Pages: <b>{summary.pages}</b> · Entries: <b>{summary.entries}</b></p>
  {#if summary.oldest}
    <p>From <b>{formatDate(summary.oldest)}</b> to <b>{formatDate(summary.newest)}</b></p>
  {/if}
  <div class="actions">
    {#if scrolling}
      <button class="stop" on:click={stop}>Stop</button>
    {:else}
      <button on:click={scrap}>Scrap</button>
    {/if}
    <button on:click={download} disabled={!summary.pages}>Download JSON</button>
    <button class="secondary" on:click={clear} disabled={!summary.pages}>Clear</button>
  </div>
  {#if errorMessage}<p class="error">{errorMessage}</p>{/if}
</div>

<style>
  .container {
    min-width: 250px;
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
    gap: 6px;
  }

  .error {
    color: #c0392b;
  }
</style>

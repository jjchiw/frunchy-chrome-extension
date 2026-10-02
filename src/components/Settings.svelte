<script lang="ts">
  import { onMount } from "svelte";
  import { api, ApiFailure } from "src/api";
  import { errorText, t } from "src/i18n";
  import { DEFAULT_BASE_URL, getSettings, saveSettings, type Settings } from "src/settings";
  import { syncState } from "src/sync";

  let baseUrl = $state(DEFAULT_BASE_URL);
  let syncKey = $state("");
  let saved: Settings | null = null;
  let checking = $state(false);
  let result = $state<{ ok: boolean; text: string } | null>(null);

  onMount(async () => {
    saved = await getSettings();
    baseUrl = saved.baseUrl;
    syncKey = saved.syncKey;
  });

  async function saveAndCheck(event: SubmitEvent) {
    event.preventDefault();
    result = null;

    let origin: string;
    try {
      origin = new URL(baseUrl.trim()).origin;
    } catch {
      result = { ok: false, text: t("err_invalid_url") };
      return;
    }

    // Must run first: Chrome only shows the prompt while the click is fresh.
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) {
      result = { ok: false, text: t("err_permission_denied", origin) };
      return;
    }

    const settings: Settings = { baseUrl: origin, syncKey: syncKey.trim() };
    checking = true;
    try {
      const me = await api.me(settings);
      await saveSettings(settings);
      // A different backend or key is a different Frunchy user: start over.
      if (saved?.baseUrl !== settings.baseUrl || saved?.syncKey !== settings.syncKey) {
        await syncState.update({ marker: null, lastImport: null, lastRejectionAt: null });
      }
      await syncState.update({ lastError: null });
      saved = settings;
      baseUrl = settings.baseUrl;
      chrome.runtime.sendMessage({ message: "SETTINGS_CHANGED" }).catch(() => undefined);
      result = { ok: true, text: t("connected_as", me.displayName) };
    } catch (err) {
      const code = err instanceof ApiFailure ? err.code : "network";
      result = { ok: false, text: errorText(code) };
    } finally {
      checking = false;
    }
  }
</script>

<form class="settings" onsubmit={saveAndCheck}>
  <h1>{t("settings_title")}</h1>
  <label>
    {t("base_url_label")}
    <input type="url" bind:value={baseUrl} required />
  </label>
  <label>
    {t("sync_key_label")}
    <input type="password" bind:value={syncKey} placeholder="frk_…" autocomplete="off" required />
  </label>
  <button type="submit" disabled={checking}>{checking ? t("checking") : t("save_and_check")}</button>
  {#if result}<p class={result.ok ? "success" : "error"}>{result.text}</p>{/if}
</form>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 360px;
    max-width: 480px;
  }

  h1 {
    font-size: 1.2em;
    margin: 0;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  input {
    padding: 5px;
  }

  button {
    align-self: flex-start;
    border-radius: 2px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
    background-color: #2ecc71;
    color: #ecf0f1;
    padding: 5px 10px;
    border: none;
  }

  button:disabled {
    opacity: 0.5;
  }

  .success {
    color: #27ae60;
  }

  .error {
    color: #c0392b;
  }
</style>

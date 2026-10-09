<script lang="ts">
  import { onMount } from "svelte";
  import { api, ApiFailure, webPages } from "src/api";
  import Icon from "src/components/Icon.svelte";
  import { errorText, t } from "src/i18n";
  import { DEFAULT_BASE_URL, getSettings, saveSettings, type Settings } from "src/settings";
  import { syncState } from "src/sync";

  let baseUrl = $state(DEFAULT_BASE_URL);
  let syncKey = $state("");
  let saved: Settings | null = null;
  let checking = $state(false);
  let result = $state<{ ok: boolean; text: string; dashboardUrl?: string } | null>(null);
  let showKey = $state(false);

  // Where to get a key, for whatever backend URL is typed in right now.
  const connectUrl = $derived.by(() => {
    try {
      return webPages.connectExtension(new URL(baseUrl.trim()).origin);
    } catch {
      return null;
    }
  });

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
        await syncState.update({ marker: null, lastImport: null, lastRejectionAt: null, sent: {} });
      }
      await syncState.update({ lastError: null });
      saved = settings;
      baseUrl = settings.baseUrl;
      chrome.runtime.sendMessage({ message: "SETTINGS_CHANGED" }).catch(() => undefined);
      result = { ok: true, text: t("connected_as", me.displayName), dashboardUrl: me.dashboardUrl };
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
  <div class="field">
    <div class="label-row">
      <label class="label" for="base-url">{t("base_url_label")}</label>
      {#if baseUrl.trim() !== DEFAULT_BASE_URL}
        <button type="button" class="link" onclick={() => (baseUrl = DEFAULT_BASE_URL)}>{t("use_default_url")}</button>
      {/if}
    </div>
    <input id="base-url" type="url" bind:value={baseUrl} required />
  </div>
  <div class="field">
    <label class="label" for="sync-key">{t("sync_key_label")}</label>
    <div class="key">
      <input
        id="sync-key"
        type={showKey ? "text" : "password"}
        bind:value={syncKey}
        placeholder="frk_…"
        autocomplete="off"
        spellcheck="false"
        required
        aria-describedby="sync-key-hint"
      />
      <button
        type="button"
        class="reveal"
        aria-pressed={showKey}
        aria-label={t("show_key")}
        title={t("show_key")}
        onclick={() => (showKey = !showKey)}
      >
        <Icon name={showKey ? "visibility_off" : "visibility"} />
      </button>
    </div>
    <span class="hint" id="sync-key-hint">
      {t("sync_key_hint")}
      {#if connectUrl}<a href={connectUrl} target="_blank" rel="noreferrer">{t("open_connect_extension")}</a>{/if}
    </span>
  </div>
  <div class="actions">
    <button type="submit" disabled={checking}>
      <Icon name={checking ? "sync" : "check_circle"} size={18} />{checking ? t("checking") : t("save_and_check")}
    </button>
    <p class="result" class:success={result?.ok} class:error={result && !result.ok} role="status">
      {result?.text ?? ""}
      {#if result?.dashboardUrl}
        <a href={result.dashboardUrl} target="_blank" rel="noreferrer">{t("open_dashboard")}</a>
      {/if}
    </p>
  </div>
</form>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    min-width: 360px;
    max-width: 480px;
    padding: var(--space-lg);
  }

  h1 {
    margin: 0;
    font-size: var(--text-headline-md-size);
    line-height: var(--text-headline-md-line);
    font-weight: 700;
    letter-spacing: var(--text-headline-md-tracking);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    font-size: var(--text-label-md-size);
    line-height: var(--text-label-md-line);
    font-weight: var(--text-label-md-weight);
    letter-spacing: var(--text-label-md-tracking);
    color: var(--color-on-surface-variant);
  }

  input {
    min-height: 44px;
    padding: 0 12px;
    border-radius: var(--radius-default);
    background: var(--color-surface-container-low);
    border: 1px solid var(--color-outline-variant);
    color: var(--color-on-surface);
    caret-color: var(--color-primary);
    transition: border-color 150ms ease-out;
  }

  input::placeholder {
    color: var(--color-outline);
  }

  input:hover {
    border-color: var(--color-outline);
  }

  input:focus-visible {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }

  .label-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  .link {
    min-height: 0;
    padding: 0;
    border: none;
    background: none;
    color: var(--color-primary);
    font-size: var(--text-label-md-size);
    line-height: var(--text-label-md-line);
    font-weight: var(--text-label-md-weight);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .link:hover:not(:disabled) {
    background: none;
    box-shadow: none;
    color: var(--color-primary-fixed);
  }

  /* The reveal button sits inside the key field's right edge. */
  .key {
    position: relative;
    display: flex;
  }

  .key input {
    flex: 1;
    padding-right: 48px;
  }

  .reveal {
    position: absolute;
    top: 4px;
    right: 4px;
    justify-content: center;
    width: 36px;
    min-height: 36px;
    padding: 0;
    background: transparent;
    color: var(--color-on-surface-variant);
  }

  .reveal:hover:not(:disabled) {
    background: var(--color-surface-container-high);
    box-shadow: none;
    color: var(--color-on-surface);
  }

  .reveal[aria-pressed="true"] {
    color: var(--color-primary);
  }

  .hint {
    color: var(--color-on-surface-variant);
    font-size: var(--text-label-md-size);
    line-height: var(--text-label-md-line);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    min-height: 44px;
    padding: 0 var(--space-md);
    border: none;
    border-radius: var(--radius-default);
    background: var(--color-primary);
    color: var(--color-on-primary);
    font-weight: 700;
    transition:
      box-shadow 200ms ease-out,
      background-color 200ms ease-out;
  }

  button:hover:not(:disabled) {
    background: var(--color-primary-fixed);
    box-shadow: var(--glow-primary);
  }

  button:disabled {
    background: var(--color-surface-container-highest);
    color: var(--color-on-surface-variant);
  }

  .result {
    margin: 0;
    flex: 1;
    min-width: 12em;
    font-size: var(--text-label-md-size);
    line-height: var(--text-label-md-line);
  }

  .result:empty {
    display: none;
  }

  .success {
    color: var(--color-primary);
  }

  .error {
    color: var(--color-error);
  }
</style>

export type Settings = { baseUrl: string; syncKey: string };

export const DEFAULT_BASE_URL = "http://localhost:5099";

// Kept in storage.local, not sync: the key shouldn't follow the user to other
// Chrome profiles they sign into.
export const getSettings = async (): Promise<Settings> => ({
  baseUrl: DEFAULT_BASE_URL,
  syncKey: "",
  ...((await chrome.storage.local.get("settings")).settings as Partial<Settings> | undefined),
});

export const saveSettings = (settings: Settings): Promise<void> =>
  chrome.storage.local.set({ settings });

export const isConfigured = (settings: Settings) => settings.syncKey.trim() !== "";

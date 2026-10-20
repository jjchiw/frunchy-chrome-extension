export type Settings = { baseUrl: string; syncKey: string };

export const DEFAULT_BASE_URL = __BACKEND_URL__;

// The store build talks only to its own backend: no backend URL field, and a
// stored URL is ignored.
export const FIXED_BACKEND = __STORE_BUILD__;

// Kept in storage.local, not sync: the key shouldn't follow the user to other
// Chrome profiles they sign into.
export const getSettings = async (): Promise<Settings> => {
  const settings: Settings = {
    baseUrl: DEFAULT_BASE_URL,
    syncKey: "",
    ...((await chrome.storage.local.get("settings")).settings as Partial<Settings> | undefined),
  };
  return FIXED_BACKEND ? { ...settings, baseUrl: DEFAULT_BASE_URL } : settings;
};

export const saveSettings = (settings: Settings): Promise<void> =>
  chrome.storage.local.set({ settings });

export const isConfigured = (settings: Settings) => settings.syncKey.trim() !== "";

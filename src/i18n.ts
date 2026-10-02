// Strings live in public/_locales/<lang>/messages.json; Chrome picks the
// browser's language and falls back to English.

export const t = (key: string, ...substitutions: (string | number)[]) =>
  chrome.i18n.getMessage(key, substitutions.map(String)) || key;

// Maps an error code (backend, ApiFailure or content script) to localized text.
export const errorText = (code: string) =>
  chrome.i18n.getMessage(`err_${code}`) || t("err_unknown", code);

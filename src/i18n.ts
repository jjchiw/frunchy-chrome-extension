// Strings live in public/_locales/<lang>/messages.json; Chrome picks the
// browser's language and falls back to English.

export const t = (key: string, ...substitutions: (string | number)[]) =>
  chrome.i18n.getMessage(key, substitutions.map(String)) || key;

// Maps an error code (backend, ApiFailure or content script) to localized text.
export const errorText = (code: string) =>
  chrome.i18n.getMessage(`err_${code}`) || t("err_unknown", code);

const locale = chrome.i18n.getUILanguage();

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });

const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

// "3 hours ago" / "hace 3 horas"; under a minute reads as "now".
export const formatRelative = (iso: string) => {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  for (const [unit, size] of relativeUnits) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, "second");
};

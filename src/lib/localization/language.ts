import { tryLocalStorageGetItem, tryLocalStorageSetItem } from "../storage-environment";
import { getDesktopApi } from "../desktop-api";
import { localization, type GameLocale, type LanguagePreference } from "./runtime";
import languages from "./locales/languages.json";

const STORAGE_KEY = "alchemy-language-v1";
const steamLocales: Record<string, string> = Object.fromEntries(
  Object.entries(languages).map(([locale, { steam }]) => [steam, locale]),
);
export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: LanguagePreference; label: string; native?: boolean }> = [
  { value: "auto", label: "Automatic" },
  ...Object.entries(languages).map(([value, language]) => ({
    value: value as GameLocale,
    label: language.name,
    native: true,
  })),
  ...(import.meta.env.DEV ? [{ value: "en-XA" as const, label: "Expanded English (test)" }] : []),
];
export function resolveLocale(
  preference: LanguagePreference,
  steam: string | null,
  system: readonly string[],
): GameLocale {
  if (preference !== "auto") return preference;
  const candidates = steam ? [Object.hasOwn(steamLocales, steam) ? steamLocales[steam]! : steam] : system;
  for (const candidate of candidates) {
    const code = candidate.toLowerCase();
    for (const locale of ["en", "de", "ru", "ja", "fr"] as const)
      if (code === locale || code.startsWith(locale + "-")) return locale;
    if (code === "zh" || /^(zh-hans|zh-cn|zh-sg)(-|$)/.test(code)) return "zh-Hans";
    if (code === "es" || /^es-es(-|$)/.test(code)) return "es";
    if (/^pt-br(-|$)/.test(code)) return "pt-BR";
  }
  return "en";
}
let preference: LanguagePreference = "auto";
let steamLanguage: string | null = null;
let revision = 0;
let initialization = 0;
const listeners = new Set<() => void>();
export const languagePreference = () => preference;
export const subscribeLanguage = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function applyLanguage(): void {
  const locale = resolveLocale(preference, steamLanguage, typeof navigator === "undefined" ? [] : navigator.languages);
  void localization.changeLanguage(locale);
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale === "en-XA" ? "en" : locale;
    document.documentElement.dir = "ltr";
  }
  for (const listener of listeners) listener();
}
export function setLanguagePreference(value: LanguagePreference): void {
  if (!LANGUAGE_OPTIONS.some((option) => option.value === value)) return;
  preference = value;
  revision++;
  try {
    tryLocalStorageSetItem(STORAGE_KEY, value);
  } catch {
    /* In-memory preferences still work. */
  }
  applyLanguage();
}
export async function initializeLanguage(): Promise<void> {
  const requestRevision = ++revision;
  const requestInitialization = ++initialization;
  try {
    const stored = tryLocalStorageGetItem(STORAGE_KEY);
    const saved = stored.ok ? stored.value : null;
    if (LANGUAGE_OPTIONS.some((option) => option.value === saved)) preference = saved as LanguagePreference;
  } catch {
    /* Storage can be unavailable in private profiles. */
  }
  applyLanguage();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let detectedLanguage: string | null;
  try {
    detectedLanguage = await Promise.race([
      getDesktopApi()?.steamGetGameLanguage?.() ?? Promise.resolve(null),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), 1500);
      }),
    ]);
  } catch {
    detectedLanguage = null;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
  if (requestInitialization !== initialization) return;
  steamLanguage = detectedLanguage;
  if (requestRevision === revision) applyLanguage();
}

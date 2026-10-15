import { tryLocalStorageGetItem, tryLocalStorageSetItem } from "../storage-environment";
import { getDesktopApi } from "../desktop-api";
import { localization, type GameLocale, type LanguagePreference } from "./runtime";

const STORAGE_KEY = "alchemy-language-v1";
const steamLocales: Record<string, string> = {
  english: "en",
  german: "de",
  french: "fr",
  italian: "it",
  spanish: "es",
  latam: "es-419",
  brazilian: "pt-BR",
  portuguese: "pt-PT",
  schinese: "zh-Hans",
  tchinese: "zh-Hant",
  japanese: "ja",
  koreana: "ko",
  russian: "ru",
  polish: "pl",
  ukrainian: "uk",
  arabic: "ar",
  bulgarian: "bg",
  czech: "cs",
  danish: "da",
  dutch: "nl",
  finnish: "fi",
  greek: "el",
  hungarian: "hu",
  indonesian: "id",
  malay: "ms",
  norwegian: "nb",
  romanian: "ro",
  swedish: "sv",
  thai: "th",
  turkish: "tr",
  vietnamese: "vi",
};
export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: LanguagePreference; label: string; native?: boolean }> = [
  { value: "auto", label: "Automatic" },
  { value: "en", label: "English", native: true },
  { value: "de", label: "Deutsch", native: true },
  ...(import.meta.env.DEV
    ? [
        { value: "en-XA" as const, label: "Expanded English (test)" },
        { value: "zh-Hans" as const, label: "简体中文（字体测试）", native: true },
      ]
    : []),
];
export function resolveLocale(
  preference: LanguagePreference,
  steam: string | null,
  system: readonly string[],
): GameLocale {
  if (preference !== "auto") return preference;
  const candidates = steam ? [steamLocales[steam] ?? steam] : system;
  for (const candidate of candidates) {
    if (candidate === "de" || candidate.startsWith("de-")) return "de";
    if (candidate === "en" || candidate.startsWith("en-")) return "en";
  }
  return "en";
}
let preference: LanguagePreference = "auto";
let steamLanguage: string | null = null;
let revision = 0;
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
  try {
    const stored = tryLocalStorageGetItem(STORAGE_KEY);
    const saved = stored.ok ? stored.value : null;
    if (LANGUAGE_OPTIONS.some((option) => option.value === saved)) preference = saved as LanguagePreference;
  } catch {
    /* Storage can be unavailable in private profiles. */
  }
  applyLanguage();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    steamLanguage = await Promise.race([
      getDesktopApi()?.steamGetGameLanguage?.() ?? Promise.resolve(null),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), 1500);
      }),
    ]);
  } catch {
    steamLanguage = null;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
  if (requestRevision === revision) applyLanguage();
}

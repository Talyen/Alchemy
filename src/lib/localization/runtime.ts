import { buildDescriptionMessage } from "@/lib/game-data";
import i18next from "i18next";
import extraMessages from "./extra-messages.json";
export const localization = i18next.createInstance();
let source: Record<string, string> = {};
let sourceIds = new Map<string, string>();
const englishDefaults: Record<string, string> = {};
for (const [id, message] of Object.entries(
  extraMessages as Record<string, { text: string; forms?: Record<string, string> }>,
)) {
  englishDefaults[id] = message.text;
  for (const [category, value] of Object.entries(message.forms ?? {})) englishDefaults[`${id}_${category}`] = value;
}
void localization.init({
  lng: "en",
  fallbackLng: "en",
  resources: { en: { translation: englishDefaults } },
  initAsync: false,
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export function installCatalogs(catalogs: Record<string, Record<string, string>>): void {
  source = catalogs.en ?? {};
  sourceIds = new Map(Object.entries(source).map(([id, value]) => [value, id]));
  for (const [locale, entries] of Object.entries(catalogs))
    localization.addResourceBundle(locale, "translation", entries, false, true);
}

export type GameLocale = "en" | "de" | "en-XA" | "zh-Hans";
export type LanguagePreference = "auto" | GameLocale;

/** Leave named parameters and semantic markup intact while expanding text. */
export function pseudolocalize(value: string): string {
  if (!/[a-zA-Z]/.test(value.replace(/{{.*?}}|<[^>]+>/g, ""))) return value;
  const accents: Record<string, string> = {
    a: "á",
    e: "ë",
    i: "ï",
    o: "ô",
    u: "ü",
    A: "Á",
    E: "Ë",
    I: "Ï",
    O: "Ô",
    U: "Ü",
  };
  return `[${value
    .split(/({{.*?}}|<[^>]+>)/g)
    .map((part) =>
      part.startsWith("{{") || part.startsWith("<")
        ? part
        : part.replace(/[aeiouAEIOU]/g, (letter) => `${accents[letter]}${accents[letter]}`),
    )
    .join("")}]`;
}

export function text(id: string, defaultValue: string, values: Record<string, string | number> = {}): string {
  const key = Object.hasOwn(source, id) ? id : (sourceIds.get(defaultValue) ?? id);
  if (localization.language === "en-XA") {
    const form: unknown =
      typeof values.count === "number"
        ? localization.getResource("en", "translation", `${key}_${new Intl.PluralRules("en").select(values.count)}`)
        : undefined;
    return pseudolocalize(typeof form === "string" ? form : defaultValue).replace(
      /{{\s*(\w+)\s*}}/g,
      (match, key: string) => String(values[key] ?? match),
    );
  }
  return localization.t(key, {
    defaultValue,
    ...values,
  });
}

/** Catalog text is looked up only at rendering boundaries, never mutated. */
export function displayText<T>(value: T): T {
  if (typeof value !== "string" || localization.language === "en") return value;
  const id = sourceIds.get(value);
  if (id) return text(id, value) as T;
  const message = buildDescriptionMessage([{ text: value }]);
  if (Object.hasOwn(source, message.id))
    return text(message.id, message.template, message.values).replace(/<[^>]+>/g, "") as T;
  return (
    localization.language === "en-XA" && /[a-zA-Z]{2}/.test(value) && !value.startsWith("[")
      ? pseudolocalize(value)
      : value
  ) as T;
}

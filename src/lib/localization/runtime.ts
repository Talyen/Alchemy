import { pseudolocalize } from "./pseudolocalize";
export { pseudolocalize } from "./pseudolocalize";
import { buildDescriptionMessage } from "@/lib/game-data";
import i18next from "i18next";
import extraMessages from "./extra-messages.json";
import type languages from "./locales/languages.json";
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

export type GameLocale = keyof typeof languages | "en-XA";
export type LanguagePreference = "auto" | GameLocale;

function translateMessage(
  id: string,
  defaultValue: string,
  values: Record<string, string | number> = {},
  locale = localization.language,
  translate = localization.t,
): string {
  const key = Object.hasOwn(source, id) ? id : (sourceIds.get(defaultValue) ?? id);
  if (locale === "en-XA") {
    const form: unknown =
      typeof values.count === "number"
        ? localization.getResource("en", "translation", `${key}_${new Intl.PluralRules("en").select(values.count)}`)
        : undefined;
    return pseudolocalize(typeof form === "string" ? form : defaultValue).replace(
      /{{\s*(\w+)\s*}}/g,
      (match, key: string) => String(values[key] ?? match),
    );
  }
  return translate(key, {
    lng: locale,
    defaultValue,
    ...values,
  });
}

/** Catalog text is looked up only at rendering boundaries, never mutated. */
function translateDisplayText<T>(value: T, locale: string, translate: typeof localization.t): T {
  if (typeof value !== "string" || locale === "en") return value;
  const id = sourceIds.get(value);
  if (id) return translateMessage(id, value, {}, locale, translate) as T;
  const message = buildDescriptionMessage([{ text: value }]);
  if (Object.hasOwn(source, message.id))
    return translateMessage(message.id, message.template, message.values, locale, translate).replace(
      /<[^>]+>/g,
      "",
    ) as T;
  return (
    locale === "en-XA" && /[a-zA-Z]{2}/.test(value) && !value.startsWith("[") ? pseudolocalize(value) : value
  ) as T;
}

/** Keep the unary callback contract used by catalog searches and array maps. */
export function displayText<T>(value: T): T {
  return translateDisplayText(value, localization.language, localization.t);
}

export function text(id: string, english: string, values: Record<string, string | number> = {}): string {
  return translateMessage(id, english, values, localization.language, localization.t);
}

export function createTranslationReader(translate: typeof localization.t) {
  const locale = localization.language;
  return {
    locale,
    text: (id: string, english: string, values: Record<string, string | number> = {}) =>
      translateMessage(id, english, values, locale, translate),
    displayText: <T>(value: T): T => translateDisplayText(value, locale, translate),
    read: <T>(reader: (locale: string) => T): T => reader(locale),
  };
}

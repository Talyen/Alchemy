/**
 * Bundled format: canonical messages once, shared aliases once, no review metadata.
 * @param {import("./catalog-format.mjs").Catalogs} catalogs
 * @param {Record<string, { aliasOf?: string, values?: Record<string, string | number> }>} source
 * @returns {import("./catalog-format.mjs").PackedCatalogs}
 */
export function packCatalogs(catalogs, source) {
  const languages = Object.keys(catalogs);
  /** @type {Record<string, import("./catalog-format.mjs").CatalogAlias>} */
  const aliases = {};
  /** @type {Record<string, Array<string | null>>} */
  const messages = {};
  const ids = [...new Set(Object.values(catalogs).flatMap((entries) => Object.keys(entries)))].sort();
  for (const id of ids) {
    const message = Object.hasOwn(source, id) ? source[id] : undefined;
    if (message?.aliasOf) {
      const parent = catalogs.en?.[message.aliasOf];
      if (typeof parent !== "string") throw new Error(`Missing English alias target: ${message.aliasOf}`);
      const derived = aliasText(parent, message.values);
      aliases[id] = {
        id: message.aliasOf,
        ...(message.values === undefined ? {} : { values: message.values }),
        ...(derived === catalogs.en[id] ? {} : { english: catalogs.en[id] }),
      };
    } else messages[id] = languages.map((locale) => catalogs[locale][id] ?? null);
  }
  return { version: 1, languages, messages, aliases };
}

/** @param {string} text @param {Record<string, string | number> | undefined} values */
function aliasText(text, values) {
  /** @param {string} match @param {string} name */
  const interpolate = (match, name) => String(values && Object.hasOwn(values, name) ? values[name] : match);
  return values === undefined ? text : text.replace(/<[^>]+>/g, "").replace(/{{\s*(\w+)\s*}}/g, interpolate);
}
/** @param {unknown} value @returns {value is Record<string, unknown>} */
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** @param {unknown} value @returns {asserts value is import("./catalog-format.mjs").PackedCatalogs} */
function validatePackedCatalogs(value) {
  if (
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.languages) ||
    !record(value.messages) ||
    !record(value.aliases)
  )
    throw new Error("Invalid bundled localization format");
  const { languages, messages, aliases } = value;
  if (
    !languages.length ||
    languages.some((locale) => typeof locale !== "string" || !/^[a-z]{2,3}(?:-[A-Za-z]+)*$/.test(locale)) ||
    new Set(languages).size !== languages.length ||
    !languages.includes("en") ||
    !Object.keys(messages).length
  )
    throw new Error("Invalid bundled localization languages");
  for (const [id, row] of Object.entries(messages))
    if (
      !id ||
      Object.hasOwn(aliases, id) ||
      !Array.isArray(row) ||
      row.length !== languages.length ||
      row.some((text) => text !== null && (typeof text !== "string" || !text.trim()))
    )
      throw new Error(`Invalid bundled localization message: ${id}`);
  for (const [id, alias] of Object.entries(aliases))
    if (
      !id ||
      !record(alias) ||
      typeof alias.id !== "string" ||
      (alias.english !== undefined && (typeof alias.english !== "string" || !alias.english.trim())) ||
      (alias.values !== undefined &&
        (!record(alias.values) ||
          Object.values(alias.values).some(
            (value) => typeof value !== "string" && (typeof value !== "number" || !Number.isFinite(value)),
          )))
    )
      throw new Error(`Invalid bundled localization alias: ${id}`);
}

/**
 * Validate before installing anything; malformed assets keep the English boot fallback.
 * @param {unknown} value
 * @returns {import("./catalog-format.mjs").Catalogs}
 */
export function unpackCatalogs(value) {
  validatePackedCatalogs(value);
  const { languages, messages, aliases } = value;
  return Object.fromEntries(
    languages.map((locale, index) => {
      /** @type {Map<string, string>} */
      const entries = new Map();
      for (const [id, row] of Object.entries(messages)) {
        const text = row[index];
        if (typeof text === "string") entries.set(id, text);
      }
      /** @type {Set<string>} */
      const visiting = new Set();
      /** @type {Set<string>} */
      const resolved = new Set();
      /** @param {string} id @returns {string | undefined} */
      function resolve(id) {
        if (entries.has(id) || resolved.has(id)) return entries.get(id);
        if (!Object.hasOwn(aliases, id)) {
          if (!Object.hasOwn(messages, id)) throw new Error(`Missing bundled localization alias target: ${id}`);
          return undefined;
        }
        if (visiting.has(id)) throw new Error(`Circular bundled localization alias: ${id}`);
        visiting.add(id);
        const alias = aliases[id];
        const parent = resolve(alias.id);
        visiting.delete(id);
        resolved.add(id);
        const text =
          locale === "en" && alias.english !== undefined
            ? alias.english
            : parent === undefined
              ? undefined
              : aliasText(parent, alias.values);
        if (text !== undefined) entries.set(id, text);
        return text;
      }
      for (const id of Object.keys(aliases)) resolve(id);
      return [locale, Object.fromEntries(entries)];
    }),
  );
}

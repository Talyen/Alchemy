import crypto from "node:crypto";
import languages from "../../src/lib/localization/locales/languages.json" with { type: "json" };

export const INSTRUCTIONS =
  "alchemy-localization-v1: translate complete messages; preserve meaning, negation, conditions, named parameters and semantic tags; use glossary consistently with grammatical inflection; review before apply";
export const TARGETS = Object.keys(languages).filter((locale) => locale !== "en");
export const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const ordered = (value) =>
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const parameters = (value) => [...value.matchAll(/{{\s*([a-zA-Z][\w]*)\s*}}/g)].map((m) => m[1]).sort();
export function tags(value) {
  const stack = [];
  const result = [];
  for (const match of value.matchAll(/<([^>]+)>/g)) {
    if (!/^\/?[a-zA-Z][\w]*\/?$/.test(match[1]))
      throw new Error("Only named semantic tags without attributes are allowed");
    const name = match[1].replace(/^\//, "").replace(/\/$/, "");
    if (match[1].startsWith("/")) {
      if (stack.pop() !== name) throw new Error("Unbalanced semantic tags");
    } else {
      result.push(name);
      if (!match[1].endsWith("/")) stack.push(name);
    }
  }
  if (stack.length) throw new Error("Unclosed semantic tags");
  if (value.replace(/<[^>]+>/g, "").includes("<")) throw new Error("Invalid semantic tag");
  return result.sort();
}
export function relatedTerms(text, terms, aliases = []) {
  return [...terms].sort().filter((term) => {
    const keyword = aliases.find((alias) => alias.match.toLowerCase() === term.toLowerCase())?.keywordId;
    const plural = /[sxz]$|[cs]h$/i.test(term) ? `${term}es` : `${term}s`;
    const words = [
      term,
      plural,
      ...(term.endsWith("s") ? [term.slice(0, -1)] : []),
      ...(keyword ? aliases.filter((alias) => alias.keywordId === keyword).map((alias) => alias.match) : []),
    ];
    return words.some((word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
  });
}

export function sourceHash(message, glossary, locale) {
  const terms = Object.fromEntries((message.terms ?? []).map((term) => [term, glossary[term] ?? null]));
  return digest({ message, terms, locale, instructions: INSTRUCTIONS });
}
function slotContracts(value) {
  const contracts = {};
  const stack = [];
  for (const part of value.split(/(<[^>]+>)/g)) {
    if (part.startsWith("</")) stack.pop();
    else if (part.startsWith("<")) {
      const name = part.replace(/[<>/]/g, "");
      const entry = { selfClosing: part.endsWith("/>"), parameters: [] };
      (contracts[name] ??= []).push(entry);
      if (!entry.selfClosing) stack.push(entry);
    } else for (const entry of stack) entry.parameters.push(...parameters(part));
  }
  return ordered(
    Object.fromEntries(
      Object.entries(contracts).map(([name, entries]) => [
        name,
        entries.map((entry) => ({ ...entry, parameters: entry.parameters.sort() })),
      ]),
    ),
  );
}

export function validateTranslation(message, value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Empty translation");
  if (JSON.stringify(parameters(value)) !== JSON.stringify(parameters(message.text)))
    throw new Error("Named parameters differ");
  if (JSON.stringify(tags(value)) !== JSON.stringify(tags(message.text))) throw new Error("Semantic tags differ");
  if (JSON.stringify(slotContracts(value)) !== JSON.stringify(slotContracts(message.text)))
    throw new Error("Parameters moved outside their semantic slots");
  const numbers = (text) =>
    (text.replace(/{{[^}]+}}|<[^>]+>/g, "").match(/\d+(?:[.,]\d+)?/g) ?? [])
      .map((value) => value.replace(",", "."))
      .sort();
  if (JSON.stringify(numbers(value)) !== JSON.stringify(numbers(message.text)))
    throw new Error("Literal quantities differ");
  const steamSlots = (text) => [...text.matchAll(/\{#[^}]+\}|%[a-zA-Z_]+%/g)].map((match) => match[0]).sort();
  if (JSON.stringify(steamSlots(message.text)) !== JSON.stringify(steamSlots(value)))
    throw new Error("Steam presence tokens differ");
  if (/{{|}}/.test(value.replace(/{{\s*[a-zA-Z][\w]*\s*}}/g, ""))) throw new Error("Malformed parameter");
}
export function validatePluralForms(message, result, locale) {
  if (!message.plural) {
    if (result.forms !== undefined) throw new Error("Plural forms require an English plural definition");
    return;
  }
  const required = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
  if (!result.forms || required.some((category) => typeof result.forms[category] !== "string"))
    throw new Error("Missing required plural forms");
  if (Object.keys(result.forms).some((category) => !required.includes(category)))
    throw new Error("Unknown plural category");
  for (const value of Object.values(result.forms)) validateTranslation(message, value);
  if (result.text !== result.forms.other) throw new Error("Default translation must match the other plural form");
}

export function validateResults({ messages, glossary, locale, results, previous = {} }) {
  if (!TARGETS.includes(locale)) throw new Error(`Unsupported translation target: ${locale}`);
  const next = { ...previous };
  for (const [id, result] of Object.entries(results)) {
    const message = messages[id];
    if (!message) throw new Error(`Unknown message: ${id}`);
    if (message.aliasOf) throw new Error(`Derived translation must use its canonical message: ${id}`);
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new Error(`Invalid translation result: ${id}`);
    if (result.sourceHash !== sourceHash(message, glossary, locale)) throw new Error(`Outdated translation: ${id}`);
    if (result.reviewed !== true) throw new Error(`Translation has not been reviewed: ${id}`);
    try {
      validateTranslation(message, result.text);
      validatePluralForms(message, result, locale);
    } catch (error) {
      throw new Error(`${id}: ${error.message}`, { cause: error });
    }
    next[id] = {
      text: result.text,
      sourceHash: result.sourceHash,
      reviewed: true,
      ...(result.forms ? { forms: ordered(result.forms) } : {}),
    };
  }
  return ordered(
    Object.fromEntries(Object.entries(next).filter(([id]) => Object.hasOwn(messages, id) && !messages[id].aliasOf)),
  );
}

export function resolveAliases(messages, entries, glossary, locale) {
  const result = { ...entries };
  const resolving = new Set();
  function resolve(id) {
    const message = messages[id];
    if (!message?.aliasOf) return result[id];
    if (resolving.has(id)) throw new Error(`Circular localization alias: ${id}`);
    resolving.add(id);
    const parent = resolve(message.aliasOf);
    resolving.delete(id);
    if (!parent || parent.sourceHash !== sourceHash(messages[message.aliasOf], glossary, locale)) {
      delete result[id];
      return undefined;
    }
    const text =
      message.values === undefined
        ? parent.text
        : parent.text
            .replace(/<[^>]+>/g, "")
            .replace(/{{\s*(\w+)\s*}}/g, (match, name) => String(message.values?.[name] ?? match));
    result[id] = { text, sourceHash: sourceHash(message, glossary, locale), reviewed: parent.reviewed };
    return result[id];
  }
  for (const id of Object.keys(messages)) resolve(id);
  return ordered(result);
}

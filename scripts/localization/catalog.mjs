import crypto from "node:crypto";
import languages from "../../src/lib/localization/locales/languages.json" with { type: "json" };

const INSTRUCTIONS =
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

export function translationPackets({ messages, glossary, catalogs }, drafts = []) {
  const saved = new Map();
  for (const packet of Array.isArray(drafts) ? drafts : [drafts]) {
    if (!packet || !TARGETS.includes(packet.locale) || saved.has(packet.locale))
      throw new Error("Invalid or duplicate draft locale; existing packet preserved");
    if (!packet.results || typeof packet.results !== "object" || Array.isArray(packet.results))
      throw new Error("Expected draft results keyed by message ID; existing packet preserved");
    saved.set(
      packet.locale,
      Object.fromEntries(
        Object.entries(packet.results).map(([id, result]) => [
          id,
          typeof result === "string" || (result && !Object.hasOwn(result, "sourceHash"))
            ? {
                ...(typeof result === "string"
                  ? { text: result }
                  : { ...result, text: result.text ?? result.forms?.other }),
                sourceHash: packet.messages?.[id]?.sourceHash,
                reviewed: false,
              }
            : result,
        ]),
      ),
    );
  }
  return TARGETS.flatMap((locale) => {
    const previous = catalogs[locale] ?? {};
    const pending = Object.entries(messages).filter(
      ([id, message]) =>
        !message.aliasOf &&
        (previous[id]?.sourceHash !== sourceHash(message, glossary[locale], locale) || previous[id]?.reviewed !== true),
    );
    if (!pending.length) return [];
    return [
      {
        locale,
        instructions: INSTRUCTIONS,
        glossary: glossary[locale],
        messages: Object.fromEntries(
          pending.map(([id, message]) => [
            id,
            {
              ...message,
              sourceHash: sourceHash(message, glossary[locale], locale),
              previous: previous[id]?.text ?? null,
            },
          ]),
        ),
        results: Object.fromEntries(
          pending.map(([id, message]) => {
            const draft = saved.get(locale)?.[id];
            const result = {
              text: draft?.text ?? previous[id]?.text ?? "",
              sourceHash: sourceHash(message, glossary[locale], locale),
              reviewed: false,
              ...(message.plural
                ? {
                    forms: Object.fromEntries(
                      new Intl.PluralRules(locale)
                        .resolvedOptions()
                        .pluralCategories.map((category) => [
                          category,
                          (draft ? draft.forms?.[category] : previous[id]?.forms?.[category]) ?? "",
                        ]),
                    ),
                  }
                : {}),
            };
            // Restore mechanical metadata, never carry review across changed
            // English/glossary or incomplete plural forms. Translation stays editable.
            if (message.plural) {
              if (!result.text) result.text = result.forms.other;
              if (!result.forms.other) result.forms.other = result.text;
            }
            if (draft?.sourceHash === result.sourceHash && draft.reviewed === true) {
              try {
                validateTranslation(message, result.text);
                validatePluralForms(message, result, locale);
                result.reviewed = true;
              } catch {
                // Preserve the draft for repair without claiming it is reviewed.
              }
            }
            return [id, result];
          }),
        ),
      },
    ];
  });
}

// Editable packets carry freshness in their generated message context. Authors
// edit only strings/forms; the explicit reviewed option attests the separate
// semantic pass, never a machine assessment of translation quality.
export function editableTranslationPackets(packets) {
  return packets.map((packet) => ({
    ...packet,
    glossary: Object.fromEntries(
      Object.entries(packet.glossary).filter(([term]) =>
        Object.values(packet.messages).some((message) => message.terms?.includes(term)),
      ),
    ),
    results: Object.fromEntries(
      Object.entries(packet.results).map(([id, result]) => [id, result.forms ? { forms: result.forms } : result.text]),
    ),
  }));
}

// This checks packet identity and structure only; review is a separate human or agent judgment.
export function inspectTranslationPacket(input, context) {
  const expected = translationPackets(context);
  const packets = Array.isArray(input) ? input : [input];
  const identities = (items) =>
    items
      .flatMap((packet) =>
        Object.entries(packet?.messages ?? {}).map(([id, message]) => `${packet.locale}\0${id}\0${message.sourceHash}`),
      )
      .sort();
  const pending = expected.reduce((count, packet) => count + Object.keys(packet.messages).length, 0);
  if (JSON.stringify(identities(packets)) !== JSON.stringify(identities(expected)))
    return {
      pending,
      state: "stale",
      detail: "Pending messages or English/glossary context changed; prepare the packet again.",
    };
  try {
    for (const packet of packets) {
      if (
        JSON.stringify(Object.keys(packet.messages ?? {}).sort()) !==
        JSON.stringify(Object.keys(packet.results ?? {}).sort())
      )
        throw new Error("Results must include exactly the prepared messages");
    }
    validateBatch(packets, context, { reviewed: true });
  } catch (error) {
    return { pending, state: "incomplete", detail: error.message };
  }
  return {
    pending,
    state: pending ? "ready-for-review" : "empty",
    detail: "Semantic review and catalog freshness are not established by packet status.",
  };
}

export function validateBatch(input, { messages, glossary, catalogs }, { reviewed = false } = {}) {
  const packets = Array.isArray(input) ? input : [input];
  const next = {};
  for (const packet of packets) {
    if (!packet || typeof packet !== "object" || !TARGETS.includes(packet.locale))
      throw new Error("Unsupported translation locale");
    const { locale, results } = packet;
    if (Object.hasOwn(next, locale)) throw new Error(`Duplicate translation locale: ${locale}`);
    if (!results || typeof results !== "object" || Array.isArray(results))
      throw new Error("Expected results keyed by message ID");
    next[locale] = validateResults({
      messages,
      glossary: glossary[locale],
      locale,
      results: Object.fromEntries(
        Object.entries(results).map(([id, result]) => {
          const editable = typeof result === "string" || (result && !Object.hasOwn(result, "sourceHash"));
          if (editable && !packet.messages?.[id]?.sourceHash) throw new Error(`Missing prepared source context: ${id}`);
          return [
            id,
            {
              ...(typeof result === "string"
                ? { text: result }
                : { ...result, text: result?.text ?? result?.forms?.other }),
              ...(editable ? { sourceHash: packet.messages[id].sourceHash } : {}),
              ...(reviewed ? { reviewed: true } : {}),
            },
          ];
        }),
      ),
      previous: catalogs[locale],
    });
  }
  return next;
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

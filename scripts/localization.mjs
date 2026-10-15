import { missingGlyphs } from "./localization/font.mjs";
import { format } from "prettier";
import fs from "node:fs";
import path from "node:path";
import languages from "../src/lib/localization/locales/languages.json" with { type: "json" };
import { extractMessages } from "./localization/extract.mjs";
import {
  TARGETS,
  INSTRUCTIONS,
  ordered,
  sourceHash,
  validateResults,
  validateTranslation,
  validatePluralForms,
  resolveAliases,
} from "./localization/catalog.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const directory = path.join(ROOT, "src/lib/localization/locales");
const read = (file) => JSON.parse(fs.readFileSync(path.join(directory, file + ".json"), "utf8"));
const serialize = (value) => JSON.stringify(value, null, 2) + "\n";
// One message per line keeps metadata diffs readable without expanding every field.
const serializeRecords = (value) =>
  "{\n" +
  Object.entries(ordered(value))
    .map(([id, entry]) => `  ${JSON.stringify(id)}: ${JSON.stringify(entry)}`)
    .join(",\n") +
  "\n}\n";
const write = async (file, value) => {
  const destination = path.join(directory, file + ".json");
  const temporary = `${destination}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(
      temporary,
      file === "en" || TARGETS.includes(file)
        ? serializeRecords(value)
        : await format(serialize(value), { parser: "json" }),
    );
    fs.renameSync(temporary, destination);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
};
const command = process.argv[2];
function compiled(messages, glossary) {
  const locales = { en: Object.fromEntries(Object.entries(messages).map(([id, message]) => [id, message.text])) };
  for (const [id, message] of Object.entries(messages)) {
    if (message.plural)
      for (const [category, value] of Object.entries(message.forms)) locales.en[`${id}_${category}`] = value;
  }
  for (const locale of TARGETS) {
    const entries = resolveAliases(messages, read(locale), glossary[locale], locale);
    locales[locale] = Object.fromEntries(
      Object.entries(entries)
        .filter(
          ([id, entry]) =>
            messages[id] &&
            entry.reviewed === true &&
            entry.sourceHash === sourceHash(messages[id], glossary[locale], locale),
        )
        .map(([id, entry]) => [id, entry.text]),
    );
  }
  for (const locale of TARGETS)
    for (const [id, entry] of Object.entries(read(locale))) {
      if (
        messages[id] &&
        entry.reviewed === true &&
        entry.sourceHash === sourceHash(messages[id], glossary[locale], locale) &&
        entry.forms
      )
        for (const [category, value] of Object.entries(entry.forms)) locales[locale][`${id}_${category}`] = value;
    }
  return locales;
}

function steamExports(messages, glossary) {
  const locales = compiled(messages, glossary);
  const store = {};
  const presence = [];
  for (const [locale, { steam: steamLanguage }] of Object.entries(languages)) {
    store[locale] = {};
    const translated = locales[locale];
    const tokens = [];
    for (const [id, message] of Object.entries(messages)) {
      const value = translated[id] ?? message.text;
      if (id.startsWith("steam.presence."))
        tokens.push(`      ${JSON.stringify("#" + id.slice("steam.presence.".length))} ${JSON.stringify(value)}`);
      if (id.startsWith("steam.store.")) {
        const [, , edition, field] = id.split(".");
        (store[locale][edition] ??= {})[field] = value;
      }
    }
    presence.push(`  "${steamLanguage}"\n  {\n    "tokens"\n    {\n${tokens.join("\n")}\n    }\n  }`);
  }
  return { store: serialize(store), presence: `"lang"\n{\n${presence.join("\n")}\n}\n` };
}
function writeSteamExports(messages, glossary) {
  const output = steamExports(messages, glossary);
  fs.writeFileSync(path.join(ROOT, "steam/localized-store-copy.json"), output.store);
  fs.writeFileSync(path.join(ROOT, "steam/rich-presence.vdf"), output.presence);
}

try {
  if (!["extract", "tasks", "apply", "check"].includes(command))
    throw new Error("Usage: localization.mjs extract|tasks|apply <results.json>|check");
  const { messages, issues } = await extractMessages();
  const glossary = read("glossary");
  if (command === "extract") {
    await write("en", messages);
    for (const locale of TARGETS)
      await write(
        locale,
        validateResults({ messages, glossary: glossary[locale], locale, results: {}, previous: read(locale) }),
      );
    await write("runtime", compiled(messages, glossary));
    writeSteamExports(messages, glossary);
    console.log(`Extracted ${Object.keys(messages).length} English messages`);
  } else if (command === "tasks") {
    const packets = TARGETS.map((locale) => {
      const previous = read(locale);
      return {
        locale,
        instructions: INSTRUCTIONS,
        glossary: glossary[locale],
        messages: Object.fromEntries(
          Object.entries(messages)
            .filter(
              ([id, message]) =>
                !message.aliasOf &&
                (previous[id]?.sourceHash !== sourceHash(message, glossary[locale], locale) ||
                  previous[id]?.reviewed !== true),
            )
            .map(([id, message]) => [
              id,
              {
                ...message,
                sourceHash: sourceHash(message, glossary[locale], locale),
                previous: previous[id]?.text ?? null,
              },
            ]),
        ),
      };
    });
    process.stdout.write(serialize(packets));
  } else if (command === "apply") {
    if (!process.argv[3]) throw new Error("A translation result file is required");
    const { locale, results } = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
    if (!TARGETS.includes(locale)) throw new Error("Unsupported translation locale");
    if (!results || typeof results !== "object" || Array.isArray(results))
      throw new Error("Expected results keyed by message ID");
    const next = validateResults({ messages, glossary: glossary[locale], locale, results, previous: read(locale) });
    // Validate the complete result before replacing any catalog.
    await write(locale, next);
    await write("runtime", compiled(messages, glossary));
    writeSteamExports(messages, glossary);
    console.log(`Applied ${Object.keys(results).length} reviewed translations for ${locale}`);
  } else {
    const failures = [...issues];
    const catalogs = compiled(messages, glossary);
    for (const [locale, file, pattern] of [
      ["zh-Hans", "noto-sans-sc.ttf", /[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/gu],
      ["ru", "noto-sans.ttf", /\p{Script=Cyrillic}/gu],
    ]) {
      const glyphs = missingGlyphs(
        fs.readFileSync(path.join(ROOT, "public/fonts", file)),
        JSON.stringify(catalogs[locale]) + JSON.stringify(languages),
        pattern,
      );
      if (glyphs.length) failures.push(`${locale} font lacks: ${glyphs.join("")}`);
    }
    const steam = steamExports(messages, glossary);
    if (
      fs.readFileSync(path.join(ROOT, "steam/localized-store-copy.json"), "utf8") !== steam.store ||
      fs.readFileSync(path.join(ROOT, "steam/rich-presence.vdf"), "utf8") !== steam.presence
    )
      failures.push("Steam localization exports are stale; run npm run i18n:extract");
    if (serialize(read("runtime")) !== serialize(compiled(messages, glossary)))
      failures.push("Runtime catalogs are stale; run npm run i18n:extract");
    if (fs.readFileSync(path.join(directory, "en.json"), "utf8") !== serializeRecords(messages))
      failures.push("English catalog differs from source; run npm run i18n:extract");
    for (const [id, message] of Object.entries(messages)) {
      try {
        validateTranslation(message, message.text);
        if (message.plural) validatePluralForms(message, { text: message.text, forms: message.forms }, "en");
      } catch (error) {
        failures.push(`English: ${id}: ${error.message}`);
      }
    }
    for (const locale of TARGETS) {
      const translations = read(locale);
      const resolved = resolveAliases(messages, translations, glossary[locale], locale);
      if (fs.readFileSync(path.join(directory, `${locale}.json`), "utf8") !== serializeRecords(translations))
        failures.push(`${locale}: catalog record formatting differs; run npm run i18n:extract`);
      for (const [id, message] of Object.entries(messages)) {
        const entry = resolved[id];
        if (!entry || entry.sourceHash !== sourceHash(message, glossary[locale], locale) || entry.reviewed !== true) {
          failures.push(`${locale}: missing/stale/unreviewed ${id}`);
          continue;
        }
        try {
          validateTranslation(message, entry.text);
          validatePluralForms(message, entry, locale);
        } catch (error) {
          failures.push(`${locale}: ${id}: ${error.message}`);
        }
      }
      for (const id of Object.keys(translations))
        if (!Object.hasOwn(messages, id)) failures.push(`${locale}: orphan ${id}`);
        else if (messages[id].aliasOf)
          failures.push(`${locale}: stored derived translation ${id}; run npm run i18n:extract`);
    }
    if (failures.length)
      throw new Error(
        `${failures.length} localization issue(s)\n${failures.slice(0, 12).join("\n")}\nRun npm run i18n:tasks; translate, review and apply the affected entries.`,
      );
    console.log(`Localization: ${Object.keys(messages).length} English messages and ${TARGETS.join(", ")} are current`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

import { packCatalogs, unpackCatalogs } from "../src/lib/localization/catalog-format.mjs";
import { isDeepStrictEqual } from "node:util";
import { missingGlyphs, FONT_REQUIREMENTS, requiredFontText } from "./localization/font.mjs";
import { format } from "prettier";
import fs from "node:fs";
import path from "node:path";
import languages from "../src/lib/localization/locales/languages.json" with { type: "json" };
import promoCopy from "./assets/demo-promo-copy.json" with { type: "json" };
import { extractMessages } from "./localization/extract.mjs";
import {
  TARGETS,
  ordered,
  sourceHash,
  validateResults,
  validateTranslation,
  validatePluralForms,
  resolveAliases,
  translationPackets,
  editableTranslationPackets,
  validateBatch,
  inspectTranslationPacket,
} from "./localization/catalog.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const directory = path.join(ROOT, "src/lib/localization/locales");
const read = (file) => JSON.parse(fs.readFileSync(path.join(directory, file + ".json"), "utf8"));
const serialize = (value) => JSON.stringify(value, null, 2) + "\n";
const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
// One message per line keeps metadata diffs readable without expanding every field.
const serializeRecords = (value) =>
  "{\n" +
  Object.entries(ordered(value))
    .map(([id, entry]) => `  ${JSON.stringify(id)}: ${JSON.stringify(entry)}`)
    .join(",\n") +
  "\n}\n";
const serializeRuntime = (value) =>
  `{
  "version": 1,
  "languages": ${JSON.stringify(value.languages)},
  "messages": ${serializeRecords(value.messages).trimEnd()},
  "aliases": ${serializeRecords(value.aliases).trimEnd()}
}
`;
const runtimeCatalog = (messages, glossary) => packCatalogs(compiled(messages, glossary), messages);
const write = async (file, value) => {
  const destination = path.join(directory, file + ".json");
  const temporary = `${destination}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(
      temporary,
      file === "runtime"
        ? serializeRuntime(value)
        : file === "en" || TARGETS.includes(file)
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
  if (!["extract", "tasks", "apply", "check", "prepare", "finish", "status"].includes(command))
    throw new Error(
      "Usage: localization.mjs prepare [tasks.json]|status [tasks.json]|finish <tasks.json>|extract|tasks|apply <results.json>|check",
    );
  const reviewComplete = process.argv.includes("--reviewed");
  const extra = process.argv.slice(3);
  if (
    extra.some((arg) => arg.startsWith("--") && arg !== "--reviewed") ||
    extra.filter((arg) => !arg.startsWith("--")).length > 1 ||
    (reviewComplete && !["finish", "apply"].includes(command))
  )
    throw new Error("Use prepare [packet.json], or finish <packet.json> --reviewed after semantic review");
  const inputFile = extra.find((arg) => !arg.startsWith("--"));
  if (["finish", "apply"].includes(command) && !inputFile) throw new Error("A translation result file is required");
  if (!["prepare", "finish", "apply", "status"].includes(command) && inputFile)
    throw new Error(`${command} accepts no file argument`);
  const packetFile = path.resolve(inputFile ?? path.join(ROOT, "reports/localization/tasks.json"));
  const savedPacket = command === "prepare" && fs.existsSync(packetFile) ? fs.readFileSync(packetFile, "utf8") : null;
  const drafts = savedPacket === null ? [] : JSON.parse(savedPacket);
  const { messages, issues } = await extractMessages();
  const glossary = read("glossary");
  if (command === "status") {
    const context = {
      messages,
      glossary,
      catalogs: Object.fromEntries(TARGETS.map((locale) => [locale, read(locale)])),
    };
    const pending = translationPackets(context).reduce(
      (count, packet) => count + Object.keys(packet.messages).length,
      0,
    );
    const relativePacket = path.relative(ROOT, packetFile);
    const outsideCheckout =
      relativePacket === ".." || relativePacket.startsWith(`..${path.sep}`) || path.isAbsolute(relativePacket);
    if (!fs.existsSync(packetFile)) {
      console.log(
        `No packet at ${packetFile}; ${pending} pending translations. Run npm run i18n:prepare after wording settles.`,
      );
    } else {
      const result = inspectTranslationPacket(JSON.parse(fs.readFileSync(packetFile, "utf8")), context);
      console.log(
        `Packet: ${packetFile}\nStatus: ${result.state}; ${result.pending} pending translations.\n${result.detail}`,
      );
      if (outsideCheckout)
        console.log(
          "Next: copy this packet into the task checkout before preparing or finishing it; preserve the original evidence.",
        );
      else if (result.state === "stale") console.log(`Next: npm run i18n:prepare -- ${shellQuote(packetFile)}`);
      else if (result.state === "incomplete")
        console.log("Next: complete or repair packet results, then review their meaning.");
      else console.log(`Next: review meaning, then npm run i18n:finish -- ${shellQuote(packetFile)} --reviewed`);
    }
    if (issues.length)
      console.log(`English extraction reported ${issues.length} issue(s); run npm run i18n:check for details.`);
  }
  // Refresh drafts before writing derived catalogs, so malformed packets leave
  // both the working file and catalogs untouched.
  let packets =
    command === "prepare" || command === "tasks"
      ? translationPackets(
          {
            messages,
            glossary,
            catalogs: Object.fromEntries(TARGETS.map((locale) => [locale, read(locale)])),
          },
          drafts,
        )
      : null;
  if (command === "prepare") packets = editableTranslationPackets(packets);
  if (command === "extract" || command === "prepare") {
    await write("en", messages);
    for (const locale of TARGETS)
      await write(
        locale,
        validateResults({ messages, glossary: glossary[locale], locale, results: {}, previous: read(locale) }),
      );
    await write("runtime", runtimeCatalog(messages, glossary));
    writeSteamExports(messages, glossary);
    console.log(`Extracted ${Object.keys(messages).length} English messages`);
    if (command === "prepare") {
      fs.mkdirSync(path.dirname(packetFile), { recursive: true });
      if (savedPacket !== null && savedPacket !== serialize(packets)) {
        const backup = `${packetFile}.${Date.now()}.bak`;
        fs.writeFileSync(backup, savedPacket, { flag: "wx" });
        console.log(`Previous packet preserved: ${backup}`);
      }
      const temporary = `${packetFile}.${process.pid}.tmp`;
      try {
        fs.writeFileSync(temporary, serialize(packets), { flag: "wx" });
        fs.renameSync(temporary, packetFile);
      } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      }
      console.log(
        `${packets.reduce((total, packet) => total + Object.keys(packet.results).length, 0)} pending translations across ${packets.length} locales: ${packetFile}`,
      );
      console.log(
        `Edit only result strings/forms, then review them against the prepared English and glossary. After semantic review run npm run i18n:finish -- ${packetFile} --reviewed`,
      );
    }
  } else if (command === "tasks") {
    process.stdout.write(serialize(packets));
  } else if (command === "apply" || command === "finish") {
    const input = JSON.parse(fs.readFileSync(packetFile, "utf8"));
    const next = validateBatch(
      input,
      {
        messages,
        glossary,
        catalogs: Object.fromEntries(TARGETS.map((locale) => [locale, read(locale)])),
      },
      { reviewed: reviewComplete },
    );
    // Validate every locale before replacing any catalog.
    for (const [locale, entries] of Object.entries(next)) await write(locale, entries);
    await write("runtime", runtimeCatalog(messages, glossary));
    writeSteamExports(messages, glossary);
    console.log(`Applied reviewed translations for ${Object.keys(next).join(", ") || "no pending locales"}`);
    if (command === "finish") checkCatalogs(messages, glossary, issues);
  } else if (command === "check") {
    checkCatalogs(messages, glossary, issues);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

function checkCatalogs(messages, glossary, issues) {
  const failures = [...issues];
  const catalogs = compiled(messages, glossary);
  // These captions are baked into reviewed artwork, so text changes need new art.
  if (!isDeepStrictEqual(Object.keys(promoCopy).sort(), Object.keys(languages).sort()))
    failures.push("Promo artwork languages differ from the shipped registry");
  for (const locale of Object.keys(languages))
    if (promoCopy[locale] !== catalogs[locale]?.["ui.demo-completion-screen.2"])
      failures.push(
        `${locale}: promo artwork copy is stale; regenerate and review its image before updating demo-promo-copy.json`,
      );
  for (const requirement of FONT_REQUIREMENTS) {
    const glyphs = missingGlyphs(
      fs.readFileSync(path.join(ROOT, "public/fonts", requirement.file)),
      requiredFontText(catalogs, languages, requirement),
      requirement.pattern,
    );
    if (glyphs.length) failures.push(`${requirement.locale} font lacks: ${glyphs.join("")}; run npm run i18n:fonts`);
  }
  const steam = steamExports(messages, glossary);
  if (
    fs.readFileSync(path.join(ROOT, "steam/localized-store-copy.json"), "utf8") !== steam.store ||
    fs.readFileSync(path.join(ROOT, "steam/rich-presence.vdf"), "utf8") !== steam.presence
  )
    failures.push("Steam localization exports are stale; run npm run i18n:extract");
  const packed = runtimeCatalog(messages, glossary);
  if (fs.readFileSync(path.join(directory, "runtime.json"), "utf8") !== serializeRuntime(packed))
    failures.push("Runtime catalogs are stale; run npm run i18n:extract");
  if (!isDeepStrictEqual(unpackCatalogs(packed), catalogs))
    failures.push("Packed runtime catalogs differ from expanded messages");
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
      `${failures.length} localization issue(s)\n${failures.slice(0, 12).join("\n")}\nRun npm run i18n:prepare; translate and review its results, then run npm run i18n:finish -- <file>.`,
    );
  console.log(`Localization: ${Object.keys(messages).length} English messages and ${TARGETS.join(", ")} are current`);
}

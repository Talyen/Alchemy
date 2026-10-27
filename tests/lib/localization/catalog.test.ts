import { packCatalogs, unpackCatalogs } from "../../../src/lib/localization/catalog-format.mjs";
import { describe, expect, it } from "vitest";
import {
  sourceHash,
  validateResults,
  resolveAliases,
  relatedTerms,
  TARGETS,
  translationPackets,
  editableTranslationPackets,
  validateBatch,
  inspectTranslationPacket,
} from "../../../scripts/localization/catalog.mjs";

const message = { text: "Deal <damage>{{amount}}</damage> damage", context: "Attack damage", terms: ["damage"] };
const glossary = { damage: "Schaden", unused: "Unverwendet" };
const messages = { attack: message };
const valid = () => ({
  text: "Verursache <damage>{{amount}}</damage> Schaden",
  sourceHash: sourceHash(message, glossary, "de"),
  reviewed: true,
});

it("reports stale and incomplete packets without attesting semantic review", () => {
  const context = {
    messages,
    glossary: Object.fromEntries(TARGETS.map((locale) => [locale, glossary])),
    catalogs: Object.fromEntries(
      TARGETS.map((locale) => [
        locale,
        locale === "de" ? {} : { attack: { ...valid(), sourceHash: sourceHash(message, glossary, locale) } },
      ]),
    ),
  };
  const [packet] = editableTranslationPackets(translationPackets(context));
  expect(inspectTranslationPacket([packet], context).state).toBe("incomplete");
  const completed = { ...packet!, results: { attack: valid().text } };
  const ready = inspectTranslationPacket([completed], context);
  expect(ready.state).toBe("ready-for-review");
  expect(ready.detail).toContain("Semantic review");
  expect(inspectTranslationPacket([{ ...completed, results: {} }], context).state).toBe("incomplete");
  const changed = { ...context, messages: { attack: { ...message, text: `${message.text} now` } } };
  expect(inspectTranslationPacket([completed], changed).state).toBe("stale");
});

it("prepares only pending canonical messages with unreviewed editable plural templates", () => {
  const plural = {
    text: "{{count}} items",
    context: "Quantity",
    plural: true,
    forms: { one: "{{count}} item", other: "{{count}} items" },
  };
  const source = { ...messages, plural, alias: { ...message, aliasOf: "attack" } };
  const glossaries = Object.fromEntries(TARGETS.map((locale) => [locale, glossary]));
  const catalogs = Object.fromEntries(
    TARGETS.map((locale) => [
      locale,
      Object.fromEntries(
        Object.entries(source)
          .filter(([id]) => id !== "alias")
          .map(([id, entry]) => [
            id,
            { text: entry.text, sourceHash: sourceHash(entry, glossary, locale), reviewed: true },
          ]),
      ),
    ]),
  );
  expect(translationPackets({ messages: source, glossary: glossaries, catalogs })).toEqual([]);
  delete catalogs.de!.plural;
  const [packet] = translationPackets({ messages: source, glossary: glossaries, catalogs });
  expect(packet?.locale).toBe("de");
  expect(Object.keys(packet?.messages ?? {})).toEqual(["plural"]);
  expect(packet?.results.plural).toEqual({
    text: "",
    sourceHash: sourceHash(plural, glossary, "de"),
    reviewed: false,
    forms: { one: "", other: "" },
  });
});

it("validates all locale results before returning replacements and rejects stale or duplicate batches", () => {
  const catalogs = { de: { attack: valid() }, fr: {} };
  const context = { messages, glossary: { de: glossary, fr: glossary }, catalogs };
  const de = { locale: "de", results: { attack: valid() } };
  const fr = {
    locale: "fr",
    results: {
      attack: {
        text: "Inflige <damage>{{amount}}</damage> dégâts",
        sourceHash: sourceHash(message, glossary, "fr"),
        reviewed: true,
      },
    },
  };
  expect(validateBatch([de, fr], context).fr?.attack?.text).toBe(fr.results.attack.text);
  expect(validateBatch(de, context).de).toEqual(catalogs.de);
  expect(() =>
    validateBatch([de, { ...fr, results: { attack: { ...fr.results.attack, reviewed: false } } }], context),
  ).toThrow("not been reviewed");
  expect(() =>
    validateBatch([de, { ...fr, results: { attack: { ...fr.results.attack, sourceHash: "stale" } } }], context),
  ).toThrow("Outdated");
  expect(() => validateBatch([de, de], context)).toThrow("Duplicate");
  expect(catalogs.fr).toEqual({});
  expect(catalogs.de.attack).toEqual(valid());
});

it("resumes reviewed drafts only for unchanged sources and keeps changed drafts for review", () => {
  const context = {
    messages,
    glossary: Object.fromEntries(TARGETS.map((locale) => [locale, glossary])),
    catalogs: {},
  };
  const drafts = [{ locale: "de", results: { attack: valid() } }];
  const resumed = translationPackets(context, drafts).find((packet) => packet.locale === "de");
  expect(resumed?.results.attack).toEqual(valid());
  const changed = translationPackets(
    { ...context, messages: { attack: { ...message, text: "Deal <damage>{{amount}}</damage> damage twice" } } },
    drafts,
  ).find((packet) => packet.locale === "de");
  expect(changed?.results.attack?.text).toBe(valid().text);
  expect(changed?.results.attack?.reviewed).toBe(false);
  expect(changed?.results.attack?.sourceHash).not.toBe(valid().sourceHash);
  const terminology = translationPackets(
    { ...context, glossary: { ...context.glossary, de: { damage: "Treffer" } } },
    drafts,
  ).find((packet) => packet.locale === "de");
  expect(terminology?.results.attack?.reviewed).toBe(false);
  expect(() => translationPackets(context, [...drafts, ...drafts])).toThrow("duplicate draft locale");
});

it("repairs plural metadata without approving incomplete or conflicting drafts", () => {
  const plural = { text: "{{count}} items", context: "Quantity", plural: true };
  const context = {
    messages: { plural },
    glossary: Object.fromEntries(TARGETS.map((locale) => [locale, {}])),
    catalogs: {},
  };
  const drafts = [
    {
      locale: "de",
      results: { plural: { text: "{{count}} Dinge", sourceHash: sourceHash(plural, {}, "de"), reviewed: true } },
    },
  ];
  const result = translationPackets(context, drafts).find((packet) => packet.locale === "de")?.results.plural;
  expect(result).toMatchObject({
    text: "{{count}} Dinge",
    forms: { one: "", other: "{{count}} Dinge" },
    reviewed: false,
  });
  expect(drafts[0]?.results.plural.reviewed).toBe(true);
});

describe("localization ingestion", () => {
  it("tracks terminology through plurals and keyword word forms", () => {
    const terms = relatedTerms(
      "Trinkets keep Frozen enemies from making Wishes",
      ["Trinket", "Freeze", "Wish", "Mana"],
      [
        { match: "Freeze", keywordId: "freeze" },
        { match: "Frozen", keywordId: "freeze" },
      ],
    );
    expect(terms).toEqual(["Freeze", "Trinket", "Wish"]);
    const entry = { text: "Trinkets", context: "Inventory", terms };
    expect(sourceHash(entry, { Trinket: "Schmuckstück" }, "de")).not.toBe(
      sourceHash(entry, { Trinket: "Talisman" }, "de"),
    );
  });

  it("rejects results after source, context, parameters or relevant terminology changes", () => {
    const results = { attack: valid() };
    for (const changed of [
      { ...message, text: "Do not deal <damage>{{amount}}</damage> damage" },
      { ...message, context: "Self damage" },
      { ...message, text: "Deal <damage>{{total}}</damage> damage" },
    ])
      expect(() => validateResults({ messages: { attack: changed }, glossary, locale: "de", results })).toThrow(
        "Outdated",
      );
    expect(() =>
      validateResults({ messages, glossary: { ...glossary, damage: "Treffer" }, locale: "de", results }),
    ).toThrow("Outdated");
    expect(
      validateResults({ messages, glossary: { ...glossary, unused: "Anders" }, locale: "de", results }).attack,
    ).toEqual(valid());
  });

  it("rejects damaged slots, parameters, attributes and missing review without changing previous data", () => {
    const previous = { attack: valid() };
    for (const text of [
      "Verursache Schaden",
      "<damage>{{total}}</damage>",
      '<damage id="other">{{amount}}</damage>',
      "<damage>{{amount}}</other>",
      "<other>{{amount}}</other>",
      "<damage></damage>{{amount}}",
    ]) {
      expect(() =>
        validateResults({ messages, glossary, locale: "de", previous, results: { attack: { ...valid(), text } } }),
      ).toThrow();
    }
    expect(() =>
      validateResults({
        messages,
        glossary,
        locale: "de",
        previous,
        results: { attack: { ...valid(), reviewed: false } },
      }),
    ).toThrow("reviewed");
    expect(previous.attack).toEqual(valid());
  });

  it("preserves unchanged translations and removes orphans while deriving exact-number display aliases", () => {
    const alias = { text: "Deal 4 damage", context: "Saved card view", aliasOf: "attack", values: { amount: 4 } };
    const source = { ...messages, alias };
    const next = validateResults({
      messages: source,
      glossary,
      locale: "de",
      previous: { retired: valid(), attack: valid(), alias: { ...valid(), text: "Incorrect cached wording" } },
      results: {},
    });
    expect(next.retired).toBeUndefined();
    expect(next.alias).toBeUndefined();
    expect(next.attack).toEqual(valid());
    const derived = resolveAliases(source, next, glossary, "de");
    expect(derived.alias?.text).toBe("Verursache 4 Schaden");
    expect(derived.alias?.reviewed).toBe(true);
    expect(() =>
      validateResults({
        messages: source,
        glossary,
        locale: "de",
        results: { alias: { ...valid(), sourceHash: sourceHash(alias, glossary, "de") } },
      }),
    ).toThrow("Derived translation");
  });
  it("preserves semantic tags when reusing identical whole messages", () => {
    const alias = { ...message, aliasOf: "attack" };
    expect(resolveAliases({ ...messages, alias }, { attack: valid() }, glossary, "de").alias?.text).toBe(valid().text);
    const stale = { attack: { ...valid(), sourceHash: "old" }, alias: valid() };
    expect(resolveAliases({ ...messages, alias }, stale, glossary, "de").alias).toBeUndefined();
    expect(stale.alias).toEqual(valid());
  });

  it("requires every target plural form and preserves fixed quantities", () => {
    const plural = { text: "{{count}} turns", context: "Turn counter", plural: true };
    const base = { text: "{{count}} Züge", sourceHash: sourceHash(plural, {}, "de"), reviewed: true };
    expect(() =>
      validateResults({ messages: { counter: plural }, glossary: {}, locale: "de", results: { counter: base } }),
    ).toThrow("plural");
    expect(
      validateResults({
        messages: { counter: plural },
        glossary: {},
        locale: "de",
        results: { counter: { ...base, forms: { one: "{{count}} Zug", other: base.text } } },
      }).counter?.forms?.one,
    ).toBe("{{count}} Zug");
    const fixed = { text: "Choose 1 of 3", context: "Draft" };
    expect(() =>
      validateResults({
        messages: { draft: fixed },
        glossary: {},
        locale: "de",
        results: { draft: { text: "Wähle 2 von 3", sourceHash: sourceHash(fixed, {}, "de"), reviewed: true } },
      }),
    ).toThrow("quantities");
  });
});

describe("bundled catalog encoding", () => {
  it("retains exact English wording, plurals and moved slots while deriving numeric aliases", () => {
    const expanded = {
      en: {
        attack: "Deal <damage>{{amount}}</damage> damage",
        alias: "Deal 4 damage",
        copy: "Deal <damage>{{amount}}</damage> damage",
        case: "deal 4 damage",
        count_one: "{{count}} card",
      },
      de: {
        attack: "<damage>{{amount}}</damage> Schaden",
        alias: "4 Schaden",
        copy: "<damage>{{amount}}</damage> Schaden",
        case: "4 Schaden",
        count_one: "{{count}} Karte",
      },
    };
    const packed = packCatalogs(expanded, {
      alias: { aliasOf: "attack", values: { amount: 4 } },
      copy: { aliasOf: "attack" },
      case: { aliasOf: "attack", values: { amount: 4 } },
    });
    expect(packed.messages.alias).toBeUndefined();
    expect(packed.aliases.case?.english).toBe("deal 4 damage");
    expect(unpackCatalogs(packed)).toEqual(expanded);
  });

  it("rejects corrupt bundles before any partial resources can be installed", () => {
    const valid = packCatalogs({ en: { a: "A" }, de: { a: "Ein" } }, {});
    for (const invalid of [
      {},
      { ...valid, version: 2 },
      { ...valid, languages: ["en", "en"] },
      { ...valid, messages: { a: ["A"] } },
      { ...valid, aliases: { a: { id: "a" } } },
      { ...valid, aliases: { b: { id: "constructor" } } },
      { ...valid, aliases: { b: { id: "c" }, c: { id: "b" } } },
    ])
      expect(() => unpackCatalogs(invalid)).toThrow();
  });
});

it("applies editable strings only after explicit review and rejects stale English or glossary context", () => {
  const context = { messages, glossary: Object.fromEntries(TARGETS.map((locale) => [locale, glossary])), catalogs: {} };
  const packet = editableTranslationPackets(translationPackets(context)).find((entry) => entry.locale === "de")!;
  packet.results.attack = valid().text;
  expect(packet.glossary).toEqual({ damage: "Schaden" });
  expect(() => validateBatch(packet, context)).toThrow("not been reviewed");
  expect(validateBatch(packet, context, { reviewed: true }).de?.attack).toEqual(valid());
  expect(translationPackets(context, packet).find((entry) => entry.locale === "de")?.results.attack?.text).toBe(
    valid().text,
  );
  expect(() =>
    validateBatch(
      packet,
      { ...context, messages: { attack: { ...message, text: "New English" } } },
      { reviewed: true },
    ),
  ).toThrow("Outdated");
  expect(() =>
    validateBatch(
      packet,
      { ...context, glossary: { ...context.glossary, de: { damage: "Changed" } } },
      { reviewed: true },
    ),
  ).toThrow("Outdated");
  packet.results.attack = "No named amount parameter";
  expect(() => validateBatch(packet, context, { reviewed: true })).toThrow();
});

it("derives plural display text from editable forms and rejects missing required categories", () => {
  const plural = {
    text: "{{count}} items",
    context: "Quantity",
    plural: true,
    forms: { one: "{{count}} item", other: "{{count}} items" },
  };
  const context = {
    messages: { quantity: plural },
    glossary: Object.fromEntries(TARGETS.map((locale) => [locale, {}])),
    catalogs: {},
  };
  const packet = editableTranslationPackets(translationPackets(context)).find((entry) => entry.locale === "de")!;
  packet.results.quantity = { forms: { one: "{{count}} Ding", other: "{{count}} Dinge" } };
  expect(validateBatch(packet, context, { reviewed: true }).de?.quantity?.text).toBe("{{count}} Dinge");
  expect(translationPackets(context, packet).find((entry) => entry.locale === "de")?.results.quantity?.forms).toEqual(
    packet.results.quantity.forms,
  );
  packet.results.quantity = { forms: { other: "{{count}} Dinge" } };
  expect(() => validateBatch(packet, context, { reviewed: true })).toThrow();
});

import { describe, expect, it } from "vitest";
import { sourceHash, validateResults, resolveAliases, relatedTerms } from "../../../scripts/localization/catalog.mjs";

const message = { text: "Deal <damage>{{amount}}</damage> damage", context: "Attack damage", terms: ["damage"] };
const glossary = { damage: "Schaden", unused: "Unverwendet" };
const messages = { attack: message };
const valid = () => ({
  text: "Verursache <damage>{{amount}}</damage> Schaden",
  sourceHash: sourceHash(message, glossary, "de"),
  reviewed: true,
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

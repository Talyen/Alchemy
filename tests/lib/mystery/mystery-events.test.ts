import { describe, expect, it } from "vitest";
import { getMysteryEffectRank, mysteryPool, pickMysteryEvent } from "@/lib/mystery";
import { cardLibrary, mysteryEventArt, trinketLibrary } from "@/lib/game-data";
import { gearBaseItems } from "@/lib/gear";

const PORTRAIT_EFFECT_KINDS = new Set(["addCard", "gainTrinket", "gainRandomTrinket", "gainGeneratedGear"]);
const SIDE_LOOT_KINDS = new Set(["gainXP", "gainGold", "gainMaterial"]);

describe("mysteryPool", () => {
  it("contains events", () => {
    expect(mysteryPool.length).toBeGreaterThan(0);
  });

  it("each event has required fields and 2 choices", () => {
    for (const event of mysteryPool) {
      expect(event.id).toBeTruthy();
      expect(event.title).toBeTruthy();
      expect(event.narrative).toBeTruthy();
      expect(typeof event.art).toBe("string");
      expect(event.choices).toHaveLength(2);
    }
  });

  it("narrative text contains no em dashes", () => {
    for (const event of mysteryPool) {
      expect(event.narrative, `${event.id} narrative`).not.toContain("—");
      expect(event.title, `${event.id} title`).not.toContain("—");
      for (const choice of event.choices) {
        expect(choice.label, `${event.id}/${choice.label} label`).not.toContain("—");
      }
    }
  });

  it("each event has a unique ID", () => {
    const ids = mysteryPool.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each choice grants exactly one portrait reward plus optional XP, gold, or materials", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        const label = `${event.id}/${choice.label}`;
        expect(choice.label).toBeTruthy();
        expect(choice.effects.length, label).toBeGreaterThanOrEqual(2);
        expect(choice.effects.length, label).toBeLessThanOrEqual(3);
        const portraitCount = choice.effects.filter((effect) => PORTRAIT_EFFECT_KINDS.has(effect.kind)).length;
        expect(portraitCount, `${label} portrait count`).toBe(1);
        for (const effect of choice.effects) {
          if (PORTRAIT_EFFECT_KINDS.has(effect.kind)) continue;
          expect(SIDE_LOOT_KINDS.has(effect.kind), `${label} extra ${effect.kind}`).toBe(true);
        }
      }
    }
  });

  it("choice effects are ordered XP → portrait → gold → material", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        const ranks = choice.effects.map((e) => getMysteryEffectRank(e));
        const sorted = [...ranks].sort((a, b) => a - b);
        expect(ranks, `${event.id}/${choice.label} order`).toEqual(sorted);
      }
    }
  });

  it("every event has a non-empty art URL", () => {
    for (const event of mysteryPool) {
      expect(event.art, `Event "${event.id}" has no art URL`).toBeTruthy();
      expect(mysteryEventArt[event.id], `Event "${event.id}" is missing from mysteryEventArt`).toBeTruthy();
    }
  });

  it("addCard effects reference valid card IDs", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.kind === "addCard") {
            const card = cardLibrary.find((c) => c.id === effect.cardId);
            expect(card, `Event "${event.id}" references unknown card "${effect.cardId}"`).toBeDefined();
          }
        }
      }
    }
  });

  it("gainTrinket effects reference valid trinket IDs", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.kind === "gainTrinket") {
            const trinket = trinketLibrary.find((t) => t.id === effect.trinketId);
            expect(trinket, `Event "${event.id}" references unknown trinket "${effect.trinketId}"`).toBeDefined();
          }
        }
      }
    }
  });

  it("gainGeneratedGear effects reference valid base items and never author astral rarity", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.kind === "gainGeneratedGear") {
            expect(
              effect.baseItemId in gearBaseItems,
              `Event "${event.id}" references unknown gear base "${effect.baseItemId}"`,
            ).toBe(true);
            expect(effect.astral, `Event "${event.id}" authored astral gear`).toBeUndefined();
          }
        }
      }
    }
  });

  it("Overgrown Temple Search the Crypt constrains random trinkets", () => {
    const temple = mysteryPool.find((e) => e.id === "overgrown-temple");
    expect(temple).toBeDefined();
    const search = temple!.choices.find((c) => c.label === "Search the Crypt");
    expect(search).toBeDefined();
    const effect = search!.effects.find((e) => e.kind === "gainRandomTrinket");
    expect(effect?.kind).toBe("gainRandomTrinket");
    if (effect?.kind === "gainRandomTrinket") {
      expect(effect.fromIds).toEqual(["bone-charm", "sin-eaters-lantern"]);
    }
  });

  it("companion events still grant companion cards", () => {
    const lodge = mysteryPool.find((e) => e.id === "hunters-lodge");
    const wolf = mysteryPool.find((e) => e.id === "the-wolf");
    const phoenix = mysteryPool.find((e) => e.id === "the-phoenix");
    const necromancer = mysteryPool.find((e) => e.id === "necromancers-offer");
    expect(
      lodge!.choices.some((c) => c.effects.some((e) => e.kind === "addCard" && e.cardId === "wolf-companion")),
    ).toBe(true);
    expect(
      wolf!.choices.some((c) => c.effects.some((e) => e.kind === "addCard" && e.cardId === "wolf-companion")),
    ).toBe(true);
    expect(
      phoenix!.choices.some((c) => c.effects.some((e) => e.kind === "addCard" && e.cardId === "phoenix-companion")),
    ).toBe(true);
    expect(
      necromancer!.choices.some((c) =>
        c.effects.some((e) => e.kind === "addCard" && e.cardId === "skeleton-companion"),
      ),
    ).toBe(true);
  });

  it("previously resource-only choices now grant a portrait reward", () => {
    const portraitOf = (eventId: string, label: string) => {
      const event = mysteryPool.find((entry) => entry.id === eventId);
      const choice = event?.choices.find((entry) => entry.label === label);
      return choice?.effects.find((effect) => PORTRAIT_EFFECT_KINDS.has(effect.kind));
    };

    expect(portraitOf("mana-berries", "Gather Crystals")).toEqual({ kind: "addCard", cardId: "mana-berries" });
    expect(portraitOf("enchanted-spring", "Gather the Moss")).toEqual({
      kind: "gainTrinket",
      trinketId: "groves-favor",
    });
    expect(portraitOf("fungal-grotto", "Collect Crystals")).toEqual({
      kind: "gainTrinket",
      trinketId: "frozen-pocketwatch",
    });
    expect(portraitOf("wisdom-tree", "Collect Branches")).toEqual({ kind: "gainGeneratedGear", baseItemId: "staff" });
    expect(portraitOf("wisdom-tree", "Forage Herbs")).toEqual({
      kind: "gainGeneratedGear",
      baseItemId: "emerald-amulet",
    });
    expect(portraitOf("ancient-altar", "Take the Offering")).toEqual({
      kind: "gainGeneratedGear",
      baseItemId: "topaz-ring",
    });
    expect(portraitOf("hidden-cache", "Take the Coinpurse")).toEqual({
      kind: "gainTrinket",
      trinketId: "merchants-favor",
    });
    expect(portraitOf("overgrown-temple", "Take a Tile")).toEqual({
      kind: "gainTrinket",
      trinketId: "vanguards-crest",
    });
    expect(portraitOf("crystal-geode", "Take the Shell")).toEqual({
      kind: "gainGeneratedGear",
      baseItemId: "sapphire-amulet",
    });
    expect(portraitOf("meteorite-crash", "Search the Crater")).toEqual({
      kind: "gainGeneratedGear",
      baseItemId: "ruby-ring",
    });
    expect(portraitOf("sacred-grove", "Pick the Blooms")).toEqual({
      kind: "gainGeneratedGear",
      baseItemId: "emerald-amulet",
    });
    expect(portraitOf("mountain-pass", "Gather Herbs")).toEqual({ kind: "addCard", cardId: "fox-companion" });
    expect(portraitOf("murky-pond", "Catch Fish")).toEqual({ kind: "addCard", cardId: "lizard-scout-companion" });
    expect(portraitOf("murky-pond", "Pull the Reeds")).toEqual({ kind: "addCard", cardId: "will-o-wisp-companion" });
    expect(portraitOf("roadside-censer", "Gather Incense")).toEqual({ kind: "gainGeneratedGear", baseItemId: "mace" });
  });
});

describe("pickMysteryEvent", () => {
  it("returns a valid event from the pool", () => {
    const event = pickMysteryEvent(() => 0.5);
    expect(mysteryPool).toContain(event);
  });
});

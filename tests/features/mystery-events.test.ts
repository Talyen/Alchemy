import { describe, expect, it } from "vitest";
import { mysteryPool } from "@/features/alchemy/run-loop/mystery-events";
import { cardLibrary, trinketLibrary } from "@/lib/game-data";
import type { KeywordId } from "@/lib/game-data";
import { MATERIAL_IDS } from "@/lib/homestead/types";

const validKeywords: KeywordId[] = [
  "physical", "stun", "block", "forge", "armor", "health", "burn", "gold",
  "holy", "wish", "consume", "poison", "bleed", "leech", "freeze", "mana",
  "nature", "companion", "archery",
];

describe("mysteryPool", () => {
  it("contains 23 events", () => {
    expect(mysteryPool.length).toBe(23);
  });

  it("each event has required fields", () => {
    for (const event of mysteryPool) {
      expect(event.id).toBeTruthy();
      expect(event.title).toBeTruthy();
      expect(event.narrative).toBeTruthy();
      expect(typeof event.art).toBe("string");
      expect(Array.isArray(event.choices)).toBe(true);
      expect(event.choices.length).toBe(2);
    }
  });

  it("each event has a unique ID", () => {
    const ids = mysteryPool.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each choice has label and at least one effect", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        expect(choice.label).toBeTruthy();
        expect(Array.isArray(choice.effects)).toBe(true);
        expect(choice.effects.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("addCard effects reference valid card IDs from the library", () => {
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

  it("gainTrinket effects reference valid trinket IDs from the library", () => {
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

  it("removeCard effects only use 'random' or 'choose' mode", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.kind === "removeCard") {
            expect(["random", "choose"]).toContain(effect.mode);
          }
        }
      }
    }
  });

  it("gainXP effects reference valid keyword IDs", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.kind === "gainXP") {
            expect(validKeywords).toContain(effect.keyword);
          }
        }
      }
    }
  });

  it("healHealth and damageHealth amounts are positive", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.kind === "healHealth" || effect.kind === "damageHealth") {
            expect(effect.amount).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("loseGold amounts are positive", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.kind === "loseGold") {
            expect(effect.amount).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("gainMaterial effects reference valid material IDs", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.kind === "gainMaterial") {
            expect(MATERIAL_IDS, `Event "${event.id}" has invalid material`).toContain(effect.material);
          }
        }
      }
    }
  });

  it("each event has at least one non-none effect across all choices", () => {
    for (const event of mysteryPool) {
      const hasRealEffect = event.choices.some((choice) =>
        choice.effects.length > 0 && choice.effects.some((e) => e.kind !== "none")
      );
      expect(hasRealEffect, `Event "${event.id}" has only 'none' effects`).toBe(true);
    }
  });

  it("Abandoned Study 'Search the Scrolls' uses chooseCard effect", () => {
    const study = mysteryPool.find((e) => e.id === "abandoned-study");
    expect(study).toBeDefined();
    const search = study!.choices.find((c) => c.label === "Search the Scrolls");
    expect(search).toBeDefined();
    expect(search!.effects.some((e) => e.kind === "chooseCard")).toBe(true);
  });

  it("Overgrown Temple 'Explore the Crypt' uses gainRandomTrinket", () => {
    const temple = mysteryPool.find((e) => e.id === "overgrown-temple");
    expect(temple).toBeDefined();
    const explore = temple!.choices.find((c) => c.label === "Explore the Crypt");
    expect(explore).toBeDefined();
    expect(explore!.effects.some((e) => e.kind === "gainRandomTrinket")).toBe(true);
  });

  it("no event has a 'none'-only choice", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        const allNone = choice.effects.every((e) => e.kind === "none");
        expect(allNone, `Event "${event.id}" choice "${choice.label}" is all 'none'`).toBe(false);
      }
    }
  });

  it("Mana Berries no longer has a Leave choice", () => {
    const berries = mysteryPool.find((e) => e.id === "mana-berries");
    expect(berries).toBeDefined();
    const leave = berries!.choices.find((c) => c.label === "Leave");
    expect(leave).toBeUndefined();
  });

  it("Enchanted Spring has no 'Sip Slowly' or 'Drink Deeply'", () => {
    const spring = mysteryPool.find((e) => e.id === "enchanted-spring");
    expect(spring).toBeDefined();
    expect(spring!.choices.find((c) => c.label === "Sip Slowly")).toBeUndefined();
    expect(spring!.choices.find((c) => c.label === "Drink Deeply")).toBeUndefined();
  });

  it("gainXP amounts are positive", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.kind === "gainXP") {
            expect(effect.amount).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("new events are present", () => {
    expect(mysteryPool.find((e) => e.id === "mountain-pass")).toBeDefined();
    expect(mysteryPool.find((e) => e.id === "murky-pond")).toBeDefined();
    expect(mysteryPool.find((e) => e.id === "necromancers-offer")).toBeDefined();
    expect(mysteryPool.find((e) => e.id === "medicinal-herb-garden")).toBeDefined();
    expect(mysteryPool.find((e) => e.id === "crystal-garden")).toBeDefined();
    expect(mysteryPool.find((e) => e.id === "hunters-lodge")).toBeDefined();
    expect(mysteryPool.find((e) => e.id === "roadside-censer")).toBeDefined();
    expect(mysteryPool.find((e) => e.id === "the-phoenix")).toBeDefined();
    expect(mysteryPool.find((e) => e.id === "the-wolf")).toBeDefined();
  });

  it("Hunter's Lodge 'Take the Arrows' uses chooseCard with archery tag", () => {
    const lodge = mysteryPool.find((e) => e.id === "hunters-lodge");
    expect(lodge).toBeDefined();
    const arrows = lodge!.choices.find((c) => c.label === "Take the Arrows");
    expect(arrows).toBeDefined();
    const effect = arrows!.effects.find((e) => e.kind === "chooseCard");
    expect(effect).toBeDefined();
    if (effect?.kind === "chooseCard") {
      expect(effect.tag).toBe("archery");
    }
  });

  it("Fairy Ring has a 'Make a Wish' choice", () => {
    const ring = mysteryPool.find((e) => e.id === "fairy-ring");
    expect(ring).toBeDefined();
    expect(ring!.choices.find((c) => c.label === "Make a Wish")).toBeDefined();
  });

  it("Ancient Altar has a 'Pray' choice", () => {
    const altar = mysteryPool.find((e) => e.id === "ancient-altar");
    expect(altar).toBeDefined();
    expect(altar!.choices.find((c) => c.label === "Pray")).toBeDefined();
  });
});

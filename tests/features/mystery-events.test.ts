import { describe, expect, it } from "vitest";
import { mysteryPool } from "@/features/alchemy/mystery-events";
import { cardLibrary } from "@/lib/game-data";
import type { KeywordId } from "@/lib/game-data";

const validKeywords: KeywordId[] = [
  "physical", "stun", "block", "forge", "armor", "health", "burn", "gold",
  "holy", "wish", "ailment", "consume", "poison", "bleed", "leech", "freeze", "mana",
];

describe("mysteryPool", () => {
  it("contains at least one event", () => {
    expect(mysteryPool.length).toBeGreaterThanOrEqual(1);
  });

  it("each event has required fields", () => {
    for (const event of mysteryPool) {
      expect(event.id).toBeTruthy();
      expect(event.title).toBeTruthy();
      expect(event.narrative).toBeTruthy();
      expect(typeof event.art).toBe("string");
      expect(Array.isArray(event.choices)).toBe(true);
      expect(event.choices.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("each event has a unique ID", () => {
    const ids = mysteryPool.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each choice has label, description, and at least one effect", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        expect(choice.label).toBeTruthy();
        expect(choice.description).toBeTruthy();
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

  it("healHP and damageHP amounts are positive", () => {
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.kind === "healHP" || effect.kind === "damageHP") {
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

  it("healHP with chance is 0.5 (Fairy Ring dance)", () => {
    const fairyRing = mysteryPool.find((e) => e.id === "fairy-ring");
    expect(fairyRing).toBeDefined();
    const dance = fairyRing!.choices.find((c) => c.label === "Dance Until Dawn");
    expect(dance).toBeDefined();
    const chanceHeal = dance!.effects.find((e) => e.kind === "healHP" && e.chance !== undefined);
    expect(chanceHeal).toBeDefined();
    expect(chanceHeal!.chance).toBe(0.5);
  });

  it("each event has at least one non-none effect across all choices", () => {
    for (const event of mysteryPool) {
      const hasRealEffect = event.choices.some((choice) =>
        choice.effects.length > 0 && choice.effects.some((e) => e.kind !== "none")
      );
      expect(hasRealEffect, `Event "${event.id}" has only 'none' effects`).toBe(true);
    }
  });

  it("Wisdom Tree 'Memorize a Lesson' adds Wish and removes random card", () => {
    const tree = mysteryPool.find((e) => e.id === "wisdom-tree");
    expect(tree).toBeDefined();
    const memorize = tree!.choices.find((c) => c.label === "Memorize a Lesson");
    expect(memorize).toBeDefined();
    expect(memorize!.effects).toEqual(
      expect.arrayContaining([
        { kind: "addCard", cardId: "wish" },
        { kind: "removeCard", mode: "random" },
      ])
    );
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
});

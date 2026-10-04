import { describe, expect, it } from "vitest";
import { getMysteryEffectRank, mysteryPool } from "@/lib/mystery";
import { cardLibrary, mysteryEventArt, trinketLibrary } from "@/lib/game-data";
import { gearBaseItems } from "@/lib/gear";

const PORTRAIT_EFFECT_KINDS = new Set([
  "addCard",
  "gainTrinket",
  "gainRandomTrinket",
  "gainRandomGear",
  "gainGeneratedGear",
]);
const SIDE_LOOT_KINDS = new Set(["gainXP", "gainGold", "gainMaterial"]);

function rewardCategory(effect: { kind: string }): string {
  return PORTRAIT_EFFECT_KINDS.has(effect.kind) ? "portrait" : effect.kind;
}

describe("mysteryPool", () => {
  it("uses unique event IDs so saved visits restore the same event", () => {
    const ids = mysteryPool.map((event) => event.id);
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

  it("keeps the same number of reward categories across an event's choices", () => {
    for (const event of mysteryPool) {
      const categoryCounts = event.choices.map(
        (choice) => new Set(choice.effects.map((effect) => rewardCategory(effect))).size,
      );
      expect(new Set(categoryCounts).size, event.id).toBe(1);
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
    const trinketIds = new Set<string>(trinketLibrary.map((t) => t.id));
    for (const event of mysteryPool) {
      for (const choice of event.choices) {
        for (const effect of choice.effects) {
          if (effect.kind === "gainTrinket") {
            const trinket = trinketLibrary.find((t) => t.id === effect.trinketId);
            expect(trinket, `Event "${event.id}" references unknown trinket "${effect.trinketId}"`).toBeDefined();
          }
          if (effect.kind === "gainRandomTrinket") {
            expect(effect.fromIds?.length, `Event "${event.id}" has an empty random trinket pool`).toBeGreaterThan(0);
            for (const id of effect.fromIds ?? []) {
              expect(trinketIds.has(id), `Event "${event.id}" references unknown trinket "${id}"`).toBe(true);
            }
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
});

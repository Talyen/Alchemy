import { describe, expect, it } from "vitest";
import { cardById, computeTalentEffects } from "@/lib/game-data";
import { createMixedPotion, doublePotionPotency } from "@/lib/alchemist";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { dealPlayerTypedHit } from "@/lib/battle/player-typed-hit";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const drawingPotion = {
  ...cardById["acid-potion"]!,
  corrupted: true,
  descriptionLines: ["Deal 3 Poison damage", "Draw a card", "Consume"],
  effects: [...cardById["acid-potion"]!.effects, { kind: "draw-cards" as const, amount: 1 }],
};

describe("player-facing card and trinket regressions", () => {
  it("Rooted reacts once to a repeated Nature card whose damage is inside a chance branch", () => {
    const card = makeTestCard({
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "damage", damageType: "nature", amount: 2 }],
          failureEffects: [{ kind: "heal", amount: 2 }],
        },
      ],
    });
    const state = patchBattleState({
      hand: [card],
      rng: () => 0.99,
      flags: { playNextCardTwice: true },
      currentEnemy: { traits: [{ id: "rooted", title: "Rooted", description: "" }] },
    });
    expect(playBattleCardResolved(state, card.id, 0).state.enemyMitigation.block).toBe(1);
  });

  it("Lucky Clover rewards Nature retaliation but not Physical Stun gear damage", () => {
    const base = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      trinketEffects: { luckyCloverGoldChance: 100 },
      rng: () => 0.99,
    });
    expect(dealPlayerTypedHit(base, "nature", 4, []).gold).toBe(4);
    const stunned = patchBattleState({
      ...base,
      enemyStatuses: { stun: 100 },
      gearEffects: { damageOnStunPhysical: 4 },
    });
    expect(resolveStunTrigger(stunned, []).gold).toBe(0);
  });

  it.each(["hit", "tick"])("Parasitic Bloom leeches once from actual Poison %s damage", (source) => {
    const card = cardById["acid-potion"]!;
    const state = patchBattleState({
      hand: [card],
      playerHealth: 10,
      playerMaxHealth: 40,
      enemyHealth: 2,
      enemyMaxHealth: 100,
      enemyStatuses: { poison: source === "tick" ? 3 : 0 },
      trinketEffects: { parasiticBloomLeechChance: 100 },
      rng: () => 0.99,
    });
    const result = source === "hit" ? playBattleCardResolved(state, card.id, 0).state : tickEnemyStatuses(state, []);
    expect(result.playerHealth).toBe(11);
  });

  it("mixed and strengthened Potions describe their increased implicit card draw", () => {
    for (const potion of [createMixedPotion(drawingPotion, drawingPotion, 1), doublePotionPotency(drawingPotion)]) {
      const draw = potion.effects.find((effect) => effect.kind === "draw-cards")!;
      expect(potion.descriptionLines).toContain(`Draw ${draw.amount} cards`);
      expect(validateCardDescriptionParity(potion)).toEqual([]);
    }
    expect(drawingPotion.descriptionLines).toContain("Draw a card");
  });

  it("Distillation increases card draw from a Brewmaster mixed Potion", () => {
    const potion = createMixedPotion(drawingPotion, drawingPotion, 1);
    const state = patchBattleState({
      hand: [potion],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      deck: Array.from({ length: 6 }, (_, index) => makeTestCard({ id: `draw-${index}` })),
      talentEffects: computeTalentEffects({ consume: ["consume-distillation"] }),
      rng: () => 0.99,
    });
    expect(playBattleCardResolved(state, potion.id, 0).state.hand).toHaveLength(4);
  });
});

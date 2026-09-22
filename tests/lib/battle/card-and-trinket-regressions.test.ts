import { describe, expect, it } from "vitest";
import { cardById, computeTalentEffects } from "@/lib/game-data";
import { createMixedPotion, doublePotionPotency } from "@/lib/alchemist";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { resolvePlayerHit } from "@/lib/battle/hit-resolution";
import { returnHarvestCard } from "@/lib/battle/unique-card-effects";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const drawingPotion = {
  ...cardById["acid-potion"]!,
  corrupted: true,
  descriptionLines: [
    ...cardById["acid-potion"]!.descriptionLines.filter((line) => line !== "Consume"),
    "Draw a card",
    "Consume",
  ],
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
    expect(resolveFollowUpHit(base, { source: "player-follow-up", damageType: "nature", amount: 4 }, []).gold).toBe(4);
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
      talentEffects: computeTalentEffects({ consume: ["consume-distillation", "consume-brewmaster"] }),
      rng: () => 0.99,
    });
    expect(playBattleCardResolved(state, potion.id, 0).state.hand).toHaveLength(4);
  });

  it("reflectBlockedAttackAsHoly triggers enemy threshold reactions before paying kill rewards", () => {
    const state = patchBattleState({
      enemyHealth: 6,
      enemyMaxHealth: 10,
      currentEnemy: { traits: [{ id: "second-wind", title: "Second Wind", description: "" }] },
      talentEffects: { holyReflectionBlockLostPercent: 100 },
      gearEffects: { healOnKill: 10 },
      playerHealth: 20,
      playerMaxHealth: 30,
    });
    // Enemy has 6 HP out of 10. Reflected holy damage of 4 drops enemy to 2 HP (crosses half-health 5 HP).
    // Second wind triggers and heals the enemy. Enemy should not be considered killed, so healOnKill shouldn't fire prematurely.
    const result = resolvePlayerHit(state, { source: "reflected-holy", blockLost: 4 }, []);
    expect(result.flags.secondWindTriggered).toBe(true);
    expect(result.enemyHealth).toBeGreaterThan(2);
    expect(result.playerHealth).toBe(20);
  });

  it("returnHarvestCard matches cloned card with identical uid in discard", () => {
    const card = makeTestCard({ id: "strike", uid: 42 });
    const clonedCard = { ...card };
    const state = patchBattleState({
      hand: [],
      discard: [clonedCard],
      nextCardUid: 100,
    });
    const result = returnHarvestCard(state, card);
    expect(result.hand).toHaveLength(1);
    expect(result.discard).toHaveLength(0);
    expect(result.hand[0]!.uid).toBe(100);
    expect(result.uniqueGear.redHarvestUid).toBe(100);
  });
});

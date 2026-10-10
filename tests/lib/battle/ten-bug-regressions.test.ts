import { describe, expect, it, vi } from "vitest";
import { canPlayCard, playBattleCardResolved } from "@/lib/battle/card-play";
import { cardHasDamageType } from "@/lib/battle/card-classification";
import { processEncounterTraitCardAction } from "@/lib/battle/encounter-trait-events";
import { purgeEnemyBenefits } from "@/lib/battle/enemy-purge";
import { applyGearCcPhysicalDamage } from "@/lib/battle/scaled-damage";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { cardById, DAMAGE_TYPES, getCardKeywords } from "@/lib/game-data";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { createMixedPotion, doublePotionPotency } from "@/lib/alchemist";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("combat and card regression fixes", () => {
  it("Purge disarms the enemy's ready Thorns retaliation", () => {
    const card = makeTestCard();
    const state = patchBattleState({
      enemyStatuses: { thorns: 1 },
      flags: { legacyEnemyThornsReady: true },
      currentEnemy: { traits: [{ id: "thorns", title: "Thorns", description: "" }] },
      rng: () => 0.99,
    });
    const purged = purgeEnemyBenefits(state, 1, []).state;
    expect(purged.flags.legacyEnemyThornsReady).toBe(false);
    expect(processEncounterTraitCardAction(purged, card, [], true).playerHealth).toBe(state.playerHealth);
  });

  it("a zero-damage attack cannot trigger Dodge healing or spend RNG", () => {
    const rng = vi.fn(() => 0);
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { healOnDodge: 1 },
      rng,
    });
    const result = resolveEnemyAttackHit(state, { kind: "damage", damageType: "physical", amount: 0 }, [], {
      canDodge: true,
    });
    expect(result.dodged).toBe(false);
    expect(result.state.playerHealth).toBe(10);
    expect(result.state.playerDodgeCount).toBe(state.playerDodgeCount);
    expect(rng).not.toHaveBeenCalled();
  });

  it("Corruption avoids secondary Block already present in Luck Potion's nested branch", () => {
    const secondary = getCorruptionMutationGroups(cardById["luck-potion"]!).find((group) => group.kind === "secondary");
    expect(secondary).toBeDefined();
    expect(
      secondary!.mutations.some(({ card }) => {
        const added = card.effects.at(-1);
        return added?.kind === "player-status" && added.status === "block";
      }),
    ).toBe(false);
  });

  it("unrestricted Random damage advertises every type the resolver can roll", () => {
    const card = makeTestCard({ effects: [{ kind: "random-damage", minAmount: 1, maxAmount: 3 }] });
    for (const type of DAMAGE_TYPES) {
      expect(cardHasDamageType(card, type), type).toBe(true);
      expect(getCardKeywords(card), type).toContain(type);
    }
  });

  it("Potion potency scales range endpoints when mixing or doubling", () => {
    const card = makeTestCard({ id: "health-potion", effects: [{ kind: "random-draw", minAmount: 1, maxAmount: 3 }] });
    expect(doublePotionPotency(card).effects).toEqual([{ kind: "random-draw", minAmount: 2, maxAmount: 6 }]);
    expect(createMixedPotion(card, card, 1).effects).toEqual([{ kind: "random-draw", minAmount: 3, maxAmount: 7 }]);
  });

  it("Stunning gear reports Block spent even when it absorbs the entire hit", () => {
    const state = patchBattleState({ enemyMitigation: { block: 10 } });
    const texts: Parameters<typeof applyGearCcPhysicalDamage>[2] = [];
    const result = applyGearCcPhysicalDamage(state, 4, texts);
    expect(result.enemyMitigation.block).toBe(6);
    expect(texts).toContainEqual(expect.objectContaining({ target: "enemy", stat: "block", amount: 4 }));
  });

  it("a weakened zero-Cleanse card cannot spend Mana against a harmful status", () => {
    const card = makeTestCard({ cost: 1, effects: [{ kind: "remove-harmful-status", amount: 0 }] });
    const rng = vi.fn(() => 0.99);
    const state = patchBattleState({ hand: [card], playerStatuses: { poison: 2 }, rng });
    expect(canPlayCard(state, card, 0)).toBe(false);
    expect(playBattleCardResolved(state, card.id, 0).state).toBe(state);
    expect(rng).not.toHaveBeenCalled();
  });
});

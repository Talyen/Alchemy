import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { getCorruptionMutationGroups } from "@/lib/corruption/mutations";
import { patchBattleState } from "../../fixtures/battle";

describe("current gameplay rules", () => {
  it("Jealous reacts to both Wishes in Faustian Bargain", () => {
    const card = cardById["faustian-bargain"]!;
    const state = patchBattleState({
      hand: [card],
      playerHealth: 20,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      currentEnemy: { traits: [{ id: "jealous", title: "Jealous", description: "" }] },
    });
    const result = playBattleCardResolved(state, card.id, 0).state;
    expect(result.wishOptions).not.toBeNull();
    expect(result.wishQueue).toHaveLength(1);
    expect(result.enemyPhysicalDamageBonus).toBe(2);
  });

  it("Ice Shot cannot receive simple-card corruption bargains", () => {
    const groups = getCorruptionMutationGroups(cardById["ice-shot"]!).map((group) => group.kind);
    expect(groups).toContain("strengthen");
    expect(groups).toContain("secondary");
    expect(groups.filter((kind) => ["bargain", "consume", "draw", "mana", "convert", "leech"].includes(kind))).toEqual(
      [],
    );
  });

  it.each([
    { chance: 100, enemyBlock: 0, expectedBlock: 4, expectedHealth: 96 },
    { chance: 0, enemyBlock: 0, expectedBlock: 0, expectedHealth: 96 },
    { chance: 100, enemyBlock: 4, expectedBlock: 0, expectedHealth: 100 },
  ])(
    "Saintfall respects Faith Barrier chance and prevented damage: $chance/$enemyBlock",
    ({ chance, enemyBlock, expectedBlock, expectedHealth }) => {
      const state = patchBattleState({
        rng: () => 0.5,
        playerHealth: 20,
        playerMaxHealth: 40,
        enemyHealth: 100,
        enemyMaxHealth: 100,
        playerStatuses: { block: 1 },
        gearEffects: { saintfallRetribution: 4 },
        talentEffects: { holyBlockChance: chance },
        enemyMitigation: { block: enemyBlock },
      });
      const result = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 1 }, []);
      expect(result.enemyHealth).toBe(expectedHealth);
      expect(result.playerStatuses.block).toBe(expectedBlock);
    },
  );
});

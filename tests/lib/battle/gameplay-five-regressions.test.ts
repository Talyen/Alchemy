import { describe, expect, it } from "vitest";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { checkHealthThresholds } from "@/lib/battle/status-player";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("gameplay interaction regressions", () => {
  it("Blood Scent landing after a dodged main hit still triggers Thorns", () => {
    let rolls = 0;
    const state = patchBattleState({
      rng: () => (rolls++ === 0 ? 0 : 0.99),
      playerHealth: 10,
      playerMaxHealth: 100,
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerStatuses: { thorns: 4 },
      currentEnemy: { traits: [{ id: "vampire", title: "Blood Scent", description: "" }] },
    });
    const result = applyEnemyAbility(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] }),
      [],
    );
    expect(result.playerHealth).toBe(9);
    expect(result.enemyHealth).toBe(96);
    expect(result.playerStatuses.thorns).toBe(0);
  });

  it("enemy Stun attacks benefit from Forge and spend a stack on damage", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 100,
      playerMaxHealth: 100,
      enemyMitigation: { forge: 3 },
      enemyPhysicalDamageBonus: 7,
    });
    const result = applyEnemyAbility(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 2 }] }),
      [],
    );
    expect(result.playerHealth).toBe(95);
    expect(result.enemyMitigation.forge).toBe(2);
  });

  it.each([0, 3])("Freeze blocks regeneration and %i pending Leech throughout its last skipped turn", (bleed) => {
    const state = patchBattleState({
      rng: () => 0.99,
      enemyHealth: 50,
      enemyMaxHealth: 100,
      enemyRegeneration: 5,
      playerStatuses: { bleed },
      pendingEnemyBleedLeechHealing: bleed,
      enemyCC: { freezeSkipTurns: 1 },
      talentEffects: { freezeBlocksRegen: true },
      deck: [makeTestCard()],
    });
    const result = endPlayerTurn(state).state;
    expect(result.enemyCC.freezeSkipTurns).toBe(0);
    expect(result.enemyHealth).toBe(50);
    expect(
      endPlayerTurn({ ...state, talentEffects: { ...state.talentEffects, freezeBlocksRegen: false } }).state
        .enemyHealth,
    ).toBe(55 + Math.round(bleed / 2));
  });

  it("Mortar and Pestle preserves the critical hit reserved for the next attack", () => {
    const potion = makeTestCard({ id: "health-potion", consume: true, effects: [{ kind: "heal", amount: 1 }] });
    const state = patchBattleState({
      rng: () => 0.99,
      hand: [potion],
      enemyHealth: 100,
      enemyMaxHealth: 100,
      flags: { nextHitCrit: true },
      trinketEffects: { mortarPestlePoisonOnPotionUse: 2 },
    });
    const result = playBattleCardResolved(state, potion.id, 0).state;
    expect(result.enemyHealth).toBe(98);
    expect(result.flags.nextHitCrit).toBe(true);
  });

  it("Steadfast preserves the first Armor card bonus for the card itself", () => {
    const state = patchBattleState({
      playerHealth: 49,
      playerMaxHealth: 100,
      talentEffects: { healthThresholdArmor: [{ threshold: 50, amount: 3 }], firstArmorCardDoubled: true },
    });
    const result = checkHealthThresholds(50, 49, state, []);
    expect(result.playerStatuses.armor).toBe(3);
    expect(result.flags.firstArmorCardDoubledUsed).toBe(false);
  });
});

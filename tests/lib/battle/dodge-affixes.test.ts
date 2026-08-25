import { describe, expect, it } from "vitest";
import { defaultGearEffects } from "@/lib/gear";
import { processEnemyAttack } from "@/lib/battle/enemy-turn-attack";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { dealDamage, makeCombatTexts, makeEffect, makeTestCard, patchBattleState } from "../../fixtures/battle";
import { defaultPlayerStatusValues } from "../../fixtures/default-battle-state";

function dodgeThenMissRng() {
  let calls = 0;
  return () => {
    calls += 1;
    return calls === 1 ? 0.01 : 0.99;
  };
}

function incomingPhysical(overrides: Parameters<typeof patchBattleState>[0] = {}) {
  return patchBattleState({
    playerHealth: 100,
    playerMaxHealth: 100,
    enemyHealth: 100,
    enemyMaxHealth: 100,
    rng: dodgeThenMissRng(),
    enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 8 }],
    ...overrides,
  });
}

describe("Dodge gear affixes", () => {
  it("gains Block, Armor, and Health on Dodge", () => {
    const texts = makeCombatTexts();
    const state = incomingPhysical({
      playerStatuses: defaultPlayerStatusValues({ block: 1, armor: 1 }),
      gearEffects: { ...defaultGearEffects, blockOnDodge: 4, armorOnDodge: 2, healOnDodge: 5 },
      playerHealth: 20,
    });
    const result = processEnemyAttack(state, texts);
    expect(result.playerHealth).toBe(25);
    expect(result.playerStatuses.block).toBe(5);
    expect(result.playerStatuses.armor).toBe(3);
    expect(texts.some((event) => event.kind === "notice" && event.stat === "dodge")).toBe(true);
  });

  it("deals Physical and Bleed damage on Dodge", () => {
    const state = incomingPhysical({
      gearEffects: { ...defaultGearEffects, physicalOnDodge: 5, bleedOnDodge: 4 },
    });
    const result = processEnemyAttack(state, makeCombatTexts());
    expect(result.playerHealth).toBe(100);
    expect(result.enemyHealth).toBe(91);
    expect(result.enemyStatuses.bleed).toBeGreaterThan(0);
  });

  it("arms Opening additional Physical on the next attack", () => {
    const afterDodge = processEnemyAttack(
      incomingPhysical({
        gearEffects: { ...defaultGearEffects, nextAttackPhysicalOnDodge: 4 },
      }),
      makeCombatTexts(),
    );
    expect(afterDodge.flags.nextHitPhysicalBonus).toBe(4);

    const result = dealDamage(afterDodge, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(result.enemyHealth).toBe(91);
    expect(result.flags.nextHitPhysicalBonus).toBe(0);
  });

  it("arms Off-Balance as a guaranteed Crit on the next attack", () => {
    const afterDodge = processEnemyAttack(
      incomingPhysical({
        gearEffects: { ...defaultGearEffects, nextAttackCritOnDodge: 1 },
      }),
      makeCombatTexts(),
    );
    expect(afterDodge.flags.nextHitCrit).toBe(true);

    const card = makeTestCard({
      id: "strike",
      effects: [makeEffect("physical", 6)],
    });
    const armed = {
      ...afterDodge,
      hand: [card],
      mana: 2,
    };
    const played = playBattleCardResolved(armed, card.id, 0);
    expect(played.state.enemyHealth).toBe(88);
    expect(played.state.flags.nextHitCrit).toBe(false);
  });

  it("does not consume Opening when the enemy Dodges", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      flags: { ...patchBattleState().flags, nextHitPhysicalBonus: 4 },
      rng: () => 0.01,
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(result.enemyHealth).toBe(100);
    expect(result.flags.nextHitPhysicalBonus).toBe(4);
  });

  it("does not consume Opening on a non-Physical attack", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      flags: { ...patchBattleState().flags, nextHitPhysicalBonus: 4 },
      rng: () => 0.99,
    });
    const result = dealDamage(state, makeTestCard({ effects: [makeEffect("holy", 5)] }));
    expect(result.enemyHealth).toBe(95);
    expect(result.flags.nextHitPhysicalBonus).toBe(4);
  });
});

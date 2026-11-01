import { describe, expect, it } from "vitest";
import { computeTalentEffects } from "@/lib/game-data";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { tryDodgeEnemyAttackPacket } from "@/lib/battle/dodge";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

describe("talent balance changes", () => {
  it("removes Armor on each unblocked Archery hit and adds damage, without piercing other attacks", () => {
    const talentEffects = computeTalentEffects({ archery: ["archery-piercing-shot"] });
    const state = patchBattleState({ talentEffects, enemyMitigation: { armor: 5, block: 0 }, rng: () => 0.99 });
    const effect = { kind: "damage" as const, damageType: "physical" as const, amount: 6 };
    const card = makeTestCard({ tags: ["archery"], effects: [effect] });
    const hit = computeCardDamageToEnemy(state, effect, card);
    expect(hit.modifiedDamage).toBe(3);
    expect(hit.nextState.enemyMitigation.armor).toBe(4);
    expect(computeCardDamageToEnemy(hit.nextState, effect, card).nextState.enemyMitigation.armor).toBe(3);
    const blocked = computeCardDamageToEnemy(
      { ...state, enemyMitigation: { ...state.enemyMitigation, block: 20 } },
      effect,
      card,
    );
    expect(blocked.modifiedDamage).toBe(0);
    expect(blocked.nextState.enemyMitigation.armor).toBe(5);
    const plain = computeCardDamageToEnemy(state, effect, makeTestCard({ effects: [effect] }));
    expect(plain.modifiedDamage).toBe(1);
    expect(plain.nextState.enemyMitigation.armor).toBe(5);
    const zero = computeCardDamageToEnemy(state, { ...effect, amount: 0 }, card);
    expect(zero.modifiedDamage).toBe(0);
    expect(zero.nextState.enemyMitigation.armor).toBe(5);
  });

  it("adds Dodge while unblocked and respects the existing Block and crowd-control rules", () => {
    const talentEffects = computeTalentEffects({ archery: ["archery-quickdraw"] });
    const state = patchBattleState({ talentEffects, rng: () => 0.17 });
    expect(tryDodgeEnemyAttackPacket(state, [], true).dodged).toBe(true);
    expect(
      tryDodgeEnemyAttackPacket({ ...state, playerStatuses: { ...state.playerStatuses, block: 1 } }, [], true).dodged,
    ).toBe(false);
    expect(
      tryDodgeEnemyAttackPacket({ ...state, playerCC: { ...state.playerCC, stunSkipTurns: 1 } }, [], true).dodged,
    ).toBe(false);
    const withArrowDance = {
      ...state,
      talentEffects: computeTalentEffects({ archery: ["archery-damage", "archery-quickdraw"] }),
    };
    const dodged = resolveEnemyAttackHit(withArrowDance, { kind: "damage", damageType: "physical", amount: 6 }, [], {
      canDodge: true,
    });
    expect(dodged.state.flags.nextArcheryCardFree).toBe(true);
  });

  it("converts talent ownership in an active legacy battle and preserves it on repeated saves", () => {
    const state = patchBattleState({ rng: () => 0.99 });
    const {
      archeryArmorRemoval: _removed,
      archeryDamageBonus: _damage,
      dodgeChanceWithoutBlock: _dodge,
      ...oldEffects
    } = state.talentEffects;
    const oldSave = {
      ...state,
      talentEffects: { ...oldEffects, archeryArmorPiercing: 1, archeryDamageWithoutBlock: 1, holyLifestealPercent: 50 },
    };
    const migrated = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(oldSave)));
    expect(migrated.talentEffects).toMatchObject({
      archeryArmorRemoval: 1,
      archeryDamageBonus: 1,
      dodgeChanceWithoutBlock: 15,
      holyLifestealPercent: 50,
    });
    expect(migrated.talentEffects).not.toHaveProperty("archeryArmorPiercing");
    expect(migrated.talentEffects).not.toHaveProperty("archeryDamageWithoutBlock");
    const current = PersistedBattleStateSchema.parse({
      ...oldSave,
      talentEffects: {
        ...oldSave.talentEffects,
        archeryArmorRemoval: 0,
        archeryDamageBonus: 0,
        dodgeChanceWithoutBlock: 0,
      },
    });
    expect(current.talentEffects).toMatchObject({
      archeryArmorRemoval: 0,
      archeryDamageBonus: 0,
      dodgeChanceWithoutBlock: 0,
    });
    const repeated = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(migrated)));
    expect(repeated.talentEffects).toMatchObject({
      archeryArmorRemoval: 1,
      archeryDamageBonus: 1,
      dodgeChanceWithoutBlock: 15,
      holyLifestealPercent: 50,
    });
  });
});

import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { tryDodgeEnemyAttackPacket, tryDodgePlayerAttackPacket } from "@/lib/battle/dodge";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { addPlayerStatus } from "@/lib/battle/types";
import { applyPlayerDamageStatuses } from "@/lib/battle/status-player";
import { resolvePlayerCrowdControlTriggers } from "@/lib/battle/status-cc";
import { computeTalentEffects, getTalentsForKeyword, getTalentRows, tryUnlockTalent } from "@/lib/game-data";
import { dealDamage, incomingPhysical, makeEffect, makeTestCard, patchBattleState } from "../../fixtures/battle";

const dodgeTalents = getTalentsForKeyword("dodge");
const fullTree = computeTalentEffects({ dodge: dodgeTalents.map((talent) => talent.id) });

describe("Dodge tree progression", () => {
  it("offers ten real talents in four gated rows", () => {
    expect(getTalentRows("dodge").map((row) => row.length)).toEqual([1, 2, 3, 4]);
    expect(tryUnlockTalent("dodge", "dodge-lightfoot", { dodge: 9 }, {}).unlockedTalents).toBeNull();
    const first = tryUnlockTalent("dodge", "dodge-lightfoot", { dodge: 10 }, {});
    expect(first.unlockedTalents).toEqual({ dodge: ["dodge-lightfoot"] });
    expect(tryUnlockTalent("dodge", "dodge-feint", { dodge: 550 }, {}).unlockedTalents).toBeNull();
    let unlocked = {};
    for (const talent of dodgeTalents) {
      const result = tryUnlockTalent("dodge", talent.id, { dodge: 550 }, unlocked);
      expect(result.unlockedTalents).not.toBeNull();
      unlocked = result.unlockedTalents!;
    }
    expect(unlocked).toEqual({ dodge: dodgeTalents.map((talent) => talent.id) });
  });
});

describe("Dodge chance", () => {
  it.each([
    [0.049, true],
    [0.05, false],
  ])("retains the 5%% baseline at roll %s", (roll, succeeds) => {
    expect(tryDodgeEnemyAttackPacket(patchBattleState({ rng: () => roll }), [], true) !== null).toBe(succeeds);
    expect(tryDodgePlayerAttackPacket(patchBattleState({ rng: () => roll }), []) !== null).toBe(succeeds);
  });

  it("adds Lightfoot and gear without making Unburdened a conditional chance bonus", () => {
    const state = patchBattleState({ talentEffects: fullTree, gearEffects: { dodgeChance: 3 }, rng: () => 0.129 });
    expect(tryDodgeEnemyAttackPacket(state, [], true)?.playerDodgeCount).toBe(1);
    const blocked = { ...state, playerStatuses: { ...state.playerStatuses, block: 1 } };
    expect(tryDodgeEnemyAttackPacket(blocked, [], true)?.playerDodgeCount).toBe(1);
    expect(tryDodgeEnemyAttackPacket({ ...state, rng: () => 0.13 }, [], true)).toBeNull();
  });

  it.each([49, 50, 51])("Last Gasp requires strictly less than half Health: %s", (health) => {
    const state = patchBattleState({
      playerHealth: health,
      playerMaxHealth: 100,
      rng: () => 0.15,
      talentEffects: { dodgeChanceBelowHalfHealth: 20 },
    });
    expect(tryDodgeEnemyAttackPacket(state, [], true) !== null).toBe(health < 50);
  });

  it("caps all bonuses at 75% and leaves enemy chance unchanged", () => {
    const state = patchBattleState({
      talentEffects: fullTree,
      gearEffects: { dodgeChance: 100 },
      dodgeChanceFromDamage: 100,
      rng: () => 0.75,
    });
    expect(tryDodgeEnemyAttackPacket(state, [], true)).toBeNull();
    expect(tryDodgeEnemyAttackPacket({ ...state, rng: () => 0.749 }, [], true)?.dodgeChanceFromDamage).toBe(0);
    expect(tryDodgePlayerAttackPacket({ ...state, rng: () => 0.06 }, [])).toBeNull();
    expect(tryDodgeEnemyAttackPacket({ ...state, rng: () => 0 }, [], false)).toBeNull();
    expect(state.dodgeChanceFromDamage).toBe(100);
  });
});

describe("Dodge tree rewards", () => {
  it("combines recovery and Armor with gear and grants Forge and Thorns once per packet", () => {
    const state = incomingPhysical({
      playerHealth: 50,
      talentEffects: fullTree,
      rng: () => 0,
      gearEffects: { healOnDodge: 2, armorOnDodge: 3 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({
        effects: [
          { kind: "damage", damageType: "physical", amount: 8 },
          { kind: "damage", damageType: "physical", amount: 8 },
        ],
      }),
      [],
    );
    expect(result.playerDodgeCount).toBe(2);
    expect(result.playerHealth).toBe(56);
    expect(result.playerStatuses).toMatchObject({ armor: 8, forge: 2, thorns: 2 });
    expect(state.playerStatuses).toMatchObject({ armor: 0, forge: 0, thorns: 0 });
  });

  it("Clean Getaway reduces each status and triggers cleanse rewards once only for complete removal", () => {
    const state = incomingPhysical({
      playerHealth: 50,
      playerStatuses: { burn: 1, poison: 2, bleed: 1, freeze: 3, stun: 3 },
      talentEffects: { cleanseStacksOnDodge: 1, healOnStatusCleanse: 4 },
    });
    const result = applyEnemyAbility(
      state,
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      [],
    );
    expect(result.playerStatuses).toMatchObject({ burn: 0, poison: 1, bleed: 0, freeze: 3, stun: 3 });
    expect(result.playerHealth).toBe(54);
    const partial = applyEnemyAbility(
      incomingPhysical({
        playerHealth: 50,
        playerStatuses: { burn: 3, poison: 3, bleed: 3 },
        talentEffects: state.talentEffects,
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      [],
    );
    expect(partial.playerHealth).toBe(50);
    expect(partial.playerStatuses).toMatchObject({ burn: 2, poison: 2, bleed: 2 });
  });

  it("Open Flank stacks with gear and repeated Dodges, then is spent by the next attack", () => {
    const state = incomingPhysical({
      talentEffects: { nextAttackPhysicalOnDodge: 4 },
      gearEffects: { nextAttackPhysicalOnDodge: 3 },
      rng: () => 0,
    });
    const dodged = applyEnemyAbility(
      applyEnemyAbility(
        state,
        makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
        [],
      ),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      [],
    );
    expect(dodged.flags.nextHitPhysicalBonus).toBe(14);
    const hit = dealDamage({ ...dodged, rng: () => 0.99 }, makeTestCard({ effects: [makeEffect("physical", 5)] }));
    expect(hit.enemyHealth).toBe(81);
    expect(hit.flags.nextHitPhysicalBonus).toBe(0);
  });

  it("retains existing Riposte and Footwork alongside new rewards", () => {
    const result = applyEnemyAbility(
      incomingPhysical({
        talentEffects: { ...fullTree, physicalOnDodgeEqualToAttack: true, blockOnDodgeEqualToAttack: true },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      [],
    );
    expect(result.playerStatuses.block).toBe(8);
    expect(result.playerStatuses.armor).toBe(1);
    expect(result.enemyHealth).toBeLessThan(100);
    expect(result.playerDodgeCount).toBe(1);
  });
});

describe("Rolling Recovery", () => {
  it.each([
    [4, 4],
    [5, 5],
    [6, 5],
    [10, 9],
  ])("rounds incoming %s Stun buildup to %s", (amount, expected) => {
    const state = patchBattleState({ talentEffects: { stunBuildupReductionPercent: 10 }, playerStatuses: { stun: 2 } });
    expect(addPlayerStatus(state, "stun", amount).playerStatuses.stun).toBe(2 + expected);
    expect(applyPlayerDamageStatuses(state, { damageType: "stun" }, amount).playerStatuses.stun).toBe(2 + expected);
  });

  it("does not reduce Health damage and scales buildup before the Stun threshold", () => {
    const result = applyEnemyAbility(
      incomingPhysical({
        rng: () => 0.99,
        playerHealth: 100,
        playerStatuses: { stun: 40 },
        talentEffects: { stunBuildupReductionPercent: 10 },
      }),
      makeEnemyTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 10 }] }),
      [],
    );
    expect(result.playerHealth).toBe(90);
    expect(result.playerStatuses.stun).toBe(49);
    expect(result.playerCC.stunSkipTurns).toBe(0);
    const stunned = resolvePlayerCrowdControlTriggers(addPlayerStatus(result, "stun", 1), []);
    expect(stunned.playerCC.stunSkipTurns).toBeGreaterThan(0);
  });
});

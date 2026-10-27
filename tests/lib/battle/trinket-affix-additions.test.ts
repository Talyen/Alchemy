import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { inspectedAttackAmounts } from "../../fixtures/inspection";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { projectEnemyDotDamage, detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { applyPlayerCombatDamage } from "@/lib/battle/health-state";
import { resolvePendingBattleReactions } from "@/lib/battle/enemy-attack-damage";
import { gainManaWithCombatText } from "@/lib/battle/player-rewards";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { resolveSecondaryAction } from "@/lib/battle/action-context";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { cardById, enemyById, type DamageType, type BattleCard } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle/types";
import { effectsForAffixRolls } from "@/lib/gear";
import { makeTestCard, patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

function battle(patch: BattleStatePatch = {}, options: Parameters<typeof patchBattleState>[1] = {}) {
  return patchBattleState(
    {
      enemyHealth: 100,
      enemyMaxHealth: 100,
      playerHealth: 40,
      playerMaxHealth: 40,
      currentEnemy: { ...enemyById.goblin, traits: [] },
      rng: () => 0.99,
      ...patch,
    },
    options,
  );
}

function attack(damageType: DamageType, amount = 3) {
  return makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType, amount }] });
}

function play(state: ReturnType<typeof battle>, card: BattleCard) {
  return playBattleCardResolved({ ...state, hand: [card] }, card.id, 0);
}

describe("Trinket affix additions", () => {
  it("adds Infected, Ashen Wake and Cauterize only to ongoing damage, including detonations", () => {
    const state = battle({
      enemyStatuses: { burn: 4, poison: 5, bleed: 4 },
      gearEffects: { bleedTickBonusVsPoisoned: 2, burnTickBonusVsPoisoned: 3, bleedTickBonusVsBurning: 1 },
    });
    for (const damageType of ["burn", "bleed"] as const) {
      const card = attack(damageType);
      const direct = play(state, card).state;
      const without = play({ ...state, gearEffects: battle().gearEffects }, card).state;
      expect(direct.enemyHealth).toBe(without.enemyHealth);
      expect(direct.enemyStatuses[damageType]).toBe(without.enemyStatuses[damageType]);
      expect(projectEnemyDotDamage(state, damageType)).toBe(7);
      expect(detonateEnemyStatuses(state, [damageType], []).enemyHealth).toBe(93);
    }
    const ticked = tickEnemyStatuses(state, []);
    // The two 7-damage ticks also earn the ordinary 4-damage Bloodboil reaction.
    expect(ticked.enemyHealth).toBe(77);
    expect(ticked.enemyStatuses).toMatchObject({ burn: 2, poison: 4, bleed: 0 });
    expect(projectEnemyDotDamage(battle({ gearEffects: state.gearEffects }), "bleed")).toBe(0);
    expect(
      projectEnemyDotDamage({ ...state, enemyStatuses: { ...state.enemyStatuses, poison: 0, burn: 0 } }, "bleed"),
    ).toBe(4);
  });

  it("shares periodic bonuses through Bloodember without adding them to direct hits", () => {
    const state = battle({
      enemyStatuses: { burn: 2, poison: 5, bleed: 2 },
      gearEffects: { sharedBurnBleedBonuses: 1, bleedTickBonusVsPoisoned: 2, burnTickBonusVsPoisoned: 3 },
    });
    expect(projectEnemyDotDamage(state, "burn")).toBe(7);
    expect(projectEnemyDotDamage(state, "bleed")).toBe(7);
    expect(play(state, attack("burn")).state.enemyHealth).toBe(97);
    expect(play(state, attack("bleed")).state.enemyHealth).toBe(97);
  });

  it("uses Executioner and Dazed on each hero attack, with strict Health and actual Stun conditions", () => {
    const state = battle({ enemyHealth: 30, gearEffects: { attackBonusVsLowHealth: 3, attackBonusVsStunned: 4 } });
    const double = makeTestCard({ cost: 0, effects: [attack("physical").effects[0]!, attack("physical").effects[0]!] });
    expect(play(state, double).state.enemyHealth).toBe(21);
    expect(
      play({ ...state, enemyStatuses: { ...state.enemyStatuses, stun: 50 } }, attack("physical")).state.enemyHealth,
    ).toBe(27);
    const stunned = { ...state, enemyCC: { ...state.enemyCC, stunSkipTurns: 1 } };
    expect(play(stunned, attack("physical")).state.enemyHealth).toBe(23);
    expect(
      computeCardDamageToEnemy(stunned, { kind: "damage", damageType: "physical", amount: 3 }).modifiedDamage,
    ).toBe(3);
    expect(
      computeCardDamageToEnemy(stunned, { kind: "damage", damageType: "physical", amount: 3 }, double, {
        manaAtStart: 4,
        origin: "companion",
      }).modifiedDamage,
    ).toBe(3);
  });

  it("adds Frostburn to Freeze attacks and their buildup, excluding triggered damage", () => {
    const state = battle({ enemyStatuses: { burn: 2 }, gearEffects: { freezeAttackBonusVsBurning: 4 } });
    const result = play(state, attack("freeze")).state;
    expect(result.enemyStatuses.freeze).toBe(7);
    expect(
      play({ ...state, enemyStatuses: { ...state.enemyStatuses, burn: 0 } }, attack("freeze")).state.enemyStatuses
        .freeze,
    ).toBe(3);
    expect(computeCardDamageToEnemy(state, { kind: "damage", damageType: "freeze", amount: 3 }).modifiedDamage).toBe(3);
  });

  it("grants Spellguard before card effects only when Mana is paid without existing Block", () => {
    const card = makeTestCard({
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 0, equalToBlock: true }],
    });
    const state = battle({ gearEffects: { blockOnPaidCardWithoutBlock: 2, flatBlockGained: 1 } });
    const paid = play(state, card);
    expect(paid.state.playerStatuses.block).toBe(3);
    expect(paid.state.enemyHealth).toBe(97);
    expect(paid.combatTexts).toContainEqual(expect.objectContaining({ target: "player", stat: "block", amount: 3 }));
    expect(play(state, { ...card, cost: 0 }).state.playerStatuses.block).toBe(0);
    expect(
      play({ ...state, playerStatuses: { ...state.playerStatuses, block: 1 } }, card).state.playerStatuses.block,
    ).toBe(1);
    const blockPaid = battle({
      mana: 0,
      playerStatuses: { block: 3 },
      gearEffects: { blockPaysFreezeMana: 1, blockOnPaidCardWithoutBlock: 2 },
    });
    expect(play(blockPaid, { ...attack("freeze"), cost: 1 }).state.playerStatuses.block).toBe(0);
    const free = { ...state, talentEffects: { ...state.talentEffects, homesteadFreeManaChance: 100 } };
    expect(play(free, card).state.playerStatuses.block).toBe(0);
  });

  it("grants Arcane Ward for actual Mana restoration, including Crystals, but not turn refills", () => {
    const state = battle({ mana: 0, gearEffects: { blockOnManaRestoreWithoutBlock: 2 } });
    const restored = gainManaWithCombatText(state, 1, []);
    expect(restored.playerStatuses.block).toBe(2);
    expect(gainManaWithCombatText(restored, 1, []).playerStatuses.block).toBe(2);
    expect(
      gainManaWithCombatText({ ...restored, playerStatuses: { ...restored.playerStatuses, block: 0 } }, 1, [])
        .playerStatuses.block,
    ).toBe(2);
    expect(gainManaWithCombatText({ ...state, mana: state.maxMana }, 1, []).playerStatuses.block).toBe(0);
    expect(advanceToPlayerTurn(state, []).playerStatuses.block).toBe(0);
    const crystal = makeTestCard({ effects: [{ kind: "gain-max-mana", amount: 1 }] });
    expect(applyCardEffects(state, crystal, []).playerStatuses.block).toBe(2);
  });

  it("applies Blur only below half Health and retains the Dodge cap", () => {
    const incoming = attack("physical", 1);
    const state = battle({ playerHealth: 20, gearEffects: { dodgeChanceBelowHalfHealth: 5 }, rng: () => 0.08 });
    expect(applyEnemyAbility(state, incoming, []).playerDodgeCount).toBe(0);
    expect(applyEnemyAbility({ ...state, playerHealth: 19 }, incoming, []).playerDodgeCount).toBe(1);
    expect(
      applyEnemyAbility(
        {
          ...state,
          playerHealth: 19,
          rng: () => 0.8,
          gearEffects: { ...state.gearEffects, dodgeChanceBelowHalfHealth: 100 },
        },
        incoming,
        [],
      ).playerDodgeCount,
    ).toBe(0);
  });

  it("pays Second Wind once across turns and reload, independently of the enemy's Second Wind", () => {
    const state = battle(
      {
        playerHealth: 11,
        gearEffects: { healOnFirstQuarterHealth: 6 },
        flags: { secondWindTriggered: true },
      },
      { enemyAbilityPressure: 0.95 },
    );
    const recovered = applyEnemyAbility(state, attack("physical", 2), []);
    expect(recovered.playerHealth).toBe(15);
    expect(recovered.flags.gearSecondWindUsed).toBe(true);
    const restored = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(recovered)));
    const next = advanceToPlayerTurn({ ...restored, rng: () => 0.99 }, []);
    expect(applyEnemyAbility({ ...next, playerHealth: 11 }, attack("physical", 2), []).playerHealth).toBe(9);
    const selfDamage = makeTestCard({ effects: [{ kind: "lose-health", amount: 2 }] });
    expect(play(state, selfDamage).state.playerHealth).toBe(15);
    const defeated = { ...state, deathsDoorUsed: true };
    expect(applyEnemyAbility(defeated, attack("physical", 99), []).playerHealth).toBe(0);
  });

  it("grants Deathgrip after the lethal hit spends Block, once on entry, with save-safe pending feedback", () => {
    const state = battle({
      playerHealth: 5,
      playerStatuses: { block: 3 },
      gearEffects: { blockOnDeathsDoorEntry: 4, flatBlockGained: 2 },
    });
    const texts: CombatTextEvent[] = [];
    const entered = applyEnemyAbility(state, attack("physical", 99), texts);
    expect(entered.playerStatuses.block).toBe(6);
    expect(entered.deathsDoorActive).toBe(true);
    expect(texts).toContainEqual(expect.objectContaining({ target: "player", stat: "block", amount: 6 }));
    expect(applyEnemyAbility(entered, attack("physical", 99), []).playerStatuses.block).toBe(0);
    const pending = applyPlayerCombatDamage(battle({ gearEffects: { blockOnDeathsDoorEntry: 4 } }), 99, "self");
    const loaded = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(pending)));
    const settled = resolvePendingBattleReactions({ ...loaded, rng: () => 0.99 }, []);
    expect(settled.playerStatuses.block).toBe(4);
    expect(resolvePendingBattleReactions(settled, []).playerStatuses.block).toBe(4);
  });

  it("Disrupting purges only on a successful Stun and pays the ordinary Purge rewards", () => {
    const state = battle({
      enemyStatuses: { stun: 45 },
      enemyMitigation: { forge: 2 },
      gearEffects: { purgeOnStunChance: 100, blockOnPurge: 3, holyOnPurge: 2 },
    });
    const result = play(state, attack("stun", 5));
    expect(result.state.enemyCC.stunSkipTurns).toBeGreaterThan(0);
    expect(result.state.enemyMitigation.forge).toBe(0);
    expect(result.state.playerStatuses.block).toBe(3);
    expect(result.state.enemyHealth).toBe(93);
    expect(result.state.flags.pendingDisruptingPurge).toBe(false);
    expect(result.combatTexts).toContainEqual(expect.objectContaining({ signal: "purge" }));
    expect(
      play({ ...state, gearEffects: { ...state.gearEffects, purgeOnStunChance: 25 } }, attack("stun", 5)).state
        .enemyMitigation.forge,
    ).toBe(2);
    expect(
      play({ ...state, enemyStatuses: { ...state.enemyStatuses, stun: 0 } }, attack("stun", 5)).state.enemyMitigation
        .forge,
    ).toBe(2);
  });

  it("refreshes Whiplash on Dodge and spends its saved charge on one Stun hit, matching inspection", () => {
    const incoming = attack("physical", 1);
    const state = battle({
      deck: [cardById.slash!],
      gearEffects: { nextStunAttackBonusOnDodge: 4 },
      flags: { dodgeNextAttack: true },
    });
    const dodged = applyEnemyAbility(state, incoming, []);
    const dodgedAgain = applyEnemyAbility(
      { ...dodged, flags: { ...dodged.flags, dodgeNextAttack: true } },
      incoming,
      [],
    );
    expect(dodgedAgain.flags.nextStunAttackBonus).toBe(4);
    const loaded = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(dodgedAgain)));
    const next = advanceToPlayerTurn({ ...loaded, rng: () => 0.99 }, []);
    expect(play(next, attack("physical")).state.flags.nextStunAttackBonus).toBe(4);
    const secondary = resolveSecondaryAction(next, "companion", (current) =>
      applyCardEffects(current, attack("stun"), []),
    );
    expect(secondary.flags.nextStunAttackBonus).toBe(4);
    expect(secondary.enemyHealth).toBe(next.enemyHealth - 3);
    const double = makeTestCard({ cost: 0, effects: [attack("stun").effects[0]!, attack("stun").effects[0]!] });
    expect(inspectedAttackAmounts(double, next)).toEqual([7, 3]);
    const result = play(next, double).state;
    expect(result.enemyHealth).toBe(next.enemyHealth - 10);
    expect(result.flags.nextStunAttackBonus).toBe(0);
    expect(play({ ...next, rng: () => 0.01 }, attack("stun")).state.flags.nextStunAttackBonus).toBe(4);
  });

  it("defaults new saved effects and charges, and adds equipped copies without sharing the enemy's recovery allowance", () => {
    const gearEffects = effectsForAffixRolls([
      { id: "next-stun-attack-on-dodge", value: 4 },
      { id: "next-stun-attack-on-dodge", value: 5 },
    ]);
    const state = battle({
      gearEffects,
      flags: { gearSecondWindUsed: true, nextStunAttackBonus: 9, pendingDisruptingPurge: true },
    });
    const saved = JSON.parse(JSON.stringify(state));
    expect(PersistedBattleStateSchema.parse(saved).flags).toEqual(state.flags);
    expect(state.gearEffects.nextStunAttackBonusOnDodge).toBe(9);
    delete saved.flags.gearSecondWindUsed;
    delete saved.flags.nextStunAttackBonus;
    saved.flags.pendingDisruptingPurge = Number.MAX_SAFE_INTEGER;
    delete saved.flags.pendingDeathgripBlock;
    delete saved.gearEffects.nextStunAttackBonusOnDodge;
    const restored = PersistedBattleStateSchema.parse(saved);
    expect(restored.flags).toMatchObject({
      gearSecondWindUsed: false,
      nextStunAttackBonus: 0,
      pendingDisruptingPurge: false,
      pendingDeathgripBlock: false,
    });
    expect(restored.gearEffects.nextStunAttackBonusOnDodge).toBe(0);
  });
});

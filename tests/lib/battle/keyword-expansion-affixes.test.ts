import { describe, expect, it } from "vitest";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { applyHealingWithCombatText, payKillPayouts } from "@/lib/battle/player-rewards";
import { resolvePendingBattleReactions } from "@/lib/battle/enemy-attack-damage";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { resolveDeathsDoorGraceExpiry } from "@/lib/battle/player-turn-transition";
import { applyPlayerCombatDamage, type CombatTextEvent } from "@/lib/battle/types";
import { applyPurgeGearRewards, purgeEnemyBenefits } from "@/lib/battle/enemy-purge";
import { applyDodgeTalentStatuses } from "@/lib/battle/dodge-talent-rewards";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { gearAffixCatalog } from "@/lib/gear";
import { keywordExpansionAffixes } from "@/lib/gear/keyword-expansion-affixes";
import { gearDefinitions } from "@/lib/gear/definitions";
import { buildEligibleAffixPool } from "@/lib/gear/affix-pool";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const strike = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });

it("makes every new affix eligible through an existing item affinity", () => {
  const definitions = Object.values(gearDefinitions).filter((definition) => definition.rarity !== null);
  const unavailable = keywordExpansionAffixes.filter(
    (affix) => !definitions.some((definition) => buildEligibleAffixPool(definition).some((row) => row.id === affix.id)),
  );
  expect(unavailable.map((affix) => affix.id)).toEqual([]);
});

describe("ported Thorns affixes", () => {
  it("grants Ironbriar Thorns only when Block remains after turn decay", () => {
    const state = patchBattleState({ playerStatuses: { block: 4 }, gearEffects: { thornsOnRetainedBlock: 1 } });
    const next = advanceToPlayerTurn(state, []);
    expect(next.playerStatuses).toMatchObject({ block: 2, thorns: 1 });

    const depleted = advanceToPlayerTurn(
      patchBattleState({ playerStatuses: { block: 0 }, gearEffects: { thornsOnRetainedBlock: 1 } }),
      [],
    );
    expect(depleted.playerStatuses).toMatchObject({ block: 0, thorns: 0 });
  });

  it("adds Bristling damage only while Block remains at retaliation", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      playerStatuses: { block: 3, thorns: 3 },
      gearEffects: { thornsDamageWhileBlocked: 2 },
      rng: () => 0.99,
    });
    const blocked = applyEnemyAbility(state, strike, []);
    expect(blocked.enemyHealth).toBe(25);

    const unblocked = applyEnemyAbility(
      { ...state, playerStatuses: { ...state.playerStatuses, block: 0 } },
      strike,
      [],
    );
    expect(unblocked.enemyHealth).toBe(27);
  });

  it("heals from the first damaging Thorns retaliation each turn", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 20,
      playerStatuses: { thorns: 3 },
      enemyHealth: 30,
      enemyMaxHealth: 30,
      gearEffects: { healOnFirstThornsDamageEachTurn: 2 },
      rng: () => 0.99,
    });
    const first = applyEnemyAbility(state, strike, []);
    expect(first.playerHealth).toBe(11);
    expect(first.flags.spitefulHealedThisTurn).toBe(true);

    const second = applyEnemyAbility({ ...first, playerStatuses: { ...first.playerStatuses, thorns: 3 } }, strike, []);
    expect(second.playerHealth).toBe(10);
    expect(second.enemyHealth).toBe(24);
    expect(advanceToPlayerTurn(second, []).flags.spitefulHealedThisTurn).toBe(false);
  });

  it("keeps the agreed Basic and Astral ranges", () => {
    expect(gearAffixCatalog["thorns-on-retained-block"].roll).toMatchObject({
      basic: { min: 1, max: 2 },
      astral: { min: 2, max: 4 },
    });
    expect(gearAffixCatalog["heal-on-first-thorns-damage"].roll).toMatchObject({
      basic: { min: 1, max: 3 },
      astral: { min: 3, max: 5 },
    });
    expect(gearAffixCatalog["thorns-damage-while-blocked"].roll).toMatchObject({
      basic: { min: 1, max: 3 },
      astral: { min: 3, max: 5 },
    });
    expect(gearAffixCatalog["purge-on-first-paid-card"].roll).toMatchObject({
      basic: { min: 1, max: 1 },
      astral: { min: 1, max: 1 },
    });
  });
});

describe("ported Cleanse affix reactions", () => {
  it("cleanses after actual healing and rewards a removed harmful status", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 20,
      mana: 0,
      maxMana: 5,
      playerStatuses: { poison: 3 },
      gearEffects: { healCleanseChance: 100, blockOnCleanse: 2, manaOnCleanse: 1 },
      rng: () => 0.01,
    });
    const healed = applyHealingWithCombatText(state, 2, []);
    expect(healed.playerStatuses).toMatchObject({ poison: 0, block: 2 });
    expect(healed.mana).toBe(1);

    const full = applyHealingWithCombatText({ ...state, playerHealth: 20 }, 2, []);
    expect(full.playerStatuses).toMatchObject({ poison: 3, block: 0 });
    expect(full.mana).toBe(0);
  });

  it("rewards each status removed by a multi-status Cleanse", () => {
    const state = patchBattleState({
      playerStatuses: { stun: 1, freeze: 1 },
      mana: 0,
      maxMana: 5,
      talentEffects: { cleanseCcOnDodge: true },
      gearEffects: { blockOnCleanse: 2, manaOnCleanse: 1 },
    });
    const cleansed = applyDodgeTalentStatuses(state, []);
    expect(cleansed.playerStatuses).toMatchObject({ stun: 0, freeze: 0, block: 4 });
    expect(cleansed.mana).toBe(2);
  });

  it("lets Restorative Cleanse after a kill reward restores Health", () => {
    const state = patchBattleState({
      enemyHealth: 0,
      playerHealth: 10,
      playerMaxHealth: 20,
      playerStatuses: { poison: 2 },
      gearEffects: { healOnKill: 2, healCleanseChance: 100, blockOnCleanse: 2 },
      rng: () => 0.01,
    });
    const rewarded = payKillPayouts(state, true, []);
    expect(rewarded.playerHealth).toBe(12);
    expect(rewarded.playerStatuses).toMatchObject({ poison: 0, block: 2 });
  });
});

describe("ported Death's Door affix reactions", () => {
  it("deals Emberwake Burn only when Death's Door first activates", () => {
    const state = patchBattleState({
      playerHealth: 2,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      gearEffects: { burnOnDeathsDoorEntry: 3 },
      rng: () => 0.99,
    });
    const entered = applyPlayerCombatDamage(state, 2, "hostile");
    expect(entered.deathsDoorActive).toBe(true);
    const reacted = resolvePendingBattleReactions(entered, []);
    expect(reacted.enemyHealth).toBeLessThan(30);
    expect(reacted.flags.pendingEmberwakeDamage).toBe(false);

    const laterHit = resolvePendingBattleReactions(applyPlayerCombatDamage(reacted, 2, "hostile"), []);
    expect(laterHit.enemyHealth).toBe(reacted.enemyHealth);
  });

  it("adds Lastwatch's Critical Hit chance only during the grace window", () => {
    const effect = { kind: "damage", damageType: "physical", amount: 2 } as const;
    const state = patchBattleState({
      deathsDoorActive: true,
      gearEffects: { criticalChanceWhileDeathsDoor: 100 },
      rng: () => 0.99,
    });
    expect(computeCardDamageToEnemy(state, effect).critical).toBe(true);
    expect(computeCardDamageToEnemy({ ...state, deathsDoorActive: false }, effect).critical).toBe(false);
  });

  it("restores Rekindled Health when Death's Door expires with the hero alive", () => {
    const state = patchBattleState({
      playerHealth: 1,
      playerMaxHealth: 20,
      deathsDoorActive: true,
      deathsDoorUsed: true,
      deathsDoorGraceTurnsRemaining: 0,
      gearEffects: { healOnDeathsDoorSurvival: 3 },
    });
    const expired = resolveDeathsDoorGraceExpiry(state, []);
    expect(expired.deathsDoorActive).toBe(false);
    expect(expired.playerHealth).toBe(4);
  });
});

describe("ported Purge affix rewards", () => {
  it("rewards a successful Purge once even when it removes two benefits", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: { armor: 2, block: 3, forge: 0 },
      gearEffects: { blockOnPurge: 2, holyOnPurge: 2 },
      rng: () => 0.99,
    });
    const texts: CombatTextEvent[] = [];
    const purged = purgeEnemyBenefits(state, 2, texts);
    const rewarded = applyPurgeGearRewards(purged.state, purged.removed, texts);
    expect(purged.removed).toBe(2);
    expect(rewarded.enemyMitigation).toMatchObject({ armor: 0, block: 0 });
    expect(rewarded.playerStatuses.block).toBe(2);
    expect(rewarded.enemyHealth).toBe(28);

    const emptyTexts: CombatTextEvent[] = [];
    const empty = purgeEnemyBenefits(rewarded, 1, emptyTexts);
    expect(empty.removed).toBe(0);
    expect(emptyTexts).toEqual([]);
    expect(applyPurgeGearRewards(empty.state, empty.removed, []).enemyHealth).toBe(28);
  });

  it("uses Spellrending before the first paid card resolves and only once per turn", () => {
    const attack = makeTestCard({
      id: "paid-attack",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    const support = makeTestCard({ id: "paid-support", cost: 1, effects: [] });
    const state = patchBattleState({
      hand: [attack],
      mana: 2,
      maxMana: 2,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: { armor: 0, block: 3, forge: 0 },
      gearEffects: { purgeOnFirstPaidCard: 1 },
      rng: () => 0.99,
    });
    const first = playBattleCardResolved(state, attack.id, 0).state;
    expect(first.flags.spellrendingUsedThisTurn).toBe(true);
    expect(first.enemyMitigation.block).toBe(0);
    expect(first.enemyHealth).toBe(26);

    const second = playBattleCardResolved(
      { ...first, hand: [support], enemyMitigation: { ...first.enemyMitigation, block: 3 } },
      support.id,
      0,
    ).state;
    expect(second.enemyMitigation.block).toBe(3);
    expect(advanceToPlayerTurn(second, []).flags.spellrendingUsedThisTurn).toBe(false);

    const free = makeTestCard({ id: "free-support", cost: 0, effects: [] });
    const freeResult = playBattleCardResolved({ ...state, hand: [free] }, free.id, 0).state;
    expect(freeResult.flags.spellrendingUsedThisTurn).toBe(false);
    expect(freeResult.enemyMitigation.block).toBe(3);
  });

  it("stops the paid card's attack if its Purge reward defeats the enemy", () => {
    const attack = makeTestCard({
      id: "finishing-card",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    });
    const state = patchBattleState({
      hand: [attack],
      mana: 1,
      enemyHealth: 1,
      enemyMaxHealth: 1,
      enemyMitigation: { armor: 1, block: 0, forge: 0 },
      gearEffects: { purgeOnFirstPaidCard: 1, holyOnPurge: 2 },
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, attack.id, 0);
    expect(result.state.enemyHealth).toBe(0);
    expect(result.combatTexts.some((event) => event.kind === "damage" && event.stat === "physical")).toBe(false);
  });
});

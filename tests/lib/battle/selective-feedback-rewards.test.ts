import { describe, expect, it } from "vitest";
import { cardById, companionLibrary, computeTalentEffects, type BattleCard } from "@/lib/game-data";
import type { CombatTextEvent } from "@/lib/battle";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { addGoldWithCombatText, applyHealingWithCombatText, gainManaWithCombatText } from "@/lib/battle/combat-text";
import { applyDamageStatuses } from "@/lib/battle/damage-status-riders";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { applyWishEffect } from "@/lib/battle/wish";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { applyLeechHealing } from "@/lib/battle/damage-rider-leech";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";

function battle(patch: BattleStatePatch = {}) {
  return patchBattleState({
    playerHealth: 10,
    playerMaxHealth: 40,
    enemyHealth: 200,
    enemyMaxHealth: 200,
    mana: 10,
    maxMana: 10,
    gold: 0,
    currentEnemy: { traits: [] },
    rng: () => 0.99,
    ...patch,
  });
}
function play(state: ReturnType<typeof battle>, card: BattleCard, remaining: BattleCard[] = []) {
  return playBattleCardResolved({ ...state, hand: [card, ...remaining] }, card.id, 0);
}
function resume(state: ReturnType<typeof battle>) {
  return {
    ...PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(state))),
    rng: () => 0.99,
    appliesFightPacing: false,
    currentEnemy: state.currentEnemy,
  };
}
const attack = makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "physical", amount: 2 }] });
const arrow = makeTestCard({ cost: 0, tags: ["archery"], effects: attack.effects });
const incoming = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] });

describe("selective feedback rewards", () => {
  it.each([0, 1, 10])("Arcane Mending checks Mana before a gain from %i", (mana) => {
    const state = battle({ mana, talentEffects: computeTalentEffects({ mana: ["mana-arcane-mending"] }) });
    const texts: CombatTextEvent[] = [];
    const next = gainManaWithCombatText(state, 2, texts);
    expect(next.playerHealth).toBe(mana === 0 ? 12 : 10);
    expect(texts.some((text) => text.kind === "heal")).toBe(mana === 0);
    const crystal = makeTestCard({ cost: 0, effects: [{ kind: "gain-max-mana", amount: 1 }] });
    expect(play(state, crystal).state.playerHealth).toBe(mana === 0 ? 12 : 10);
  });

  it.each([19, 20, 39, 40])("Holy healing and Block use distinct Health windows at %i", (health) => {
    const holy = makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "holy", amount: 20 }] });
    const result = play(
      battle({
        playerHealth: health,
        talentEffects: computeTalentEffects({ holy: ["holy-lifesteal", "holy-block-grant"] }),
      }),
      holy,
    );
    expect(result.state.playerHealth).toBe(health < 20 ? health + 3 : health);
    expect(result.state.playerStatuses.block).toBe(health === 40 ? 3 : 0);
    expect(result.combatTexts).toHaveLength(health < 20 || health === 40 ? 2 : 1);
  });

  it("a healing Holy hit cannot enable Radiant Guard with its own healing", () => {
    const holy = makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "holy", amount: 20 }] });
    const result = play(
      battle({ playerHealth: 19, talentEffects: { holyLifestealPercent: 200, holyBlockPercentFromDamage: 15 } }),
      holy,
    );
    expect(result.state.playerHealth).toBe(40);
    expect(result.state.playerStatuses.block).toBe(0);
  });

  it("Overflow accepts card healing but not passive or explicit Leech healing", () => {
    const state = battle({ playerHealth: 39, talentEffects: { overhealToBlockRatio: 0.25 } });
    const heal = makeTestCard({ cost: 0, effects: [{ kind: "heal", amount: 9 }] });
    expect(play(state, heal).state.playerStatuses.block).toBe(2);
    expect(applyHealingWithCombatText(state, 9, []).playerStatuses.block).toBe(0);
    expect(applyLeechHealing(state, 9, [], { cardHealing: true }).playerStatuses.block).toBe(0);
  });

  it("Feast requires a Potion's own healing to move from injured to full", () => {
    const state = battle({ talentEffects: computeTalentEffects({ consume: ["consume-feast"] }) });
    const potion = cardById["health-potion"]!;
    expect(play({ ...state, playerHealth: 32 }, potion).state.playerStatuses.block).toBe(4);
    expect(play({ ...state, playerHealth: 40 }, potion).state.playerStatuses.block).toBe(0);
    expect(play({ ...state, playerHealth: 31 }, potion).state.playerStatuses.block).toBe(0);
    expect(play({ ...state, playerHealth: 36 }, cardById.apple!).state.playerStatuses.block).toBe(0);
  });

  it("Rotgut and Consuming strengthen existing packets without creating another hit", () => {
    const acid = cardById["acid-potion"]!;
    const result = play(battle({ talentEffects: computeTalentEffects({ consume: ["consume-rotgut"] }) }), acid);
    expect(result.combatTexts).toEqual([{ target: "enemy", kind: "damage", stat: "poison", amount: 3 }]);
    expect(result.state.enemyStatuses.poison).toBe(3);
    const burn = makeTestCard({ cost: 0, consume: true, effects: [{ kind: "damage", damageType: "burn", amount: 2 }] });
    const gear = battle({ gearEffects: { burnOnConsume: 3 } });
    expect(play(gear, burn).combatTexts).toEqual([{ target: "enemy", kind: "damage", stat: "burn", amount: 5 }]);
    expect(play(gear, { ...burn, consume: false }).state.enemyHealth).toBe(198);
    expect(play(gear, cardById["health-potion"]!).state.enemyHealth).toBe(200);
    const nonPotion = makeTestCard({ cost: 0, effects: [{ kind: "damage", damageType: "poison", amount: 1 }] });
    expect(play(battle({ talentEffects: { poisonDamageOnConsume: 2 } }), nonPotion).state.enemyHealth).toBe(199);
  });

  it("Last Supper uses the hand before card draws, and pays only once for repeats", () => {
    const consume = makeTestCard({ cost: 0, consume: true, effects: [{ kind: "draw-cards", amount: 1 }] });
    const state = battle({
      deck: [attack, attack, attack],
      flags: { playNextCardTwice: true },
      talentEffects: computeTalentEffects({ consume: ["consume-last-supper", "consume-second-helping"] }),
    });
    const last = play(state, consume);
    expect(last.state.playerStatuses.forge).toBe(3);
    expect(last.state.hand).toHaveLength(3);
    expect(play(state, consume, [attack]).state.playerStatuses.forge).toBe(0);
  });

  it.each([0.249, 0.25, 0.499, 0.5])("reward chances retain their strict percent boundaries at %s", (roll) => {
    const state = battle({
      rng: () => roll,
      talentEffects: computeTalentEffects({ consume: ["consume-leftovers"] }),
      gearEffects: { goldOnWish: 3 },
    });
    const consume = makeTestCard({ cost: 0, consume: true, effects: [] });
    expect(play(state, consume).state.gold).toBe(roll < 0.25 ? 4 : 0);
    expect(applyWishEffect(state, makeTestCard(), 1, []).gold).toBe(roll < 0.5 ? 3 : 0);
  });

  it.each([0.249, 0.25])("Bladedance only auto-plays after a successful proc at %s", (roll) => {
    const drawn = makeTestCard({
      cost: 0,
      consume: true,
      effects: [{ kind: "player-status", status: "forge", amount: 1 }],
    });
    const state = battle({
      rng: () => roll,
      deck: [drawn],
      gearEffects: { dodgeChance: 70, dodgeDrawAndPlay: 1 },
      talentEffects: { forgeOnConsume: 3 },
    });
    const result = applyEnemyAbility(state, incoming, []);
    expect(result.playerDodgeCount).toBe(1);
    expect(result.exhausted).toHaveLength(roll < 0.25 ? 1 : 0);
    expect(result.playerStatuses.forge).toBe(roll < 0.25 ? 1 : 0); // Never consumes the last held card.
  });

  it("Gold conversion rewards require empty defenses and do not repeat on filled resources", () => {
    const state = battle({ talentEffects: { blockPerGold: 0.25 }, gearEffects: { goldGrantsForgeAndHoly: 1 } });
    const first = addGoldWithCombatText(state, 4, []);
    expect(first.playerStatuses).toMatchObject({ block: 1, forge: 4 });
    const texts: CombatTextEvent[] = [];
    const second = addGoldWithCombatText(first, 4, texts);
    expect(second.playerStatuses).toEqual(first.playerStatuses);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 4 }]);
  });

  it("Stun combines matching talent/affix rewards, then suppresses filled resources", () => {
    const state = battle({
      mana: 0,
      enemyStatuses: { stun: 120 },
      talentEffects: { blockOnStun: 4, forgeOnStun: 2, manaOnStun: 1 },
      gearEffects: { blockOnStun: 3, forgeOnStun: 1, manaOnStun: 2 },
    });
    const first = resolveStunTrigger(state, []);
    expect(first.playerStatuses).toMatchObject({ block: 7, forge: 3 });
    expect(first.mana).toBe(3);
    const texts: CombatTextEvent[] = [];
    const second = resolveStunTrigger({ ...first, enemyCC: state.enemyCC, enemyStatuses: state.enemyStatuses }, texts);
    expect(second.playerStatuses).toEqual(first.playerStatuses);
    expect(second.mana).toBe(3);
    expect(texts.every((text) => text.target === "enemy")).toBe(true);
  });

  it.each([0.1, 0.6])("Dodge reward rolls succeed or fail independently of Dodge at %s", (roll) => {
    const talents = computeTalentEffects({
      dodge: ["dodge-feint", "dodge-perfect-timing"],
      gold: ["gold-per-combat"],
      companion: ["companion-loyal"],
    });
    const state = battle({
      rng: () => roll,
      playerStatuses: { block: 1, armor: 1 },
      activeCompanion: companionLibrary["lizard-scout"],
      talentEffects: talents,
      gearEffects: { dodgeChance: 70, blockOnDodge: 3, armorOnDodge: 2 },
    });
    const texts: CombatTextEvent[] = [];
    const next = applyEnemyAbility(state, incoming, texts);
    expect(next.playerDodgeCount).toBe(1);
    expect(next.playerStatuses).toMatchObject({ block: 1, armor: 1, forge: roll < 0.25 ? 2 : 0 });
    expect(next.gold).toBe(roll < 0.25 ? 4 : 0);
    expect(next.enemyHealth < state.enemyHealth).toBe(roll < 0.5);
    if (roll > 0.5) expect(texts).toHaveLength(1);
  });

  it("Dodge adds both Armor rewards when empty, while healing remains below-half only", () => {
    const state = battle({
      rng: () => 0.1,
      playerHealth: 19,
      talentEffects: { armorOnDodge: 2 },
      gearEffects: { armorOnDodge: 3, healOnDodge: 2, dodgeChance: 70 },
    });
    const first = applyEnemyAbility(state, incoming, []);
    expect(first.playerStatuses.armor).toBe(5);
    expect(first.playerHealth).toBe(21);
    const second = applyEnemyAbility(first, incoming, []);
    expect(second.playerStatuses.armor).toBe(5);
    expect(second.playerHealth).toBe(21);
  });

  it("Wish affixes use the pre-reward Health, Mana, and Burn conditions", () => {
    const state = battle({
      mana: 0,
      playerHealth: 19,
      talentEffects: { healthOnWish: 2, burnOnWish: 1 },
      gearEffects: { healthOnWish: 3, manaOnWish: 1, burnOnWish: 4 },
    });
    const first = applyWishEffect(state, makeTestCard(), 1, []);
    expect(first.playerHealth).toBe(24);
    expect(first.mana).toBe(1);
    expect(first.enemyHealth).toBe(199); // Talent Burn cannot enable Wishfire in the same Wish.
    const second = applyWishEffect(first, makeTestCard(), 1, []);
    expect(second.playerHealth).toBe(26);
    expect(second.mana).toBe(1);
    expect(second.enemyHealth).toBe(194);
  });

  it("Rimeheart cannot repeatedly grant Block or refill a nonempty Mana pool", () => {
    const state = battle({ mana: 0, gearEffects: { freezeGrantsBlockAndMana: 1 }, enemyHealth: 40 });
    const freeze = { kind: "damage" as const, damageType: "freeze" as const, amount: 20 };
    const first = applyDamageStatuses(state, freeze, 20, []);
    expect(first.playerStatuses.block).toBe(20);
    expect(first.mana).toBe(10);
    const second = applyDamageStatuses({ ...first, mana: 1, enemyCC: state.enemyCC }, freeze, 20, []);
    expect(second.playerStatuses.block).toBe(20);
    expect(second.mana).toBe(1);
  });

  it("Watchdog and Kinbound use Companion-action starting conditions", () => {
    const state = battle({
      activeCompanion: companionLibrary["lizard-scout"],
      playerHealth: 19,
      talentEffects: { blockOnCompanionDamage: 1 },
      gearEffects: { healOnCompanionAttack: 3 },
    });
    const first = processCompanionTurnStart(state, []);
    expect(first.playerHealth).toBe(22);
    expect(first.playerStatuses.block).toBe(1);
    const second = processCompanionTurnStart(first, []);
    expect(second.playerHealth).toBe(22);
    expect(second.playerStatuses.block).toBe(1);
  });

  it("Sun-Struck Shield reflects only attack depletion, not partial losses or non-attack damage", () => {
    const state = battle({
      playerStatuses: { block: 10 },
      talentEffects: { holyReflectionBlockLostPercent: 30, blockDepletedHeal: 2 },
      gearEffects: { saintfallRetribution: 0 },
    });
    const partial = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 5 }, [], {
      triggerBlockRetaliation: true,
    });
    expect(partial.enemyHealth).toBe(200);
    const broken = processEnemyDamageEffect(partial, { kind: "damage", damageType: "physical", amount: 5 }, [], {
      triggerBlockRetaliation: true,
    });
    expect(broken.enemyHealth).toBe(198);
    expect(
      processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 10 }, []).enemyHealth,
    ).toBe(200);
  });
  it("Block replenished by a Health threshold does not cancel depletion reflection", () => {
    const state = battle({
      playerHealth: 21,
      playerStatuses: { block: 10 },
      talentEffects: { holyReflectionBlockLostPercent: 30, healthThresholdBlock: { threshold: 50, amount: 6 } },
    });
    const result = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 12 }, [], {
      triggerBlockRetaliation: true,
    });
    expect(result.playerHealth).toBe(19);
    expect(result.playerStatuses.block).toBe(6);
    expect(result.enemyHealth).toBe(197);
  });
});

describe("saved reaction allowances", () => {
  it("Hawk Eye survives Freeze expiry and resume, spends on one landed Archery hit, and rearms", () => {
    const state = battle({ talentEffects: computeTalentEffects({ archery: ["archery-hawk-eye"] }), enemyHealth: 80 });
    const freeze = { kind: "damage" as const, damageType: "freeze" as const, amount: 40 };
    const frozen = applyDamageStatuses(state, freeze, 40, []);
    expect(frozen.flags.hawkEyeReady).toBe(true);
    const thawed = resume({ ...frozen, enemyCC: state.enemyCC });
    expect(play(thawed, attack).state.flags.hawkEyeReady).toBe(true);
    expect(play({ ...thawed, rng: () => 0 }, arrow).state.flags.hawkEyeReady).toBe(true);
    const first = play(thawed, arrow);
    expect(first.combatTexts).toEqual([
      { target: "enemy", kind: "damage", stat: "holy", amount: 4 },
      { target: "enemy", kind: "damage", stat: "physical", amount: 2 },
    ]);
    expect(first.state.enemyHealth).toBe(74);
    expect(first.state.flags.hawkEyeReady).toBe(false);
    expect(play(first.state, arrow).state.enemyHealth).toBe(72);
    const rearmed = applyDamageStatuses(first.state, freeze, 40, []);
    expect(rearmed.flags.hawkEyeReady).toBe(true);
    expect(play(resume(rearmed), arrow).state.enemyHealth).toBe(68);
  });

  it("Verdict pays only once across renewed Stuns, turn boundaries, and save/resume", () => {
    const state = battle({ enemyStatuses: { stun: 120 }, gearEffects: { holyStunBuildupGold: 3 } });
    const first = resolveStunTrigger(state, []);
    expect(first.gold).toBe(3);
    const second = resolveStunTrigger(
      { ...resume(first), turn: 10, enemyCC: state.enemyCC, enemyStatuses: state.enemyStatuses },
      [],
    );
    expect(second.gold).toBe(3);
    expect(second.flags.verdictGoldPaid).toBe(true);
    const oldSave = JSON.parse(JSON.stringify(first));
    delete oldSave.flags.verdictGoldPaid;
    delete oldSave.flags.hawkEyeReady;
    expect(PersistedBattleStateSchema.parse(oldSave).flags).toMatchObject({
      verdictGoldPaid: false,
      hawkEyeReady: false,
    });
    oldSave.flags.verdictGoldPaid = "true";
    oldSave.flags.hawkEyeReady = 1;
    expect(PersistedBattleStateSchema.parse(oldSave).flags).toMatchObject({
      verdictGoldPaid: false,
      hawkEyeReady: false,
    });
  });
});

import { describe, expect, it } from "vitest";
import { computeTalentEffects } from "@/lib/game-data";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { applyTalentHitConversions, resolveFollowUpHit } from "@/lib/battle/follow-up-hit-resolution";
import { applyLeechHealing, applyLeechHitHealing, applyHolyBlockChance } from "@/lib/battle/damage-rider-leech";
import { applyPoisonTalentRiders, applyDamageStatuses } from "@/lib/battle/damage-status-riders";
import { applyBlockReward, applyHealthLossTalentRewards, checkHealthThresholds } from "@/lib/battle/status-player";
import { gainManaWithCombatText } from "@/lib/battle/player-rewards";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { companionLibrary } from "@/lib/game-data";
import { patchBattleState } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";

describe("Talent rework batch", () => {
  it("Desperate Guard grants Block only on the first surviving half-Health crossing", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerMaxHealth: 40,
      talentEffects: computeTalentEffects({ health: ["health-threshold-block"] }),
    });

    const first = checkHealthThresholds(20, 19, state, []);
    const second = checkHealthThresholds(21, 19, { ...first, playerHealth: 21 }, []);

    expect(first.playerStatuses.block).toBe(6);
    expect(second.playerStatuses.block).toBe(6);
    expect(first.flags.desperateGuardUsed).toBe(true);
  });

  it("Faith Barrier grants full resolved Holy damage as Block", () => {
    const state = patchBattleState({
      rng: () => 0,
      talentEffects: computeTalentEffects({ holy: ["holy-block-scaling"] }),
    });

    expect(applyHolyBlockChance(state, 7, []).playerStatuses.block).toBe(7);
  });

  it("Scorching Light converts a successful Holy proc into full Burn damage", () => {
    const state = patchBattleState({
      enemyHealth: 40,
      enemyMaxHealth: 40,
      rng: () => 0,
      talentEffects: computeTalentEffects({ holy: ["holy-burn-chance"] }),
    });

    const next = applyTalentHitConversions(state, "holy", 4, []);

    expect(next.enemyHealth).toBe(36);
    expect(next.enemyStatuses.burn).toBe(4);
  });

  it("Radiant Guard draws a Holy card from the normal deck path", () => {
    const holyCard = makeTestCard({ id: "holy-drawn", tags: ["holy"] });
    const state = patchBattleState({
      deck: [holyCard],
      rng: () => 0,
      talentEffects: computeTalentEffects({ holy: ["holy-block-grant"] }),
    });

    const next = applyBlockReward(state, 1, []);

    expect(next.hand.map((card) => card.id)).toEqual(["holy-drawn"]);
  });

  it("Blood Debt pays Gold from actual Leech Health restored", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      rng: () => 0,
      talentEffects: computeTalentEffects({ leech: ["leech-blood-debt"] }),
    });

    const next = applyLeechHealing(state, 4, []);

    expect(next.playerHealth).toBe(14);
    expect(next.gold).toBe(4);
  });

  it("Desperate Siphon doubles Leech below half Health", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: computeTalentEffects({ leech: ["leech-desperate"] }),
    });

    expect(applyLeechHitHealing(state, 4, [], false, false).playerHealth).toBe(14);
  });

  it("Bloodletting cleanses one harmful status after positive Health loss", () => {
    const before = patchBattleState({
      playerHealth: 20,
      playerMaxHealth: 30,
      playerStatuses: { poison: 3, bleed: 2 },
      rng: () => 0,
      talentEffects: computeTalentEffects({ leech: ["leech-bleed-chance"] }),
    });
    const after = { ...before, playerHealth: 19 };

    const next = applyHealthLossTalentRewards(before, after, 1, []);

    expect([next.playerStatuses.poison, next.playerStatuses.bleed].filter((value) => value === 0)).toHaveLength(1);
  });

  it("Sanguine and Virulent Leech use the standard Leech amount", () => {
    const bleedState = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      enemyHealth: 40,
      enemyMaxHealth: 40,
      rng: () => 0,
      talentEffects: computeTalentEffects({ bleed: ["bleed-leech-chance"] }),
    });
    const queued = applyDamageStatuses(bleedState, { kind: "damage", damageType: "bleed", amount: 4 }, 4, []);
    const bled = tickEnemyStatuses(queued, []);

    const poisonState = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      rng: () => 0,
      talentEffects: computeTalentEffects({ leech: ["leech-poison"] }),
    });
    const poisoned = applyPoisonTalentRiders(poisonState, 4, []);

    expect(bled.playerHealth).toBe(12);
    expect(poisoned.playerHealth).toBe(12);
  });

  it("Hemotoxin applies full-damage Bleed without recursive conversion", () => {
    const state = patchBattleState({
      enemyHealth: 40,
      enemyMaxHealth: 40,
      rng: () => 0,
      talentEffects: computeTalentEffects({ poison: ["poison-leech-chance"] }),
    });

    const next = applyPoisonTalentRiders(state, 4, [], true, (current, damage, texts) =>
      resolveFollowUpHit(current, { source: "talent-derived", damageType: "bleed", amount: damage }, texts),
    );

    expect(next.enemyHealth).toBe(36);
    expect(next.enemyStatuses.bleed).toBe(4);
  });

  it.each([
    ["burn", "mana-manaburn"],
    ["freeze", "mana-arcane-frost"],
  ] as const)("%s scaling uses current Mana", (damageType, talentId) => {
    const state = patchBattleState({
      mana: 2,
      maxMana: 10,
      talentEffects: computeTalentEffects({ mana: [talentId] }),
    });
    const effect = { kind: "damage" as const, damageType, amount: 10 };

    expect(computeCardDamageToEnemy(state, effect).modifiedDamage).toBe(11);
  });

  it("Arcane Mending restores one Health per Mana actually gained", () => {
    const state = patchBattleState({
      mana: 1,
      maxMana: 4,
      playerHealth: 10,
      talentEffects: computeTalentEffects({ mana: ["mana-arcane-mending"] }),
    });

    const gained = gainManaWithCombatText(state, 2, []);
    const capped = gainManaWithCombatText({ ...state, mana: 4 }, 1, []);

    expect(gained.mana).toBe(3);
    expect(gained.playerHealth).toBe(12);
    expect(capped.playerHealth).toBe(10);
  });

  it("Familiar Bond rolls once for each positive Companion damage packet", () => {
    const state = patchBattleState({
      activeCompanion: companionLibrary.phoenix,
      mana: 0,
      maxMana: 4,
      rng: () => 0.05,
      talentEffects: computeTalentEffects({ mana: ["mana-familiar-bond"] }),
    });

    expect(processCompanionTurnStart(state, []).mana).toBe(1);
  });
});

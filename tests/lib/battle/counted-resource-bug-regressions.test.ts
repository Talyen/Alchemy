import { describe, expect, it, vi } from "vitest";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { tickPlayerStatuses } from "@/lib/battle/status-ticks";
import { computeBaseDamage } from "@/lib/battle/player-damage-base";
import { computeTalentEffects, companionLibrary } from "@/lib/game-data";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { processCompanionTurnStart } from "@/lib/battle/companion";
import { makeTestCard, patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

describe("resource interaction regressions", () => {
  it("Shield Slam and Weighted Guard stack in either purchase order", () => {
    const first = computeTalentEffects({ block: ["block-to-physical"], physical: ["physical-shield-bash"] });
    const second = computeTalentEffects({ physical: ["physical-shield-bash"], block: ["block-to-physical"] });
    expect(first.blockToPhysicalDamageMultiplier).toBeCloseTo(0.6);
    expect(second.blockToPhysicalDamageMultiplier).toBeCloseTo(0.6);
  });

  it("a weakened zero Forge grant does not roll Intensify", () => {
    const rng = vi.fn(() => 0);
    const state = patchBattleState({ rng, talentEffects: { forgeBonusChance: 10 } });
    applyCardEffects(state, makeTestCard({ effects: [{ kind: "player-status", status: "forge", amount: 0 }] }), []);
    expect(rng).not.toHaveBeenCalled();
  });

  it("a weakened zero Armor grant does not roll Reinforced", () => {
    const rng = vi.fn(() => 0);
    const state = patchBattleState({ rng, talentEffects: { armorDoubleChance: 10 } });
    applyCardEffects(state, makeTestCard({ effects: [{ kind: "player-status", status: "armor", amount: 0 }] }), []);
    expect(rng).not.toHaveBeenCalled();
  });

  it.each<[string, BattleStatePatch]>([
    ["Brittle Ice", { enemyCC: { freezeSkipTurns: 1 }, talentEffects: { freezeDamageBonusVsFrozen: 1 } }],
    ["Corrosive", { enemyStatuses: { poison: 1 }, talentEffects: { poisonDamageBonusVsPoisoned: 1 } }],
  ])("%s cannot turn zero damage into a hit", (_name, patch) => {
    const state = patchBattleState(patch);
    expect(computeBaseDamage(state, { kind: "damage", damageType: "nature", amount: 0 })).toBe(0);
    expect(computeBaseDamage(state, { kind: "damage", damageType: "nature", amount: 1 })).toBe(2);
    const bleeding = patchBattleState({
      ...patch,
      enemyStatuses: { ...patch.enemyStatuses, bleed: 1 },
      talentEffects: { ...patch.talentEffects, bleedPoisonDamageTakenPercent: 50 },
    });
    expect(computeBaseDamage(bleeding, { kind: "damage", damageType: "poison", amount: 1 })).toBe(3);
  });

  it("Last Resort uses the hit's Health crossing even if Armor-break rewards heal first", () => {
    const state = patchBattleState({
      playerHealth: 16,
      playerMaxHealth: 30,
      playerStatuses: { armor: 1, burn: 1, poison: 1 },
      talentEffects: {
        armorBreakBlock: 3,
        armorOnBlockChance: 10,
        armorCleanseChance: 10,
        healOnStatusCleanse: 2,
        cleanseBelowHealthPercent: 25,
      },
      rng: () => 0,
    });
    const next = processEnemyDamageEffect(state, { kind: "damage", damageType: "physical", amount: 10 }, []);
    expect(next.playerHealth).toBeGreaterThan(7);
    expect(next.playerStatuses.burn).toBe(0);
    expect(next.playerStatuses.poison).toBe(0);
  });

  it("zero attack packets preserve preparations and do not roll Dodge or Crit", () => {
    const rng = vi.fn(() => 0.99);
    const state = patchBattleState({ rng, flags: { nextHitLeech: true, nextHitPoison: true } });
    const next = applyCardEffects(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 0 }] }),
      [],
    );
    expect(next.flags.nextHitLeech).toBe(true);
    expect(next.flags.nextHitPoison).toBe(true);
    expect(rng).not.toHaveBeenCalled();
    const armored = patchBattleState({
      rng: () => 0.99,
      enemyMitigation: { armor: 4 },
      gearEffects: { armorIncreasesStun: 1 },
    });
    const kingbreaker = applyCardEffects(
      armored,
      makeTestCard({ effects: [{ kind: "damage", damageType: "stun", amount: 0 }] }),
      [],
    );
    expect(kingbreaker.enemyHealth).toBe(armored.enemyHealth - 4);
  });

  it("Takedown does not roll a Stun proc against a defeated enemy", () => {
    const rng = vi.fn(() => 0.99);
    const state = patchBattleState({
      rng,
      enemyHealth: 1,
      activeCompanion: companionLibrary.skeleton,
      talentEffects: { companionStunChance: 10 },
    });
    const next = processCompanionTurnStart(state, []);
    expect(next.enemyHealth).toBe(0);
    expect(rng).toHaveBeenCalledTimes(2);
  });

  it("Heavy Blows does not roll a Stun proc after its Physical hit kills", () => {
    const rng = vi.fn(() => 0.99);
    const state = patchBattleState({ rng, enemyHealth: 1, talentEffects: { physicalStunChance: 10 } });
    const next = applyCardEffects(
      state,
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] }),
      [],
    );
    expect(next.enemyHealth).toBe(0);
    expect(rng).toHaveBeenCalledTimes(2);
  });

  it("Emberwake retaliation resolves between player status ticks", () => {
    const state = patchBattleState({
      playerHealth: 2,
      enemyHealth: 2,
      playerStatuses: { burn: 3, poison: 3 },
      gearEffects: { burnOnDeathsDoorEntry: 4 },
      rng: () => 0.99,
    });
    const next = tickPlayerStatuses(state, []);
    expect(next.enemyHealth).toBe(0);
    expect(next.playerStatuses.poison).toBe(3);
  });
});

import { detonateEnemyStatuses } from "@/lib/battle/dot-resolve";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { tickEnemyStatuses } from "@/lib/battle/status-ticks";
import { describe, expect, it } from "vitest";
import * as uniqueGearBattle from "../../fixtures/unique-gear-battle";

describe("Unique Gear unique damage bonuses", () => {
  const { battle, attack, play } = uniqueGearBattle;

  it("Unclosing Wound halves Bleed repeatedly and eventually expires", () => {
    let state = battle({ gearEffects: { bleedDecaysByHalf: 1 }, enemyStatuses: { bleed: 8 } });
    const remaining = [];
    for (let turn = 0; turn < 4; turn++) {
      state = tickEnemyStatuses(state, []);
      remaining.push(state.enemyStatuses.bleed);
    }
    expect(remaining).toEqual([4, 2, 1, 0]);
    expect(state.enemyHealth).toBe(985);
  });

  it("Blackfletch counts every remaining Unclosing Wound payment", () => {
    const state = battle({ gearEffects: { bleedDecaysByHalf: 1 }, enemyStatuses: { bleed: 8 } });
    const result = detonateEnemyStatuses(state, ["bleed"], [], "remaining-ticks");
    expect(result.enemyHealth).toBe(985);
    expect(result.enemyStatuses.bleed).toBe(0);
  });

  it("Kingbreaker turns Armor into Stun damage while retaining Block", () => {
    const state = battle({ gearEffects: { armorIncreasesStun: 1 }, enemyMitigation: { armor: 8, block: 4 } });
    const result = play(state, attack("stun"));
    expect(result.enemyHealth).toBe(986);
    expect(result.enemyStatuses.stun).toBe(14);
    expect(play(state, attack("physical")).enemyHealth).toBe(1000);
  });

  it("Lingering Bell retains a quarter of buildup without immediately Stunning again", () => {
    const result = resolveStunTrigger(battle({ gearEffects: { retainStunBuildup: 1 }, enemyStatuses: { stun: 600 } }));
    expect(result.enemyStatuses.stun).toBe(150);
    expect(result.enemyCC.stunSkipTurns).toBeGreaterThan(0);
    expect(resolveStunTrigger(result).enemyCC).toEqual(result.enemyCC);
  });

  it("Bloodember shares flat bonuses in both directions and conditional bonuses only once", () => {
    const state = battle({
      gearEffects: {
        sharedBurnBleedBonuses: 1,
        flatBurnDamage: 4,
        flatBleedDamage: 4,
        burnDamageBonusToBleedingPercent: 20,
      },
      enemyStatuses: { bleed: 1 },
    });
    expect(play(state, attack("burn")).enemyHealth).toBe(978);
    expect(play(state, attack("bleed")).enemyHealth).toBe(978);
    expect(play({ ...state, enemyStatuses: { ...state.enemyStatuses, bleed: 0 } }, attack("bleed")).enemyHealth).toBe(
      982,
    );
  });

  it("Bloodember applies the shared conditional bonus to later Bleed damage and Blackfletch's total", () => {
    const state = battle({
      gearEffects: { sharedBurnBleedBonuses: 1, burnDamageBonusToBleedingPercent: 20, bleedDecaysByHalf: 1 },
      enemyStatuses: { bleed: 8 },
    });
    expect(tickEnemyStatuses(state, []).enemyHealth).toBe(990);
    expect(detonateEnemyStatuses(state, ["bleed"], [], "remaining-ticks").enemyHealth).toBe(982);
  });

  it("Serpent's Eye bypasses Armor and Dodge only against Poisoned enemies", () => {
    const state = battle({
      gearEffects: { poisonedAttacksPierce: 1 },
      enemyStatuses: { poison: 1 },
      enemyMitigation: { armor: 100, block: 3 },
      rng: () => 0,
    });
    const result = play(state, attack("physical"));
    expect(result.enemyHealth).toBe(983);
    expect(result.enemyMitigation.armor).toBe(99);
    expect(
      play({ ...state, enemyStatuses: { ...state.enemyStatuses, poison: 0 } }, attack("physical")).enemyHealth,
    ).toBe(1000);
  });
});

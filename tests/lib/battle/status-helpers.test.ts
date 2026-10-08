import { describe, expect, it } from "vitest";
import {
  decayHalvedStatus,
  decayPoisonStacks,
  decayArmorAfterDamage,
  getEnemyDamageMultiplier,
} from "@/lib/battle/status-helpers";
import type { CombatTextEvent } from "@/lib/battle";
import { patchBattleState } from "../../fixtures/battle";

describe("status decay", () => {
  it("expires the final Block stack, rounds halves upward, and always decays at least one Poison stack", () => {
    expect(decayHalvedStatus(1)).toBe(0);
    expect(decayHalvedStatus(3)).toBe(2);
    expect(decayPoisonStacks(2)).toBe(1);
    expect(decayPoisonStacks(10)).toBe(8);
    expect(decayPoisonStacks(10, 0.5)).toBe(9);
    expect(decayPoisonStacks(1)).toBe(0);
  });
});

describe("enemy damage multipliers", () => {
  it("combines native vulnerabilities and one ward with live Stun, without leaking cached products", () => {
    const state = patchBattleState({
      currentEnemy: {
        traits: ["holy-vulnerability", "minor-holy-vulnerability", "sunward", "sunward"].map((id) => ({
          id,
          title: id,
          description: "",
        })),
      },
      talentEffects: { stunDoubleDamage: true },
    });
    const nativeAndWard = 2 * 1.3 * 0.5;
    expect(getEnemyDamageMultiplier(state, "holy")).toBe(nativeAndWard);
    expect(getEnemyDamageMultiplier(state, "physical")).toBe(1);
    const controlled = { ...state, enemyCC: { ...state.enemyCC, stunSkipTurns: 1, freezeSkipTurns: 1 } };
    expect(getEnemyDamageMultiplier(controlled, "holy")).toBe(nativeAndWard * 2);
    const replaced = { ...controlled, currentEnemy: { ...controlled.currentEnemy, traits: [] } };
    expect(getEnemyDamageMultiplier(replaced, "holy")).toBe(2);
    expect(getEnemyDamageMultiplier(state, "holy")).toBe(nativeAndWard);
  });
});

describe("Armor decay", () => {
  it("decays both sides only after positive damage, preserving the original battle", () => {
    const state = patchBattleState({ playerStatuses: { armor: 5 }, enemyMitigation: { armor: 5 } });
    const before = structuredClone({ player: state.playerStatuses, enemy: state.enemyMitigation });
    const player = decayArmorAfterDamage(state, 3, "player");
    const enemy = decayArmorAfterDamage(state, 3, "enemy");
    expect(player.playerStatuses.armor).toBe(4);
    expect(player.enemyMitigation).toBe(state.enemyMitigation);
    expect(enemy.enemyMitigation.armor).toBe(4);
    expect(enemy.playerStatuses).toBe(state.playerStatuses);
    expect(decayArmorAfterDamage(state, 0, "player")).toBe(state);
    expect(decayArmorAfterDamage(state, 0, "enemy")).toBe(state);
    expect({ player: state.playerStatuses, enemy: state.enemyMitigation }).toEqual(before);
  });

  it("grants modified Block and its feedback once on an Armor break, never on later hits", () => {
    const state = patchBattleState({
      playerStatuses: { armor: 1 },
      talentEffects: { armorBreakBlock: 4 },
      gearEffects: { flatBlockGained: 2 },
    });
    const texts: CombatTextEvent[] = [];
    const broken = decayArmorAfterDamage(state, 3, "player", texts);
    expect(broken.playerStatuses.armor).toBe(0);
    expect(broken.playerStatuses.block).toBe(6);
    expect(texts).toEqual([{ target: "player", kind: "status", stat: "block", amount: 6 }]);
    expect(decayArmorAfterDamage(broken, 3, "player", texts)).toBe(broken);
    expect(texts).toHaveLength(1);
    const intact = { ...state, playerStatuses: { ...state.playerStatuses, armor: 5 } };
    expect(decayArmorAfterDamage(intact, 3, "player").playerStatuses.block).toBe(0);
  });

  it("respects Ironclad and never grants break rewards to a defeated hero", () => {
    const state = patchBattleState({ playerStatuses: { armor: 1 }, talentEffects: { armorBreakBlock: 4 } });
    expect(decayArmorAfterDamage({ ...state, encounterBenefits: ["ironclad"] }, 3, "player").playerStatuses.armor).toBe(
      1,
    );
    const defeated = { ...state, playerHealth: 0 };
    const result = decayArmorAfterDamage(defeated, 3, "player");
    expect(result.playerStatuses.armor).toBe(0);
    expect(result.playerStatuses.block).toBe(0);
  });
});

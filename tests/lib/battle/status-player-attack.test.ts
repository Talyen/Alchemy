import { describe, expect, it } from "vitest";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { applyPlayerStatusFromAttack } from "@/lib/battle/status-player";
import type { CombatTextEvent } from "@/lib/battle/types";
import { patchBattleState } from "../../fixtures/battle";
import { defaultTrinketManifest } from "../../fixtures/default-battle-state";

describe("applyPlayerStatusFromAttack", () => {
  it.each([
    { status: "bleed", talentKey: "blockPreventsBleed" },
    { status: "poison", talentKey: "blockPreventsPoison" },
  ] as const)("blocks $status only while its prevention talent and Block are both active", ({ status, talentKey }) => {
    const state = patchBattleState({ playerStatuses: { block: 5 }, talentEffects: { [talentKey]: true } });
    const before = structuredClone({ statuses: state.playerStatuses, talents: state.talentEffects });
    const effect = { kind: "player-status", status, amount: 4 } as const;
    const texts: CombatTextEvent[] = [];
    expect(applyPlayerStatusFromAttack(state, effect, texts)).toBe(state);
    expect(texts).toEqual([]);
    const unblocked = { ...state, playerStatuses: { ...state.playerStatuses, block: 0 } };
    const withoutTalent = { ...state, talentEffects: { ...state.talentEffects, [talentKey]: false } };
    expect(applyPlayerStatusFromAttack(unblocked, effect, texts).playerStatuses[status]).toBe(4);
    expect(applyPlayerStatusFromAttack(withoutTalent, effect, texts).playerStatuses[status]).toBe(4);
    expect(applyPlayerStatusFromAttack(state, { ...effect, status: "burn" }, texts).playerStatuses.burn).toBe(4);
    expect({ statuses: state.playerStatuses, talents: state.talentEffects }).toEqual(before);
  });

  it("routes attack-granted Block through its bonuses once while other beneficial statuses retain their own stacks", () => {
    const state = patchBattleState({
      playerStatuses: { block: 3, armor: 2 },
      gearEffects: { flatBlockGained: 2 },
      trinketEffects: { ironwoodBucklerThornsOnBlock: 1 },
    });
    const texts: CombatTextEvent[] = [];
    const blocked = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "block", amount: 4 }, texts);
    expect(blocked.playerStatuses).toMatchObject({ block: 9, armor: 2, thorns: 1 });
    expect(texts).toEqual([
      { target: "player", kind: "status", stat: "block", amount: 6 },
      { target: "player", kind: "status", stat: "thorns", amount: 1 },
    ]);
    const armored = applyPlayerStatusFromAttack(blocked, { kind: "player-status", status: "armor", amount: 4 }, texts);
    expect(armored.playerStatuses).toMatchObject({ block: 9, armor: 6, thorns: 1 });
    expect(state.playerStatuses).toMatchObject({ block: 3, armor: 2, thorns: 0 });
  });

  it("the Mask allows incoming Poison before cleansing on the next turn", () => {
    const state = patchBattleState({
      trinketEffects: defaultTrinketManifest({ plagueDoctorPoisonCleanse: 2 }),
    });
    const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "poison", amount: 3 }, []);
    expect(result.playerStatuses.poison).toBe(3);
  });
});

describe("damage status riders during crowd-control immunity", () => {
  it.each([
    { stunSkipTurns: 1, freezeSkipTurns: 0, cooldown: 0 },
    { stunSkipTurns: 0, freezeSkipTurns: 1, cooldown: 0 },
    { stunSkipTurns: 0, freezeSkipTurns: 0, cooldown: 1 },
  ])("blocks buildup while preserving damage with %j", (playerCC) => {
    for (const damageType of ["stun", "freeze"] as const) {
      const state = patchBattleState({ playerCC });
      const result = processEnemyDamageEffect(state, { kind: "damage", damageType, amount: 2 }, []);
      expect(result.playerHealth).toBe(state.playerHealth - 2);
      expect(result.playerStatuses[damageType]).toBe(0);
      expect(result.playerCC).toEqual(playerCC);
      expect(state.playerStatuses[damageType]).toBe(0);
    }
  });
});

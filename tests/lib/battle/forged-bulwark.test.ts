import { describe, expect, it } from "vitest";
import { computeTalentEffects } from "@/lib/game-data";
import { addForgeToPlayer } from "@/lib/battle/status-player";
import { resolveEnemyAttackHit } from "@/lib/battle/enemy-attack-hit";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { patchBattleState } from "../../fixtures/battle";

describe("Forged Bulwark", () => {
  it("grants Block on each Forge gain, stacks with gear, and does not grant Forge when Block breaks", () => {
    const talentEffects = computeTalentEffects({ forge: ["forge-strength-6"] });
    const state = patchBattleState({ talentEffects, gearEffects: { blockOnForgeGain: 2 }, rng: () => 0.99 });
    const once = addForgeToPlayer(state, 4, []);
    expect(once.playerStatuses).toMatchObject({ forge: 4, block: 3 });
    const twice = addForgeToPlayer(once, 1, []);
    expect(twice.playerStatuses).toMatchObject({ forge: 5, block: 6 });
    const hit = resolveEnemyAttackHit(twice, { kind: "damage", damageType: "physical", amount: 6 }, [], {
      canDodge: false,
    }).state;
    expect(hit.playerStatuses).toMatchObject({ forge: 5, block: 0 });
  });

  it("does not grant Block for zero Forge and combines with Tempered Guard", () => {
    const talentEffects = computeTalentEffects({ forge: ["forge-strength-6", "forge-to-block"] });
    const state = patchBattleState({ playerStatuses: { forge: 3 }, talentEffects, rng: () => 0.99 });
    expect(addForgeToPlayer(state, 0, []).playerStatuses.block).toBe(0);
    expect(addForgeToPlayer(state, 1, []).playerStatuses).toMatchObject({ forge: 4, block: 2 });
  });

  it("restores the updated talent in an existing battle without reviving removed fields", () => {
    const state = patchBattleState({ rng: () => 0.99 });
    const { blockOnForgeGain: _newEffect, ...previousEffects } = state.talentEffects;
    const save = { ...state, talentEffects: { ...previousEffects, forgeOnBlockDepleted: 1 } };
    const snapshot = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(save)));
    expect(snapshot.talentEffects.blockOnForgeGain).toBe(1);
    expect(snapshot.talentEffects).not.toHaveProperty("forgeOnBlockDepleted");
    expect(addForgeToPlayer({ ...snapshot, rng: () => 0.99 }, 1, []).playerStatuses.block).toBe(1);
    const current = PersistedBattleStateSchema.parse({
      ...save,
      talentEffects: { ...save.talentEffects, blockOnForgeGain: 0 },
    });
    expect(current.talentEffects.blockOnForgeGain).toBe(0);
  });
});

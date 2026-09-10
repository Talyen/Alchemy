import { describe, expect, it } from "vitest";
import { patchBattleState } from "../../fixtures/battle";
import { addGoldWithCombatText } from "@/lib/battle/combat-text";
import { resolvePendingBattleReactions } from "@/lib/battle/enemy-attack-damage";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";

describe("queued Golden Crucible rewards", () => {
  it("resumes a pending Forge threshold reward once without granting Forge again", () => {
    const state = patchBattleState({
      playerStatuses: { forge: 3 },
      talentEffects: { forgeBurnThreshold: 4, forgeBurnDamage: 8 },
      gearEffects: { goldGrantsForgeAndHoly: 1 },
    });
    const queued = addGoldWithCombatText(state, 1, []);
    const saved = PersistedBattleStateSchema.parse(JSON.parse(JSON.stringify(queued)));
    const result = resolvePendingBattleReactions(saved, []);
    expect(result.playerStatuses.forge).toBe(4);
    expect(result.enemyHealth).toBe(state.enemyHealth - 8);
    expect(result.pendingForgeThresholds).toEqual([]);
    expect(resolvePendingBattleReactions(result, [])).toBe(result);
  });

  it("preserves older battles without a Forge reward queue", () => {
    const { pendingForgeThresholds: _queue, ...legacy } = patchBattleState({ playerHealth: 17, gold: 25 });
    const result = PersistedBattleStateSchema.parse(legacy);
    expect(result.pendingForgeThresholds).toEqual([]);
    expect(result.playerHealth).toBe(17);
    expect(result.gold).toBe(25);
    expect(resolvePendingBattleReactions(result, [])).toBe(result);
  });
});

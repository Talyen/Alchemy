import { describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { repairPersistedTrinketManifest } from "@/lib/validation/normalize-persisted-battle-state";

describe("repairPersistedTrinketManifest", () => {
  it("recomputes default trinketEffects from runBoons", () => {
    const battleState = defaultBattleState();
    const repaired = repairPersistedTrinketManifest(battleState, ["bone-charm"]);
    expect(repaired.trinketEffects.boneCharmHealOnKill).toBe(3);
  });

  it("leaves non-default manifests unchanged", () => {
    const battleState = {
      ...defaultBattleState(),
      trinketEffects: {
        ...defaultBattleState().trinketEffects,
        boneCharmHealOnKill: 9,
      },
    };
    const repaired = repairPersistedTrinketManifest(battleState, ["bone-charm"]);
    expect(repaired.trinketEffects.boneCharmHealOnKill).toBe(9);
  });

  it("no-ops when runBoons is empty", () => {
    const battleState = defaultBattleState();
    const repaired = repairPersistedTrinketManifest(battleState, []);
    expect(repaired).toBe(battleState);
  });
});

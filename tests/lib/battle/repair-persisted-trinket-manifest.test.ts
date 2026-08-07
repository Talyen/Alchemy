import { describe, expect, it } from "vitest";
import { defaultBattleState, repairPersistedBattleTrinketManifest } from "@/lib/battle";

describe("repairPersistedBattleTrinketManifest", () => {
  it("recomputes default trinketEffects from runTrinkets", () => {
    const battleState = defaultBattleState();
    const repaired = repairPersistedBattleTrinketManifest(battleState, ["bone-charm"]);
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
    const repaired = repairPersistedBattleTrinketManifest(battleState, ["bone-charm"]);
    expect(repaired.trinketEffects.boneCharmHealOnKill).toBe(9);
  });

  it("no-ops when runTrinkets is empty", () => {
    const battleState = defaultBattleState();
    const repaired = repairPersistedBattleTrinketManifest(battleState, []);
    expect(repaired).toBe(battleState);
  });
});

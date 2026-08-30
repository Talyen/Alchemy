import { describe, expect, it } from "vitest";
import { processEncounterTraitHealthThreshold } from "@/lib/battle/encounter-trait-health-threshold";
import { makeTestBattleState } from "../../fixtures/battle";

describe("encounter trait health threshold", () => {
  it("triggers Divine Aegis once when enemy health crosses half", () => {
    const base = makeTestBattleState();
    const state = makeTestBattleState({
      enemyHealth: 9,
      enemyMaxHealth: 20,
      currentEnemy: {
        ...base.currentEnemy,
        traits: [{ id: "divine-aegis", title: "Divine Aegis", description: "" }],
      },
    });
    const result = processEncounterTraitHealthThreshold(11, state, []);
    expect(result.flags.divineAegisTriggered).toBe(true);
    expect(result.enemyMitigation).toMatchObject({ armor: 2, block: 4 });
    expect(processEncounterTraitHealthThreshold(11, result, [])).toBe(result);
  });
});

import { describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { GEAR_EFFECT_KEYS } from "@/lib/gear";
import { normalizePersistedBattleState } from "@/lib/validation/normalize-persisted-battle-state";

describe("normalizePersistedBattleState", () => {
  it("fills missing gear and flag manifests from defaults", () => {
    const saved = {
      ...defaultBattleState(),
      turn: 4,
      gearEffects: { flatPhysicalDamage: 3 } as ReturnType<typeof defaultBattleState>["gearEffects"],
      flags: { divineAegisTriggered: true } as ReturnType<typeof defaultBattleState>["flags"],
    };

    const normalized = normalizePersistedBattleState(saved);

    expect(normalized.turn).toBe(4);
    expect(normalized.gearEffects.flatPhysicalDamage).toBe(3);
    expect(normalized.flags.divineAegisTriggered).toBe(true);
    for (const key of GEAR_EFFECT_KEYS) {
      if (key === "flatPhysicalDamage") continue;
      expect(normalized.gearEffects[key]).toBe(0);
    }
    expect(normalized.flags.firstPhysicalCardFreeUsed).toBe(false);
  });

  it("sanitizes persisted enemy traits", () => {
    const saved = {
      ...defaultBattleState(),
      currentEnemy: {
        ...defaultBattleState().currentEnemy,
        traits: [{ id: "tempered", kind: "combat" as const }],
      },
    };

    const normalized = normalizePersistedBattleState(saved);

    expect(normalized.currentEnemy.traits.map((trait) => trait.id)).toEqual(["tempered"]);
  });
});

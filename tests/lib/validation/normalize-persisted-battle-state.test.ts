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
        // Incomplete legacy traits — normalizer must accept and repair them.
        traits: [{ id: "tempered", kind: "combat" as const }] as unknown as ReturnType<
          typeof defaultBattleState
        >["currentEnemy"]["traits"],
      },
    };

    const normalized = normalizePersistedBattleState(saved);

    expect(normalized.currentEnemy.traits.map((trait) => trait.id)).toEqual(["tempered"]);
  });

  it("fills empty status and CC records with numeric defaults", () => {
    const normalized = normalizePersistedBattleState({
      playerStatuses: {} as ReturnType<typeof defaultBattleState>["playerStatuses"],
      enemyStatuses: {} as ReturnType<typeof defaultBattleState>["enemyStatuses"],
      playerCC: {} as ReturnType<typeof defaultBattleState>["playerCC"],
      enemyCC: {} as ReturnType<typeof defaultBattleState>["enemyCC"],
      enemyMitigation: {} as ReturnType<typeof defaultBattleState>["enemyMitigation"],
    });

    expect(normalized.playerStatuses.block).toBe(0);
    expect(normalized.playerStatuses.armor).toBe(0);
    expect(normalized.enemyStatuses.burn).toBe(0);
    expect(normalized.playerCC.stunSkipTurns).toBe(0);
    expect(normalized.enemyCC.cooldown).toBe(0);
    expect(normalized.enemyMitigation.armor).toBe(0);
  });

  it("keeps live stacks while filling omitted status keys", () => {
    const normalized = normalizePersistedBattleState({
      playerStatuses: { block: 4 } as ReturnType<typeof defaultBattleState>["playerStatuses"],
    });

    expect(normalized.playerStatuses.block).toBe(4);
    expect(normalized.playerStatuses.armor).toBe(0);
    expect(normalized.playerStatuses.stun).toBe(0);
  });
});

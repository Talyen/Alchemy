import { describe, expect, it } from "vitest";
import { migrateBattleState } from "@/lib/validation/migration/migrate-battle-state";
import { migrateWildwoodDraft } from "@/lib/validation/migration/migrate-wildwood-draft";
import { migrateActiveRun } from "@/lib/validation/migration/migrate-active-run";

describe("nested save migrators", () => {
  it("renames boonEffects and burn flags on battle snapshots", () => {
    const migrated = migrateBattleState({
      boonEffects: { firstBurnDoubled: true },
      flags: { firstBurnBoonDoubledUsed: true },
    }) as Record<string, unknown>;

    expect(migrated.trinketEffects).toEqual({ firstBurnDoubled: true });
    expect(migrated.boonEffects).toBeUndefined();
    expect((migrated.flags as Record<string, unknown>).firstBurnTrinketDoubledUsed).toBe(true);
    expect((migrated.flags as Record<string, unknown>).firstBurnBoonDoubledUsed).toBeUndefined();
  });

  it("remaps wildwood rewardType boon to trinket", () => {
    const migrated = migrateWildwoodDraft({ rewardType: "boon", phase: "reward" }) as Record<string, unknown>;
    expect(migrated.rewardType).toBe("trinket");
  });

  it("migrates nested active run fields together", () => {
    const migrated = migrateActiveRun({
      runBoons: ["bone-charm"],
      wildwoodDraft: { rewardType: "boon" },
      activeCombat: {
        battleState: {
          boonEffects: { boneCharmHealOnKill: 3 },
          flags: { firstBurnBoonDoubledUsed: true },
        },
      },
    }) as Record<string, unknown>;

    expect(migrated.runTrinkets).toEqual(["bone-charm"]);
    expect(migrated.runBoons).toBeUndefined();
    expect((migrated.wildwoodDraft as Record<string, unknown>).rewardType).toBe("trinket");
    const battleState = (migrated.activeCombat as Record<string, unknown>).battleState as Record<string, unknown>;
    expect(battleState.trinketEffects).toEqual({ boneCharmHealOnKill: 3 });
    expect((battleState.flags as Record<string, unknown>).firstBurnTrinketDoubledUsed).toBe(true);
  });
});

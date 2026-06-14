import { describe, expect, it } from "vitest";
import { migrateBattleState } from "@/lib/validation/migration/migrate-battle-state";
import { migrateWildwoodDraft } from "@/lib/validation/migration/migrate-wildwood-draft";
import { migrateActiveRun } from "@/lib/validation/migration/migrate-active-run";

describe("nested save migrators", () => {
  it("renames trinketEffects and burn flags on battle snapshots", () => {
    const migrated = migrateBattleState({
      trinketEffects: { firstBurnDoubled: true },
      flags: { firstBurnTrinketDoubledUsed: true },
    }) as Record<string, unknown>;

    expect(migrated.boonEffects).toEqual({ firstBurnDoubled: true });
    expect(migrated.trinketEffects).toBeUndefined();
    expect((migrated.flags as Record<string, unknown>).firstBurnBoonDoubledUsed).toBe(true);
    expect((migrated.flags as Record<string, unknown>).firstBurnTrinketDoubledUsed).toBeUndefined();
  });

  it("remaps wildwood rewardType trinket to boon", () => {
    const migrated = migrateWildwoodDraft({ rewardType: "trinket", phase: "reward" }) as Record<string, unknown>;
    expect(migrated.rewardType).toBe("boon");
  });

  it("migrates nested active run fields together", () => {
    const migrated = migrateActiveRun({
      runTrinkets: ["bone-charm"],
      wildwoodDraft: { rewardType: "trinket" },
      activeCombat: {
        battleState: {
          trinketEffects: { boneCharmHealOnKill: 3 },
          flags: { firstBurnTrinketDoubledUsed: true },
        },
      },
    }) as Record<string, unknown>;

    expect(migrated.runBoons).toEqual(["bone-charm"]);
    expect(migrated.runTrinkets).toBeUndefined();
    expect((migrated.wildwoodDraft as Record<string, unknown>).rewardType).toBe("boon");
    const battleState = (migrated.activeCombat as Record<string, unknown>).battleState as Record<string, unknown>;
    expect(battleState.boonEffects).toEqual({ boneCharmHealOnKill: 3 });
    expect((battleState.flags as Record<string, unknown>).firstBurnBoonDoubledUsed).toBe(true);
  });
});

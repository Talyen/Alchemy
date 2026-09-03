import { describe, expect, it } from "vitest";
import { normalizeSaveData } from "../helpers/parse-save-for-tests";
import { migrateSaveDataToCurrent } from "@/lib/validation/migration";
import { CURRENT_SAVE_SCHEMA_VERSION, LAUNCH_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { cardLibrary } from "@/lib/game-data/cards";
import { TOMBSTONED_CARD_IDS } from "@/lib/validation/migration/tombstoned-content-ids";
import {
  CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION,
  MIGRATION_SCENARIO_FIXTURES,
  currentSchemaCampaignSave,
  currentSchemaMidCombatTrinketSave,
} from "../fixtures/legacy-saves";

function rawActiveRun(fixture: Record<string, unknown>) {
  return fixture.activeRun as Record<string, unknown> | null | undefined;
}

describe("save migration guard", () => {
  it("provides a fixture for each supported source schema version", () => {
    for (
      let sourceVersion = LAUNCH_SAVE_SCHEMA_VERSION;
      sourceVersion < CURRENT_SAVE_SCHEMA_VERSION;
      sourceVersion += 1
    ) {
      expect(CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION[sourceVersion]).toBeTypeOf("function");
    }
  });

  it.each(Object.entries(CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION))(
    "stamps version %s fixtures idempotently",
    (_version, createFixture) => {
      const raw = createFixture();
      const once = normalizeSaveData(raw);
      const twice = normalizeSaveData(migrateSaveDataToCurrent(migrateSaveDataToCurrent(raw)));
      expect(twice).toEqual(once);
      expect(once.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
    },
  );

  it.each(Object.entries(MIGRATION_SCENARIO_FIXTURES))("stamps scenario %s idempotently", (_name, createFixture) => {
    const raw = createFixture();
    const once = normalizeSaveData(raw);
    const twice = normalizeSaveData(migrateSaveDataToCurrent(migrateSaveDataToCurrent(raw)));
    expect(twice).toEqual(once);
    expect(once.saveSchemaVersion).toBe(CURRENT_SAVE_SCHEMA_VERSION);
  });

  it("preserves wildwood draft reward state in interruptedFlow", () => {
    const migrated = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.wildwoodTrinketReward());
    expect(migrated.activeRun?.contentSystemType).toBe("wildwood");
    expect(migrated.activeRun?.wildwoodDraft).not.toHaveProperty("rewardType");
    expect(migrated.activeRun?.wildwoodDraft).not.toHaveProperty("version");
    expect(migrated.activeRun?.wildwoodDraft?.phase).toBe("reward");
    expect(migrated.activeRun?.interruptedFlow).toEqual(
      expect.objectContaining({
        kind: "primary-reward",
        pending: expect.objectContaining({
          rewardType: "trinket",
          choiceIds: ["bone-charm", "brass-censer"],
        }),
      }),
    );
  });

  it("lifts nested card, gear, and selected Wildwood rewards into interruptedFlow", () => {
    const card = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.wildwoodCardReward());
    expect(card.activeRun?.interruptedFlow).toEqual(
      expect.objectContaining({
        kind: "primary-reward",
        pending: expect.objectContaining({ rewardType: "card", choiceIds: ["slash", "block"] }),
      }),
    );

    const gear = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.wildwoodGearReward());
    expect(gear.activeRun?.interruptedFlow).toEqual(
      expect.objectContaining({
        kind: "primary-reward",
        pending: expect.objectContaining({
          rewardType: "gear",
          gearChoices: [{ instanceId: "gear-1", definitionId: "ruby-ring-basic", affixes: [] }],
        }),
      }),
    );

    const selected = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.wildwoodSelectedReward());
    expect(selected.activeRun?.interruptedFlow).toEqual(
      expect.objectContaining({
        kind: "primary-reward",
        pending: expect.objectContaining({ rewardType: "card", selectedId: "slash" }),
      }),
    );
  });

  it("keeps a companion handoff interruptedFlow and strips nested Wildwood reward fields", () => {
    const migrated = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.wildwoodCompanionHandoff());
    expect(migrated.activeRun?.interruptedFlow.kind).toBe("companion-reward");
    if (migrated.activeRun?.interruptedFlow.kind === "companion-reward") {
      expect(migrated.activeRun.interruptedFlow.pending.companionChoiceIds).toEqual(["wolf-companion"]);
    }
    expect(migrated.activeRun?.wildwoodDraft).not.toHaveProperty("rewardType");
  });

  it("lifts parked Wildwood nested rewards and keeps parked non-reward drafts", () => {
    const parkedReward = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.parkedWildwoodNestedReward());
    expect(parkedReward.parkedRuns?.wildwood?.interruptedFlow).toEqual(
      expect.objectContaining({
        kind: "primary-reward",
        pending: expect.objectContaining({ rewardType: "card", choiceIds: ["slash", "bash"] }),
      }),
    );
    expect(parkedReward.parkedRuns?.wildwood?.wildwoodDraft).not.toHaveProperty("rewardType");

    const parkedDraft = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.parkedWildwoodDraft());
    expect(parkedDraft.parkedRuns?.wildwood?.interruptedFlow).toEqual({ kind: "none" });
    expect(parkedDraft.parkedRuns?.wildwood?.wildwoodDraft?.phase).toBe("draft");
    expect(parkedDraft.parkedRuns?.wildwood?.wildwoodDraft).not.toHaveProperty("version");
  });

  it("does not lift leftover nested Wildwood rewards outside the reward phase", () => {
    const migrated = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.wildwoodLeftoverNestedReward());
    expect(migrated.activeRun?.interruptedFlow).toEqual({ kind: "none" });
    expect(migrated.activeRun?.wildwoodDraft?.phase).toBe("battle");
    expect(migrated.activeRun?.wildwoodDraft).not.toHaveProperty("rewardType");
    expect(migrated.activeRun?.wildwoodDraft?.currentBossId).toBe("forge-golem");
  });

  it("strips retired cards from every pile while keeping run state playable", () => {
    const migrated = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.tombstonedPiles());
    const run = migrated.activeRun;
    expect(run).not.toBeNull();
    expect(run?.runDeck.map((card) => card.id)).toEqual(["slash"]);
    expect(run?.corruptionResult).toBeNull();

    expect(run?.shopState?.cards.map((card) => card.id)).toEqual(["slash"]);
    expect(run?.shopState?.refreshesLeft).toBe(1);
    expect(run?.shopState?.purchasedSlotKeys).toEqual(["slash-0"]);
    expect(run?.alchemistState?.potions.map((card) => card.id)).toEqual(["slash"]);
    expect(run?.alchemistState?.mixUsed).toBe(true);
    expect(run?.alchemistState?.purchasedSlotKeys).toEqual(["slash-0"]);
    expect(run?.mysteryVisit).toBeNull();

    const battle = run?.activeCombat?.battleState;
    expect(battle?.deck.map((card) => card.id)).toEqual(["slash"]);
    expect(battle?.discard).toEqual([]);
    expect(battle?.wishQueue).toEqual([[{ ...battle?.deck[0] }]]);
    expect(battle?.mana).toBe(2);

    expect(run?.runMetaMaxHealth).toBe(run?.runMaxHealth);
  });

  it("migrates legacy gear slots to accessories", () => {
    const migrated = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.legacyGearSlots());
    expect(migrated.gearLoadouts.knight?.["left-accessory"]).toBe("gear-2");
    expect(migrated.gearLoadouts.knight?.["right-accessory"]).toBe("gear-3");
  });

  it("regenerates a hex Labyrinth map from a legacy 8×9 grid without dropping the run", () => {
    const migrated = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.labyrinthGridRegen());
    expect(migrated.activeRun?.contentSystemType).toBe("labyrinth");
    expect(migrated.activeRun?.runPlayerHealth).toBe(24);
    expect(migrated.activeRun?.labyrinthMap?.floors.length).toBeGreaterThanOrEqual(2);
    expect(migrated.activeRun?.labyrinthMap?.currentFloor).toBe(1);
    expect(migrated.activeRun?.labyrinthPendingNode).toBeNull();
  });

  it("preserves gold, talent XP, and mid-combat trinket effects", () => {
    const campaign = normalizeSaveData(currentSchemaCampaignSave());
    expect(campaign.gold).toBe(42);
    expect(campaign.activeRun).not.toHaveProperty("runGold");
    expect(campaign.talentXP.physical).toBe(18);

    const midCombat = normalizeSaveData(currentSchemaMidCombatTrinketSave());
    expect(midCombat.activeRun?.activeCombat?.battleState.trinketEffects.boneCharmHealOnKill).toBe(3);
    expect(midCombat.activeRun?.activeCombat?.battleState.flags.firstBurnTrinketDoubledUsed).toBe(true);
    expect(midCombat.activeRun?.runBoons).toEqual(["meteorite", "bone-charm"]);
  });

  it("does not drop wildwood active runs during migration", () => {
    for (const createFixture of [
      ...Object.values(CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION),
      ...Object.values(MIGRATION_SCENARIO_FIXTURES),
    ]) {
      const raw = createFixture();
      const activeRun = rawActiveRun(raw);
      if (activeRun?.contentSystemType !== "wildwood") continue;
      const migrated = normalizeSaveData(raw);
      expect(migrated.activeRun?.wildwoodDraft).not.toBeNull();
    }
  });

  it("references only catalog or tombstoned card IDs in migrated fixtures", () => {
    const cardIds = new Set(cardLibrary.map((c) => c.id));

    const fixtures = [
      ...Object.values(CURRENT_SCHEMA_SAVE_FIXTURES_BY_SOURCE_VERSION),
      ...Object.values(MIGRATION_SCENARIO_FIXTURES),
    ];
    const offenders: string[] = [];
    for (const createFixture of fixtures) {
      const migrated = normalizeSaveData(createFixture());

      for (const id of migrated.discoveredCardIds ?? []) {
        if (!cardIds.has(id) && !TOMBSTONED_CARD_IDS.has(id)) offenders.push(`discoveredCardIds: ${id}`);
      }
    }
    expect(offenders, "Add tombstoned entries for unknown IDs, or fix the migration chain.").toEqual([]);
  });
});

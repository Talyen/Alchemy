import type { LabyrinthMap } from "@/lib/content-systems/types";
import { gridLabyrinthMapFixture } from "../fixtures/labyrinth-map";
import { describe, expect, it } from "vitest";
import { advanceToPlayerTurn } from "@/lib/battle/player-turn-transition";
import { applyBrassCenser } from "@/lib/battle/player-typed-hit";
import { normalizeSaveData } from "../helpers/parse-save-for-tests";
import { migrateSaveDataToCurrent } from "@/lib/validation/migration";
import { CURRENT_SAVE_SCHEMA_VERSION, LAUNCH_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { cardLibrary } from "@/lib/game-data/cards";
import { enemyById } from "@/lib/game-data";
import { processEnemyAbility } from "@/lib/battle/enemy-turn-attack";
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
  it("adds four side rooms without changing existing active or parked Labyrinth progress", () => {
    const raw = MIGRATION_SCENARIO_FIXTURES.expandedLabyrinth();
    const before = JSON.stringify(raw);
    const original = rawActiveRun(raw)!.labyrinthMap as LabyrinthMap;
    const save = normalizeSaveData(raw);
    const run = save.activeRun!;
    const map = run.labyrinthMap!;
    expect(map.floors[0]!.nodeIds).toHaveLength(20);
    for (const [id, node] of Object.entries(original.nodes)) expect(map.nodes[id]).toEqual(node);
    expect(map.currentNodeId).toBe(original.currentNodeId);
    expect(run.labyrinthPendingNode).toBe("labyrinth-floor-1-n0");
    expect(run.rng.counters.world).toBe(7);
    expect(run.activeCombat?.battleState.playerHealth).toBe(20);
    expect(run.activeCombat?.battleState.flags.firstBurnTrinketDoubledUsed).toBe(true);
    expect(save.parkedRuns.labyrinth?.labyrinthMap).toEqual(map);
    expect(normalizeSaveData(save)).toEqual(save);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it("retires only development hex Labyrinth runs while retaining profile progression and other modes", () => {
    const raw = MIGRATION_SCENARIO_FIXTURES.retiredHexLabyrinth();
    const campaignSave = currentSchemaCampaignSave();
    const campaign = rawActiveRun(campaignSave);
    const parked = { ...(raw.parkedRuns as Record<string, unknown>), campaign };
    const save = normalizeSaveData({
      ...raw,
      parkedRuns: parked,
      talentXP: { physical: 18 },
      materialInventory: { wood: 5 },
    });
    expect(save.activeRun).toBeNull();
    expect(save.parkedRuns.labyrinth).toBeUndefined();
    expect(save.parkedRuns.campaign?.contentSystemType).toBe("campaign");
    expect(save.parkedRuns.campaign?.runPlayerHealth).toBe(campaign?.runPlayerHealth);
    expect(save.discoveredCardIds).toEqual(expect.arrayContaining(["slash", "bash"]));
    expect(save.talentXP.physical).toBe(18);
    expect(save.materialInventory.wood).toBe(5);
    expect(save.gold).toBe(raw.gold);
    expect(normalizeSaveData(save)).toEqual(save);
    const activeCampaign = normalizeSaveData({ ...raw, activeRun: campaign });
    expect(activeCampaign.activeRun?.contentSystemType).toBe("campaign");
    expect(activeCampaign.parkedRuns.labyrinth).toBeUndefined();
  });

  it("keeps a battle loadable when a legacy enemy ID is an inherited object name", () => {
    const raw = MIGRATION_SCENARIO_FIXTURES.enemyAbilities();
    const run = raw.activeRun as {
      activeCombat: { battleState: { currentEnemy: { id: string }; playerHealth: number } };
    };
    run.activeCombat.battleState.currentEnemy.id = "constructor";
    const save = normalizeSaveData(raw);
    expect(save.activeRun?.activeCombat?.battleState.playerHealth).toBe(run.activeCombat.battleState.playerHealth);
    expect(save.activeRun?.activeCombat?.battleState.currentEnemy.abilityIds).toEqual(enemyById.skeleton.abilityIds);
    expect(save.encounteredEnemyIds).toContain("vampire");
  });
  it("upgrades enemy abilities while preserving resolved results, modifiers, and progress", () => {
    const raw = MIGRATION_SCENARIO_FIXTURES.enemyAbilities();
    const before = JSON.stringify(raw);
    const save = normalizeSaveData(raw);
    const battle = save.activeRun!.activeCombat!.battleState;
    const pending = save.activeRun!.activeCombat!.pendingBattleTransition;
    expect(battle.currentEnemy.abilityIds).toEqual(enemyById.vampire.abilityIds);
    expect(battle.currentEnemy.traits[0].title).toBe("Blood Scent");
    expect(battle.lastEnemyAbilityId).toBeNull();
    expect(battle).not.toHaveProperty("enemyAttackEffects");
    expect(battle.currentEnemy).not.toHaveProperty("attackEffects");
    expect(battle.flags).not.toHaveProperty("enemyNextAttackCrit");
    expect(battle.flags).not.toHaveProperty("enemyNextAttackBonus");
    expect(battle.flags).not.toHaveProperty("enemyNextAttackHolyBonus");
    expect(battle.flags.enemyFirstHitDoubleUsed).toBe(true);
    expect(battle.enemyMitigation).toEqual({ block: 4, armor: 2, forge: 3 });
    expect(battle.difficultyModifiers).toEqual([{ kind: "increase-enemy-damage", amount: 2 }]);
    expect(save.activeRun!.rng.counters.world).toBe(17);
    expect(save.encounteredEnemyIds).toContain("vampire");
    expect(pending?.kind).toBe("enemy-turn");
    if (pending?.kind !== "enemy-turn") throw new Error("Missing saved enemy result");
    expect(pending.resultState).toMatchObject({
      playerHealth: 14,
      enemyHealth: 17,
      gold: 33,
      playerDodgeCount: 2,
      turnPhase: "player",
    });
    const next = processEnemyAbility({ ...pending.resultState, appliesFightPacing: false, rng: () => 0.99 }, []);
    expect(next.lastEnemyAbilityId).toBe("bloodthorn");
    expect(next.gold).toBe(33);
    expect(next.playerDodgeCount).toBe(2);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it("migrates active and parked ability history for every run mode", () => {
    const raw = MIGRATION_SCENARIO_FIXTURES.enemyAbilities();
    for (const mode of ["campaign", "labyrinth", "wildwood"] as const) {
      const run = {
        ...(raw.activeRun as Record<string, unknown>),
        contentSystemType: mode,
        ...(mode === "labyrinth" ? { labyrinthMap: gridLabyrinthMapFixture() } : {}),
      };
      const migrated = migrateSaveDataToCurrent({ ...raw, activeRun: run, parkedRuns: { [mode]: run } });
      const active = migrated.activeRun as typeof run & {
        activeCombat: { battleState: { currentEnemy: { abilityIds: string[] }; lastEnemyAbilityId: null } };
      };
      const parked = migrated.parkedRuns as Record<string, typeof active>;
      expect(active.activeCombat.battleState.currentEnemy.abilityIds).toEqual(enemyById.vampire.abilityIds);
      expect(parked[mode].activeCombat.battleState).toEqual(active.activeCombat.battleState);
      expect(migrateSaveDataToCurrent(migrated)).toEqual(migrated);
    }
  });
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
    expect(migrated.activeRun?.labyrinthMap?.floors).toHaveLength(1);
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

  it("upgrades spent Mask and Censer effects in a resumed fight", () => {
    const migrated = normalizeSaveData(MIGRATION_SCENARIO_FIXTURES.recurringTrinkets());
    const battle = migrated.activeRun?.activeCombat?.battleState;
    expect(battle).toBeDefined();
    expect(migrated.ownedTrinketIds).toContain("plague-doctors-mask");
    expect(migrated.equippedTrinkets.knight).toBe("plague-doctors-mask");
    expect(migrated.activeRun?.runBoons).toEqual(["brass-censer"]);
    expect(migrated.discoveredTrinketIds).toEqual(expect.arrayContaining(["brass-censer", "plague-doctors-mask"]));
    expect(battle?.trinketEffects).toMatchObject({
      brassCenserProcChance: 20,
      plagueDoctorPoisonCleanse: 2,
      boneCharmHealOnKill: 3,
    });
    expect(battle?.trinketEffects).not.toHaveProperty("firstHolyDamageDoubled");
    expect(battle?.trinketEffects).not.toHaveProperty("plagueDoctorImmunity");
    expect(battle?.flags).not.toHaveProperty("firstHolyDamageBonusUsed");
    expect(battle?.flags).not.toHaveProperty("firstHarmfulStatusPrevented");
    expect(battle?.flags.firstBurnTrinketDoubledUsed).toBe(true);
    const turned = advanceToPlayerTurn({ ...battle!, appliesFightPacing: false, rng: () => 0.99 });
    expect(turned.playerStatuses.poison).toBe(2);
    expect(turned.enemyHealth).toBe(battle!.enemyHealth - 1);
    const burned = applyBrassCenser({ ...turned, rng: () => 0.1 }, 6, []);
    expect(burned.enemyStatuses.burn).toBe(6);
    expect(burned.enemyHealth).toBe(turned.enemyHealth - 6);
  });

  it("upgrades parked combat effects without mutating the original payload", () => {
    const raw = MIGRATION_SCENARIO_FIXTURES.recurringTrinkets();
    const parked = { ...raw, activeRun: null, parkedRuns: { campaign: raw.activeRun } };
    const result = migrateSaveDataToCurrent(parked);
    const runs = result.parkedRuns as Record<
      string,
      { activeCombat: { battleState: { trinketEffects: Record<string, unknown> } } }
    >;
    expect(runs.campaign.activeCombat.battleState.trinketEffects).toMatchObject({
      brassCenserProcChance: 20,
      plagueDoctorPoisonCleanse: 2,
    });
    expect(JSON.stringify(parked)).toContain("firstHolyDamageDoubled");
    expect(migrateSaveDataToCurrent(result)).toEqual(result);
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

  it("references only catalog or tombstoned card IDs in discovered lists", () => {
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

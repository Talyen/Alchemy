import { mutateGameplayForTest, resetAllTestStores } from "../../../../../helpers/run-domain-store-test";
import { beforeEach, describe, expect, it } from "vitest";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/session/gameplay-command";
import {
  readActiveRun,
  readRunProfile,
  readRunRevision,
  readRunSession,
  readBattle,
} from "@/features/alchemy/shared/stores/session/run-reads";
import {
  addMaterialsToStockpile,
  awardMaterialsDuringRun,
  bondCompanion,
  constructBuilding,
  setDiscoveredCardIds,
  setHasActiveRun,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { SaveDataSchema } from "@/lib/validation/save-schemas/save-data";
import { finalizeRunEndSession } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { emptyInventory } from "@/lib/homestead/inventory";
import { defaultGameSession } from "@/app/application-session";
import { createGameSession } from "@/features/alchemy/shared/stores/session/game-session";
import { applyMysteryEffect } from "@/features/alchemy/run-loop/navigation/mystery-flow";
import { makeActiveRunData } from "../session/active-run-data-fixture";
import { defaultBattleState } from "@/lib/battle";
import { cardById } from "@/lib/game-data";
import { buildAlchemySaveDataFromStores } from "@/features/alchemy/shared/storage/persistence";

beforeEach(() => {
  resetAllTestStores();
});

describe("homestead write commands", () => {
  it("records and reports only materials that fit in the stockpile", () => {
    const result = mutateGameplayForTest((draft) => {
      setHasActiveRun(draft, true);
      draft.runProfile.materialInventory.wood = Number.MAX_SAFE_INTEGER - 1;
      return applyMysteryEffect({ kind: "gainMaterial", material: "wood", amount: 3 }, { draft, rng: () => 0.5 });
    });
    expect(result.materialAward).toEqual({ material: "wood", amount: 1 });
    expect(readRunProfile(defaultGameSession).materialInventory.wood).toBe(Number.MAX_SAFE_INTEGER);
    expect(readActiveRun(defaultGameSession).runMaterialsEarned.wood).toBe(1);
  });
  it("awardMaterialsDuringRun writes the stockpile and the run tally; stockpile grants skip the tally", () => {
    mutateGameplayForTest((draft) => {
      setHasActiveRun(draft, true);
      awardMaterialsDuringRun(draft, { ...emptyInventory(), wood: 2 });
      addMaterialsToStockpile(draft, { ...emptyInventory(), wood: 1, iron: 3 });
    });

    expect(readRunProfile(defaultGameSession).materialInventory.wood).toBe(3);
    expect(readRunProfile(defaultGameSession).materialInventory.iron).toBe(3);
    expect(readActiveRun(defaultGameSession).runMaterialsEarned.wood).toBe(2);
    expect(readActiveRun(defaultGameSession).runMaterialsEarned.iron).toBe(0);
  });

  it("failed construction writes nothing and leaves live health untouched", () => {
    const healthBefore = mutateGameplayForTest((draft) => {
      setHasActiveRun(draft, true);
      const built = constructBuilding(draft, "blacksmiths-forge");
      expect(built).toBe(false);
      return draft.run.activeRun.runMaxHealth;
    });

    expect(readRunProfile(defaultGameSession).materialInventory).toEqual(emptyInventory());
    expect(readActiveRun(defaultGameSession).runMaxHealth).toBe(healthBefore);
  });

  it("rejects bonding an undiscovered companion without changing progression or food", () => {
    mutateGameplayForTest((draft) => {
      addMaterialsToStockpile(draft, { ...emptyInventory(), food: 50 });
      setDiscoveredCardIds(draft, ["bear-companion"]);
    });
    const revision = readRunRevision(defaultGameSession);

    expect(mutateGameplayForTest((draft) => bondCompanion(draft, "wolf"))).toBe(false);
    expect(readRunRevision(defaultGameSession)).toBe(revision);
    expect(readRunProfile(defaultGameSession).materialInventory.food).toBe(50);
    expect(readRunProfile(defaultGameSession).bondedCompanions.wolf).toBe(0);
    expect(readRunProfile(defaultGameSession).effects.companionBondLevels.wolf).toBe(0);
  });

  it("bonds a discovered companion through the command", () => {
    mutateGameplayForTest((draft) => {
      addMaterialsToStockpile(draft, { ...emptyInventory(), food: 50 });
      setDiscoveredCardIds(draft, ["wolf-companion"]);
    });

    expect(mutateGameplayForTest((draft) => bondCompanion(draft, "wolf"))).toBe(true);
    expect(readRunProfile(defaultGameSession).materialInventory.food).toBe(40);
    expect(readRunProfile(defaultGameSession).bondedCompanions.wolf).toBe(1);
    expect(readRunProfile(defaultGameSession).effects.companionBondLevels.wolf).toBe(1);
  });
});

describe("four-tier Homestead persistence and settlement", () => {
  it("rebuilds Sparring critical damage on upgrade and resume without losing live battle progress", async () => {
    const { constructBuilding } = await import("@/features/alchemy/shared/stores/commands/meta-commands");
    const card = cardById.slash!;
    const oldBattle = defaultBattleState();
    const legacyTalentEffects: Record<string, unknown> = { ...oldBattle.talentEffects, startBlock: 6 };
    delete legacyTalentEffects.homesteadPhysicalCritDamagePercent;
    const initialSave = SaveDataSchema.parse({
      constructedBuildings: { "sparring-grounds": 3 },
      materialInventory: { ...emptyInventory(), wood: 16, stone: 16 },
      activeRun: {
        ...makeActiveRunData({ runDeck: [card], runPlayerHealth: 7 }),
        activity: {
          kind: "battle",
          data: {
            battleState: {
              ...oldBattle,
              turn: 4,
              playerHealth: 7,
              enemyHealth: 17,
              mana: 2,
              hand: [{ ...card, uid: 1 }],
              talentEffects: legacyTalentEffects,
              playerStatuses: { ...oldBattle.playerStatuses, block: 6 },
            },
          },
        },
      },
    });
    await using session = createGameSession({ initialSave });
    const rng = structuredClone(readActiveRun(session).rng);
    expect(readBattle(session).battleState).toMatchObject({
      turn: 4,
      playerHealth: 7,
      enemyHealth: 17,
      mana: 2,
      playerStatuses: { block: 6 },
      talentEffects: { homesteadPhysicalCritDamagePercent: 30 },
    });
    expect(readBattle(session).battleState!.talentEffects).not.toHaveProperty("startBlock");
    expect(constructBuilding("sparring-grounds", session)).toBe(true);
    expect(readRunProfile(session).materialInventory).toEqual(emptyInventory());
    expect(readBattle(session).battleState!.talentEffects.homesteadPhysicalCritDamagePercent).toBe(40);
    const before = readBattle(session).battleState;
    const saved = SaveDataSchema.parse(JSON.parse(JSON.stringify(buildAlchemySaveDataFromStores(session))));
    await using restored = createGameSession({ initialSave: saved });
    expect(readBattle(restored).battleState).toEqual(before);
    expect(readActiveRun(restored).rng).toEqual(rng);
    expect(readRunProfile(restored).constructedBuildings["sparring-grounds"]).toBe(4);
  });

  it("preserves levels three and four without extending Companion Bonds", () => {
    const source = {
      constructedBuildings: { "blacksmiths-forge": 3, "runesmiths-workshop": 4 },
      plantedFarms: { "crystal-garden": 4 },
      completedResearch: { "leyline-energy": 4 },
      bondedCompanions: { wolf: 3 },
    };
    const loaded = SaveDataSchema.parse(JSON.parse(JSON.stringify(source)));
    expect(loaded.constructedBuildings["blacksmiths-forge"]).toBe(3);
    expect(loaded.constructedBuildings["runesmiths-workshop"]).toBe(4);
    expect(loaded.plantedFarms["crystal-garden"]).toBe(4);
    expect(loaded.completedResearch["leyline-energy"]).toBe(4);
  });

  it.each([CONTENT_SYSTEMS.CAMPAIGN, CONTENT_SYSTEMS.LABYRINTH, CONTENT_SYSTEMS.WILDWOOD])(
    "records collected resources in %s without paying a second Homestead bonus",
    (contentSystemType) => {
      mutateGameplayForTest((draft) => {
        setHasActiveRun(draft, true);
        draft.run.activeRun.contentSystemType = contentSystemType;
        draft.run.activeRun.roomsEncountered = 30;
        draft.runProfile.effects = {
          ...defaultHomesteadEffects,
          stoneFindBonus: 0.4,
          gemFindBonus: 0.8,
          goldFindBonus: 0.8,
        };
        awardMaterialsDuringRun(draft, { ...emptyInventory(), stone: 14, gems: 18 });
      });
      const before = readRunProfile(defaultGameSession);
      expect(finalizeRunEndSession(defaultGameSession)).toBe(true);
      expect(readRunSession(defaultGameSession).runEndMaterials).toEqual({ ...emptyInventory(), stone: 14, gems: 18 });
      expect(readRunProfile(defaultGameSession).materialInventory).toEqual(before.materialInventory);
      expect(readRunProfile(defaultGameSession).gold).toBe(before.gold);
      expect(readActiveRun(defaultGameSession).runMaterialsEarned).toEqual(emptyInventory());
      expect(finalizeRunEndSession(defaultGameSession)).toBe(false);
      expect(readRunProfile(defaultGameSession).materialInventory).toEqual(before.materialInventory);
    },
  );
});

describe("meta intent commands", () => {
  it("purchases upgrades in the supplied career without changing the default career", async () => {
    const commands = await import("@/features/alchemy/shared/stores/commands/meta-commands");
    await using session = createGameSession();

    dispatchGameplayCommand(
      (draft) => {
        addMaterialsToStockpile(draft, { ...emptyInventory(), stone: 4, iron: 11, food: 21, gems: 10 });
        setDiscoveredCardIds(draft, ["wolf-companion"]);
        return acceptCommand();
      },
      undefined,
      session,
    );
    const defaultRevision = readRunRevision(defaultGameSession);
    expect(commands.constructBuilding("blacksmiths-forge", session)).toBe(true);
    expect(commands.plantFarm("wheat-field", session)).toBe(true);
    expect(commands.completeResearch("leyline-energy", session)).toBe(true);
    expect(commands.bondCompanion("wolf", session)).toBe(true);
    expect(readRunProfile(session)).toMatchObject({
      constructedBuildings: { "blacksmiths-forge": 1 },
      plantedFarms: { "wheat-field": 1 },
      completedResearch: { "leyline-energy": 1 },
      bondedCompanions: { wolf: 1 },
      materialInventory: emptyInventory(),
    });
    const revision = readRunRevision(session);
    expect(commands.constructBuilding("blacksmiths-forge", session)).toBe(false);
    expect(readRunRevision(session)).toBe(revision);
    expect(readRunRevision(defaultGameSession)).toBe(defaultRevision);
  });

  it("constructBuilding returns false and does not mutate when resources are insufficient", async () => {
    const { constructBuilding } = await import("@/features/alchemy/shared/stores/commands/meta-commands");
    const result = constructBuilding("blacksmiths-forge", defaultGameSession);
    expect(result).toBe(false);
    expect(readRunProfile(defaultGameSession).constructedBuildings["blacksmiths-forge"] ?? 0).toBe(0);
  });
});

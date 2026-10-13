import {
  mutateGameplayForTest,
  getBattleForTest,
  mutateGearForTest,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodePersistenceFields,
  buildAlchemySaveDataFromStores,
  hydrateAlchemyPersistenceFields,
  subscribeAlchemyPersistence,
} from "@/features/alchemy/shared/storage/persistence";
import { defaultSaveData } from "@/features/alchemy/shared/storage";
import { SaveDataSchema } from "@/lib/validation";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";

import {
  handleCollectionTabChange,
  setDiscoveredCardIds,
  setGold,
  setHasActiveRun,
  setMaterials as setRunProfileMaterials,
  setScreen,
  setSelectedLabyrinthNodeId,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { addGearCurrencies } from "@/features/alchemy/shared/stores/gear-actions";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { createEmptyGearInventories, generateUniqueGearInstance, getUniqueItemDefinition } from "@/lib/gear";
import { defaultGameSession } from "@/app/application-session";
import { createSessionPersistence } from "@/features/alchemy/shared/storage/session-persistence";
import { emptyHydratedMysteryVisit } from "@/lib/active-run-session";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  acceptCommand,
  dispatchGameplayCommand,
  type GameplayDraft,
} from "@/features/alchemy/shared/stores/gameplay-command";

function mutateSession(session: GameSession, mutate: (draft: GameplayDraft) => void) {
  dispatchGameplayCommand(
    (draft) => {
      mutate(draft);
      return acceptCommand();
    },
    undefined,
    session,
  );
}

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  useUiStore.getState().setShowClearSaveConfirm(false);
  resetRunDomainStore();
});

describe("persistence coordinator", () => {
  it.each(["idle", "mystery"] as const)(
    "can commit an incomplete %s activity but cannot save it as resumable progress",
    async (kind) => {
      const session = createGameSession();
      const listener = vi.fn();
      const unsubscribe = subscribeAlchemyPersistence(listener, session);
      const persistence = createSessionPersistence(session);
      const release = persistence.trackProgress(() => {});
      try {
        expect(() =>
          mutateSession(session, (draft) => {
            draft.session.activity = kind === "idle" ? { kind } : { kind, data: emptyHydratedMysteryVisit() };
          }),
        ).not.toThrow();
        expect(listener).toHaveBeenCalledOnce();
        expect(persistence.readProgress().kind).toBe("saving");
        expect(() => persistence.snapshot()).toThrow(kind === "idle" ? "resumable activity" : "resolved visit");
        expect(persistence.readProgress().kind).toBe("failed");
      } finally {
        unsubscribe();
        release();
        await session.dispose();
      }
    },
  );
  it.each(["inactive", "destination", "battle"] as const)(
    "%s changes excluded from the save cannot arm the progress gate or trigger autosave",
    async (activity) => {
      const session = createGameSession();
      if (activity !== "inactive") {
        mutateSession(session, (draft) => {
          if (activity === "battle") getBattleForTest(draft);
          else draft.session.activity = { kind: "destination" };
        });
      }
      const persistence = createSessionPersistence(session);
      const before = buildAlchemySaveDataFromStores(session);
      const listener = vi.fn();
      const unsubscribe = subscribeAlchemyPersistence(listener, session);
      const release = persistence.trackProgress(() => {});
      try {
        mutateSession(session, (draft) => {
          if (activity === "inactive") draft.run.activeRun.runPlayerHealth -= 1;
          else if (activity === "destination") draft.session.rewardFlow.state.gold += 1;
          else
            getBattleForTest(draft).battleState.battleMetrics = {
              enemyAttackActions: 1,
              enemyAbilityActivations: {},
            };
        });
        expect(buildAlchemySaveDataFromStores(session)).toEqual(before);
        expect(listener).not.toHaveBeenCalled();
        expect(persistence.readProgress().kind).toBe("idle");
        mutateSession(session, (draft) => {
          if (activity === "inactive") setGold(draft, 42);
          else if (activity === "destination") draft.session.rewardFlow.state.destinations = ["Campfire"];
          else getBattleForTest(draft).battleState.turn += 1;
        });
        expect(buildAlchemySaveDataFromStores(session)).not.toEqual(before);
        expect(listener).toHaveBeenCalledOnce();
        expect(persistence.readProgress().kind).toBe("saving");
      } finally {
        unsubscribe();
        release();
        await session.dispose();
      }
    },
  );
  it("keeps hydrated profile fields from overwriting later inventory, discovery and settings changes", () => {
    hydrateAlchemyPersistenceFields(defaultSaveData, defaultGameSession);
    useSettingsStore.getState().setMusicVolume(12);
    mutateGearForTest((gear) => {
      gear.addTrinket("tattered-pages");
      gear.addInstance({ instanceId: "new-reward", definitionId: "longsword-basic", affixes: [] }, "knight");
    });
    mutateGameplayForTest((draft) => setDiscoveredCardIds(draft, ["slash", "bash"]));
    const encoded = encodePersistenceFields(defaultGameSession);
    expect(encoded.ownedTrinketIds).toContain("tattered-pages");
    expect(encoded.gearInventories.knight.some((gear) => gear.instanceId === "new-reward")).toBe(true);
    expect(encoded.discoveredCardIds).toEqual(["slash", "bash"]);
    expect(encoded.musicVolume).toBe(12);
    expect(readRunProfile(defaultGameSession)).not.toHaveProperty("ownedTrinketIds");
    expect(readRunProfile(defaultGameSession)).not.toHaveProperty("musicVolume");
  });

  it("round-trips domain-owned save fields without transient UI state", () => {
    const snapshots: Array<ReturnType<typeof encodePersistenceFields>> = [];
    const unsubscribe = subscribeAlchemyPersistence(
      () => snapshots.push(encodePersistenceFields(defaultGameSession)),
      defaultGameSession,
    );
    hydrateAlchemyPersistenceFields(
      {
        ...defaultSaveData,
        musicVolume: 37,
        discoveredCardIds: ["slash"],
        talentXP: { burn: 25 },
        materialInventory: { wood: 4, iron: 3, herbs: 2, food: 1, gems: 0, stone: 0, hide: 0 },
      },
      defaultGameSession,
    );
    unsubscribe();
    expect(snapshots).toEqual([encodePersistenceFields(defaultGameSession)]);

    useUiStore.getState().setShowClearSaveConfirm(true);
    mutateGameplayForTest((draft) => handleCollectionTabChange(draft, "bestiary"));

    const encoded = encodePersistenceFields(defaultGameSession);

    expect(encoded.musicVolume).toBe(37);
    expect(encoded.discoveredCardIds).toEqual(["slash"]);
    expect(encoded.talentXP).toEqual({ burn: 25 });
    expect(encoded.materialInventory).toEqual({ wood: 4, iron: 3, herbs: 2, food: 1, gems: 0, stone: 0, hide: 0 });
    expect(encoded).not.toHaveProperty("showClearSaveConfirm");
    expect(encoded).not.toHaveProperty("collectionTab");
  });

  it("hydrates derived homestead effects from persisted source fields", () => {
    hydrateAlchemyPersistenceFields(
      {
        ...defaultSaveData,
        constructedBuildings: {
          ...defaultSaveData.constructedBuildings,
          "blacksmiths-forge": 1,
        },
      },
      defaultGameSession,
    );

    expect(readRunProfile(defaultGameSession).effects.flatPhysicalDamage).toBeGreaterThan(0);
  });

  it("subscribes to every persistence owner through one cleanup", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAlchemyPersistence(listener, defaultGameSession);

    useSettingsStore.getState().setMusicVolume(42);
    mutateGameplayForTest((draft) => setDiscoveredCardIds(draft, ["slash"]));
    mutateGearForTest((gear) => gear.addCurrencies({ voidstone: 1 }));
    mutateGameplayForTest((draft) =>
      setRunProfileMaterials(draft, { wood: 1, iron: 0, herbs: 0, food: 0, gems: 0, stone: 0, hide: 0 }),
    );

    expect(listener).toHaveBeenCalledTimes(4);

    unsubscribe();
    useSettingsStore.getState().setMusicVolume(43);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it("stays silent for transient-only commits that cannot change a snapshot", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAlchemyPersistence(listener, defaultGameSession);

    useUiStore.getState().setShowClearSaveConfirm(true);
    mutateGameplayForTest((draft) => handleCollectionTabChange(draft, "bestiary"));
    mutateGameplayForTest((draft) => setScreen(draft, "collection"));
    mutateGameplayForTest((draft) => setSelectedLabyrinthNodeId(draft, "node-1"));

    expect(listener).not.toHaveBeenCalled();

    mutateGameplayForTest((draft) => setDiscoveredCardIds(draft, ["slash"]));
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("ignores claim locks and derived effects while saving reward payload changes", () => {
    mutateGameplayForTest((draft) => getBattleForTest(draft));
    mutateGameplayForTest((draft) => {
      draft.session.activity = { kind: "rewards" };
    });
    const listener = vi.fn();
    const unsubscribe = subscribeAlchemyPersistence(listener, defaultGameSession);

    setRunSession({ rewardClaimInFlight: true });
    mutateGameplayForTest((draft) => {
      draft.runProfile.effects = { ...draft.runProfile.effects };
    });
    expect(listener).not.toHaveBeenCalled();

    setRunSession({ rewardState: { ...readRunSession(defaultGameSession).rewardFlow.state, gold: 1 } });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("only saves mode-specific session fields while that mode is active", () => {
    setRunSession({ activity: { kind: "destination" } });
    const listener = vi.fn();
    const unsubscribe = subscribeAlchemyPersistence(listener, defaultGameSession);

    setRunSession({ activeLabyrinthModifiers: [] });
    expect(listener).not.toHaveBeenCalled();

    setRunProgress({ contentSystemType: "labyrinth" });
    expect(listener).toHaveBeenCalledOnce();
    listener.mockClear();
    setRunSession({ activeLabyrinthModifiers: ["tempered"] });
    expect(listener).toHaveBeenCalledOnce();

    setRunProgress({ contentSystemType: "wildwood" });
    listener.mockClear();
    setRunSession({ starterDraftChoices: [] });
    expect(listener).not.toHaveBeenCalled();
    setRunSession({
      wildwoodDraft: {
        phase: "draft",
        draftChoices: [],
        remainingBossIds: [],
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
      },
    });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("coalesces every gameplay persistence owner into one session signal", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAlchemyPersistence(listener, defaultGameSession);

    mutateGameplayForTest((draft) => {
      setGold(draft, 42);
      setHasActiveRun(draft, true);
      setDiscoveredCardIds(draft, ["slash"]);
      addGearCurrencies(draft.gear, { voidstone: 1 });
      setRunProfileMaterials(draft, { wood: 1, iron: 0, herbs: 0, food: 0, gems: 0, stone: 0, hide: 0 });
    });

    expect(listener).toHaveBeenCalledOnce();
    expect(readRunProfile(defaultGameSession).gold).toBe(42);
    unsubscribe();
  });

  it("unions currently owned uniques into collection discovery on hydrate", () => {
    const uniqueDef = getUniqueItemDefinition("wardbreaker");
    if (!uniqueDef) throw new Error("missing wardbreaker unique");
    const unique = generateUniqueGearInstance(uniqueDef);
    const inventories = createEmptyGearInventories();
    inventories.knight = [unique];

    hydrateAlchemyPersistenceFields(
      {
        ...defaultSaveData,
        discoveredUniqueIds: [],
        gearInventories: inventories,
      },
      defaultGameSession,
    );

    expect(readProfileStore(defaultGameSession).discoveredUniqueIds).toEqual(["wardbreaker"]);
  });

  it("hydrates schema-repaired data without throwing or keeping damage", () => {
    const repaired = SaveDataSchema.parse({
      activeRun: { characterId: "bard" },
      gearInventories: { knight: "junk" },
      ownedTrinketIds: "junk",
      gold: -5,
    });

    expect(() => hydrateAlchemyPersistenceFields(repaired, defaultGameSession)).not.toThrow();

    const encoded = encodePersistenceFields(defaultGameSession);
    expect(encoded.gearInventories.knight).toEqual([]);
    expect(encoded.ownedTrinketIds).toEqual([]);
    expect(encoded.gold).toBe(0);
  });
});

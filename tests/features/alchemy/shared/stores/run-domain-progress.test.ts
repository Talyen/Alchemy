import "../../../../helpers/mock-audio";

import "../../../../helpers/mock-flush-save";
import { initializeBattleForTest as initializeActiveBattle } from "../../../../helpers/run-domain-store-test";
import { beforeEach, describe, expect, it } from "vitest";
import { restoreRun, snapshotRun, finalizeRunEndSession } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  applyRunStartSnapshot as mutateRunStartSnapshot,
  awardCardXP as mutateAwardCardXP,
  awardMysteryXP as mutateAwardMysteryXP,
  clearPermanentData as mutateClearPermanentData,
  finalizeRunXP as mutateFinalizeRunXP,
  unlockAllTalents as mutateUnlockAllTalents,
  unlockTalent as mutateUnlockTalent,
  resetUnlockedTalents as mutateResetUnlockedTalents,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  initializeActiveRun as mutateInitializeActiveRun,
  resetProgress as mutateResetProgress,
  resetRunXP as mutateResetRunXP,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { applyTalentState as mutateApplyTalentState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { mutateGearForTest } from "../../../../helpers/run-domain-store-test";
import { createEmptyGearInventories, createEmptyGearLoadouts, type GearInstance } from "@/lib/gear";
import {
  acceptCommand,
  createGameplayCommand,
  dispatchGameplayCommand,
} from "@/features/alchemy/shared/stores/gameplay-command";

import { patchBattleState } from "../../../../fixtures/battle";
import { rebindLiveRunMeta } from "@/features/alchemy/shared/stores/run-session-write-port";
import { cardById, computeTalentPoints, type BattleCard } from "@/lib/game-data";
import { purchaseTalent } from "@/features/alchemy/shared/stores/navigation-commands";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import {
  readActiveRun,
  readBattle,
  readActiveRunScreen,
  readRunInitialized,
  readRunProfile,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";

import { awardRunEndMaterials } from "@/features/alchemy/shared/stores/run-session-write-port";
import { createCompleteActiveRunData, makeActiveRunData } from "./active-run-data-fixture";
import { createEmptyRewardState, serializePendingReward } from "@/lib/active-run-session";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import {
  ACTIVE_RUN_PROGRESS_KEYS,
  EMPTY_ACTIVE_RUN_COLLECTION_KEYS,
  RUN_SNAPSHOT_FIELD_KEYS,
} from "@/features/alchemy/shared/stores/run-state-init";
import { defaultGameSession } from "@/app/application-session";
import { savedActivityFixture } from "../../../../fixtures/run-activity";

const syncGearRunHealth = createGameplayCommand(
  (...args: Parameters<typeof rebindLiveRunMeta>) => acceptCommand(rebindLiveRunMeta(...args)),
  undefined,
  defaultGameSession,
);
const applyRunStartSnapshot = createGameplayCommand(
  (...args: Parameters<typeof mutateRunStartSnapshot>) => acceptCommand(mutateRunStartSnapshot(...args)),
  undefined,
  defaultGameSession,
);
const finalizeRunXP = createGameplayCommand(
  (...args: Parameters<typeof mutateFinalizeRunXP>) => acceptCommand(mutateFinalizeRunXP(...args)),
  undefined,
  defaultGameSession,
);
const unlockAllTalents = createGameplayCommand(
  (...args: Parameters<typeof mutateUnlockAllTalents>) => acceptCommand(mutateUnlockAllTalents(...args)),
  undefined,
  defaultGameSession,
);
const initializeActiveRun = createGameplayCommand(
  (...args: Parameters<typeof mutateInitializeActiveRun>) => acceptCommand(mutateInitializeActiveRun(...args)),
  undefined,
  defaultGameSession,
);
const applyTalentState = createGameplayCommand(
  (...args: Parameters<typeof mutateApplyTalentState>) => acceptCommand(mutateApplyTalentState(...args)),
  undefined,
  defaultGameSession,
);
const awardCardXP = createGameplayCommand(
  (...args: Parameters<typeof mutateAwardCardXP>) => acceptCommand(mutateAwardCardXP(...args)),
  undefined,
  defaultGameSession,
);
const awardMysteryXP = createGameplayCommand(
  (...args: Parameters<typeof mutateAwardMysteryXP>) => acceptCommand(mutateAwardMysteryXP(...args)),
  undefined,
  defaultGameSession,
);
const unlockTalent = createGameplayCommand(
  (...args: Parameters<typeof mutateUnlockTalent>) => acceptCommand(mutateUnlockTalent(...args)),
  undefined,
  defaultGameSession,
);
const resetUnlockedTalents = createGameplayCommand(
  (...args: Parameters<typeof mutateResetUnlockedTalents>) => acceptCommand(mutateResetUnlockedTalents(...args)),
  undefined,
  defaultGameSession,
);
const resetRunXP = createGameplayCommand(
  (...args: Parameters<typeof mutateResetRunXP>) => acceptCommand(mutateResetRunXP(...args)),
  undefined,
  defaultGameSession,
);
const resetProgress = createGameplayCommand(
  (...args: Parameters<typeof mutateResetProgress>) => acceptCommand(mutateResetProgress(...args)),
  undefined,
  defaultGameSession,
);
const clearPermanentData = createGameplayCommand(
  (...args: Parameters<typeof mutateClearPermanentData>) => acceptCommand(mutateClearPermanentData(...args)),
  undefined,
  defaultGameSession,
);

beforeEach(() => {
  resetRunDomainStore();
});

describe("run-domain progress: initial state", () => {
  it("starts a healthy knight with a deck and no earned progress", () => {
    const run = readActiveRun(defaultGameSession);
    const profile = readRunProfile(defaultGameSession);
    expect(run.characterId).toBe("knight");
    expect(run.runDeck.length).toBeGreaterThan(0);
    expect(run.runPlayerHealth).toBeGreaterThan(0);
    expect(run.runMaxHealth).toBeGreaterThanOrEqual(run.runPlayerHealth);
    expect(run.currentAct).toBe(1);
    expect(profile.gold).toBe(0);
    expect(profile.talentXP).toEqual({});
    expect(run.runTalentXP).toEqual({});
    expect(profile.unlockedTalents).toEqual({});
  });
});

describe("initialize", () => {
  it("keeps the progress key contracts in sync", () => {
    // The collection defaults and snapshot fields are subsets of the persisted
    // progress keys (compile-guarded via satisfies); this pins the same
    // contract at runtime for the key registries themselves.
    const progressKeys = new Set<string>(ACTIVE_RUN_PROGRESS_KEYS);
    for (const key of [...EMPTY_ACTIVE_RUN_COLLECTION_KEYS, ...RUN_SNAPSHOT_FIELD_KEYS]) {
      expect(progressKeys.has(key)).toBe(true);
    }
  });

  it("restores active run data", () => {
    const activeRun = makeActiveRunData({
      characterId: "rogue",
      runDeck: [
        {
          id: "stab",
          title: "Stab",
          descriptionLines: [""],
          art: "",
          cost: 1,
          effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
          uid: 1,
        },
      ],
      runPlayerHealth: 25,
      runMaxHealth: 30,
      roomsEncountered: 3,
      destinationIndexInAct: 2,
      completedDestinations: ["combat"],
      rng: readActiveRun(defaultGameSession).rng,
    });
    initializeActiveRun(activeRun);
    applyTalentState({ physical: 100 }, { physical: ["talent-1"] });
    expect(readActiveRun(defaultGameSession).characterId).toBe("rogue");
    expect(readRunProfile(defaultGameSession).gold).toBe(0);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(25);
    expect(readRunProfile(defaultGameSession).talentXP.physical).toBe(100);
    expect(readRunProfile(defaultGameSession).unlockedTalents.physical).toEqual(["talent-1"]);
  });

  it("restores valid completed destination labels", () => {
    const activeRun = makeActiveRunData({
      characterId: "rogue",
      runPlayerHealth: 25,
      runMaxHealth: 30,
      roomsEncountered: 3,
      destinationIndexInAct: 2,
      completedDestinations: ["Normal Combat", "Corruption"],
    });

    initializeActiveRun(activeRun);

    expect(readActiveRun(defaultGameSession).completedDestinations).toEqual(["Normal Combat", "Corruption"]);
  });

  it("uses fallback character when no active run", () => {
    initializeActiveRun(null, "wizard");
    expect(readActiveRun(defaultGameSession).characterId).toBe("wizard");
  });

  it("uses knight as default fallback", () => {
    initializeActiveRun(null);
    expect(readActiveRun(defaultGameSession).characterId).toBe("knight");
  });

  it("restores navigation screen via restoreRun", () => {
    const activeRun = makeActiveRunData({ activity: savedActivityFixture("shop") });
    restoreRun(activeRun, {}, {}, defaultGameSession);
    expect(readActiveRunScreen(defaultGameSession)).toBe("shop");
  });

  it("round-trips every active-run persistence region through the aggregate", () => {
    const activeRun = createCompleteActiveRunData();
    activeRun.activity = {
      kind: "rewards",
      data: serializePendingReward({
        ...createEmptyRewardState(["Mystery", "Card Shop"]),
        gold: 7,
        lastVictoryEnemyType: "elite",
        lastVictoryContentSystem: "labyrinth",
      })!,
    };

    restoreRun(activeRun, { armor: 21 }, { armor: ["armor-1"] }, defaultGameSession);
    const snapshot = snapshotRun(defaultGameSession);

    expect(Object.keys(snapshot).sort()).toEqual(Object.keys(activeRun).sort());
    expect(snapshot).toMatchObject({
      characterId: activeRun.characterId,
      runDeck: activeRun.runDeck,
      runPlayerHealth: activeRun.runPlayerHealth,
      roomsEncountered: activeRun.roomsEncountered,
      currentAct: activeRun.currentAct,
      destinationIndexInAct: activeRun.destinationIndexInAct,
      completedDestinations: activeRun.completedDestinations,
      lastOfferedDestinations: activeRun.lastOfferedDestinations,
      destinationRoundsSinceOffered: activeRun.destinationRoundsSinceOffered,
      runBoons: activeRun.runBoons,
      encounteredRunEnemyIds: activeRun.encounteredRunEnemyIds,
      selectedDifficulty: activeRun.selectedDifficulty,
      contentSystemType: activeRun.contentSystemType,
      labyrinthMap: activeRun.labyrinthMap,
      labyrinthPendingNode: activeRun.labyrinthPendingNode,
      runTalentXP: activeRun.runTalentXP,
      runMaterialsEarned: activeRun.runMaterialsEarned,
      runObtainedItems: activeRun.runObtainedItems,
      activity: activeRun.activity,
    });
    expect(snapshot.rng).toEqual(activeRun.rng);
    if (snapshot.activity.kind !== "rewards") {
      throw new Error("Expected unclaimed Gold to survive as a primary-reward interruption");
    }
    expect(snapshot.activity.data.gold).toBe(7);
    expect(snapshot.activity.data.destinations).toEqual(["Mystery", "Card Shop"]);
    expect(snapshot.activeLabyrinthModifiers).toEqual(activeRun.activeLabyrinthModifiers);
    expect(snapshot.activeLabyrinthRewardModifiers).toEqual(activeRun.activeLabyrinthRewardModifiers);
  });
});

describe("gear max health sync", () => {
  const maxHealthArmor: GearInstance = {
    instanceId: "max-health-armor",
    definitionId: "leather-armor-basic",
    affixes: [{ id: "max-health", value: 7 }],
  };

  it("rebinds max health from currently equipped gear", () => {
    const inventories = createEmptyGearInventories();
    inventories.knight = [maxHealthArmor];
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.body = maxHealthArmor.instanceId;
    mutateGearForTest((gear) => gear.initialize(inventories, loadouts));
    setRunProgress({
      characterId: "knight",
      runMaxHealth: 30,
      runPlayerHealth: 30,
      runMetaMaxHealth: 30,
    });
    setRunSession({ hasActiveRun: true });

    syncGearRunHealth();

    expect(readActiveRun(defaultGameSession).runMaxHealth).toBe(37);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(30);
  });

  it("rebinds max health when equipped gear is removed", () => {
    mutateGearForTest((gear) => gear.initialize(createEmptyGearInventories(), createEmptyGearLoadouts()));
    setRunProgress({
      characterId: "knight",
      runMaxHealth: 37,
      runPlayerHealth: 35,
      runMetaMaxHealth: 37,
    });
    setRunSession({ hasActiveRun: true });

    syncGearRunHealth();

    expect(readActiveRun(defaultGameSession).runMaxHealth).toBe(30);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(30);
  });
});

describe("awardCardXP", () => {
  it("awards and accumulates all resource-card keywords in run XP without changing permanent XP", () => {
    awardCardXP(cardById["burning-blade"]!);
    awardCardXP(cardById["mana-shield"]!);
    awardCardXP(cardById["crystal-bulwark"]!);
    expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({ burn: 1, forge: 1, block: 2, mana: 2 });
    expect(readRunProfile(defaultGameSession).talentXP).toEqual({});
  });
});

describe("awardMysteryXP", () => {
  it("awards XP directly to a keyword runTalentXP", () => {
    awardMysteryXP("burn", 50);
    expect(readActiveRun(defaultGameSession).runTalentXP.burn).toBe(50);
    expect(readRunProfile(defaultGameSession).talentXP.burn).toBeUndefined();
  });

  it("accumulates with existing runTalentXP", () => {
    awardMysteryXP("burn", 30);
    awardMysteryXP("burn", 20);
    expect(readActiveRun(defaultGameSession).runTalentXP.burn).toBe(50);
  });

  it("awards XP to all visible keywords", () => {
    awardMysteryXP("consume", 50);
    expect(readActiveRun(defaultGameSession).runTalentXP.consume).toBe(50);
  });
});

describe("unlockTalent", () => {
  it("appends the next eligible talent when points are available", () => {
    setRunProgress({ talentXP: { burn: 20 } });
    unlockTalent("burn", "burn-dmg-1");
    expect(readRunProfile(defaultGameSession).unlockedTalents.burn).toEqual(["burn-dmg-1"]);
  });

  it("preserves existing unlocks for sequential choices", () => {
    setRunProgress({ talentXP: { burn: 60 } });
    unlockTalent("burn", "burn-dmg-1");
    unlockTalent("burn", "burn-dmg-2");
    expect(readRunProfile(defaultGameSession).unlockedTalents.burn).toEqual(["burn-dmg-1", "burn-dmg-2"]);
  });

  it("ignores duplicate unlock of the same talentId", () => {
    setRunProgress({ talentXP: { burn: 20 } });
    unlockTalent("burn", "burn-dmg-1");
    unlockTalent("burn", "burn-dmg-1");
    expect(readRunProfile(defaultGameSession).unlockedTalents.burn).toEqual(["burn-dmg-1"]);
  });

  it("rejects unlock without unspent points", () => {
    setRunSession({ hasActiveRun: true });
    const before = readGameplayState(defaultGameSession);
    purchaseTalent("burn", "burn-dmg-1", defaultGameSession);
    expect(readGameplayState(defaultGameSession)).toBe(before);
  });

  it("rejects out-of-order unlocks", () => {
    setRunProgress({ talentXP: { burn: 20 } });
    unlockTalent("burn", "burn-dmg-5");
    expect(readRunProfile(defaultGameSession).unlockedTalents.burn).toBeUndefined();
  });

  it("rejects unknown talent ids", () => {
    setRunProgress({ talentXP: { nature: 100 } });
    unlockTalent("nature", "nature-not-a-real-talent");
    expect(readRunProfile(defaultGameSession).unlockedTalents.nature).toBeUndefined();
  });
});

describe("unlockAllTalents", () => {
  it("unlocks every talent from the pool", () => {
    unlockAllTalents();
    const unlocked = readRunProfile(defaultGameSession).unlockedTalents;
    const allKeywordIds = Object.keys(unlocked);
    expect(allKeywordIds.length).toBeGreaterThan(0);
    for (const talents of Object.values(unlocked)) {
      expect(Array.isArray(talents)).toBe(true);
      expect(talents.length).toBeGreaterThan(0);
    }
  });
});

describe("resetUnlockedTalents", () => {
  it("refunds allocations and removes live combat bonuses while preserving XP and Homestead effects", () => {
    setRunProgress({ talentXP: { health: 100 }, unlockedTalents: { health: ["health-heal-boost"] } });
    setRunSession({ hasActiveRun: true });
    dispatchGameplayCommand(
      (draft) => {
        draft.runProfile.effects.homesteadHealing = 2;
        initializeActiveBattle(draft, patchBattleState({ playerHealth: 15 }));
        rebindLiveRunMeta(draft);

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    expect(readBattle(defaultGameSession).battleState.talentEffects.healMultiplier).toBe(1.1);
    const before = readBattle(defaultGameSession).battleState;
    resetUnlockedTalents();
    expect(readRunProfile(defaultGameSession).unlockedTalents).toEqual({});
    expect(readRunProfile(defaultGameSession).talentXP).toEqual({ health: 100 });
    expect(readBattle(defaultGameSession).battleState.talentEffects).toMatchObject({
      healMultiplier: 1,
      homesteadHealing: 2,
    });
    expect(readBattle(defaultGameSession).battleState.playerHealth).toBe(before.playerHealth);
    expect(readBattle(defaultGameSession).battleState.hand).toEqual(before.hand);
  });
});

describe("resetRunXP", () => {
  it("clears runTalentXP but preserves talentXP after finalize", () => {
    awardMysteryXP("burn", 50);
    finalizeRunXP();
    resetRunXP();
    expect(readRunProfile(defaultGameSession).talentXP.burn).toBe(50);
    expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
  });
});

describe("clearPermanentData", () => {
  it("clears talentXP, runTalentXP, and unlockedTalents", () => {
    awardMysteryXP("burn", 50);
    finalizeRunXP();
    unlockTalent("burn", "burn-dmg-1");
    clearPermanentData();
    expect(readRunProfile(defaultGameSession).talentXP).toEqual({});
    expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
    expect(readRunProfile(defaultGameSession).unlockedTalents).toEqual({});
  });
});

describe("reset", () => {
  it("preserves talentXP and unlockedTalents while clearing run state", () => {
    awardMysteryXP("burn", 50);
    finalizeRunXP();
    unlockTalent("burn", "burn-dmg-1");
    setRunProgress({ gold: 100, runPlayerHealth: 15 });
    resetProgress();
    expect(readRunProfile(defaultGameSession).talentXP.burn).toBe(50);
    expect(readRunProfile(defaultGameSession).unlockedTalents.burn).toEqual(["burn-dmg-1"]);
    expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
    expect(readRunProfile(defaultGameSession).gold).toBe(100);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBeGreaterThan(0);
    expect(readRunInitialized(defaultGameSession)).toBe(false);
  });
});

describe("talent XP accumulation through run end", () => {
  it("awards card XP to runTalentXP then merges into permanent talentXP and points", () => {
    const card: BattleCard = {
      id: "slash",
      title: "Slash",
      descriptionLines: [""],
      art: "",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    };
    setRunProgress({ selectedDifficulty: "difficulty-1" });

    for (let i = 0; i < 20; i++) {
      awardCardXP(card);
    }
    expect(readActiveRun(defaultGameSession).runTalentXP.physical).toBe(20);
    expect(computeTalentPoints(readRunProfile(defaultGameSession).talentXP.physical ?? 0)).toBe(0);

    finalizeRunXP();

    expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
    expect(readRunProfile(defaultGameSession).talentXP.physical).toBe(20);
    expect(computeTalentPoints(readRunProfile(defaultGameSession).talentXP.physical ?? 0)).toBe(1);
    expect(readRunSession(defaultGameSession).runEndTalentXP.physical).toBe(20);
  });
});

describe("finalizeRunXP", () => {
  it("applies no multiplier for difficulty-1", () => {
    setRunProgress({ selectedDifficulty: "difficulty-1" });
    awardMysteryXP("burn", 10);
    finalizeRunXP();
    expect(readRunProfile(defaultGameSession).talentXP.burn).toBe(10);
    expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
    expect(readRunSession(defaultGameSession).runEndTalentXP.burn).toBe(10);
  });

  it("applies 1.3x multiplier for difficulty-2", () => {
    setRunProgress({ selectedDifficulty: "difficulty-2" });
    awardMysteryXP("burn", 10);
    finalizeRunXP();
    expect(readRunProfile(defaultGameSession).talentXP.burn).toBe(13);
    expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
    expect(readRunSession(defaultGameSession).runEndTalentXP.burn).toBe(13);
  });

  it("applies 1.6x multiplier for difficulty-3", () => {
    setRunProgress({ selectedDifficulty: "difficulty-3" });
    awardMysteryXP("burn", 10);
    finalizeRunXP();
    expect(readRunProfile(defaultGameSession).talentXP.burn).toBe(16);
    expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
  });

  it("is idempotent — second call does not double-count XP", () => {
    setRunProgress({ selectedDifficulty: "difficulty-2" });
    awardMysteryXP("burn", 10);
    finalizeRunXP();
    expect(readRunSession(defaultGameSession).runEndTalentXP.burn).toBe(13);
    finalizeRunXP();
    expect(readRunProfile(defaultGameSession).talentXP.burn).toBe(13);
    expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
    expect(readRunSession(defaultGameSession).runEndTalentXP).toEqual({});
  });

  it("clears runEndTalentXP snapshot when there is no run XP to merge", () => {
    setRunSession({ runEndTalentXP: { burn: 99 } });
    finalizeRunXP();
    expect(readRunSession(defaultGameSession).runEndTalentXP).toEqual({});
  });
});

describe("applyRunStartSnapshot", () => {
  it("clears runTalentXP and run-end snapshots when starting a fresh run", () => {
    awardMysteryXP("burn", 5);
    setRunSession({
      runEndTalentXP: { burn: 5 },
      runEndItems: [{ kind: "trinket", trinketId: "bone-charm" }],
    });
    setRunProgress({ runObtainedItems: [{ kind: "trinket", trinketId: "bone-charm" }] });
    applyRunStartSnapshot({
      characterId: "knight",
      contentSystemType: "campaign",
      freshDeck: [],
      selectedDifficulty: "difficulty-1",
      startGoldGrant: 0,
      runPlayerHealth: 80,
      runMaxHealth: 80,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runBoons: [],
      hasActiveRun: true,
    });
    expect(readActiveRun(defaultGameSession).runTalentXP).toEqual({});
    expect(readActiveRun(defaultGameSession).runObtainedItems).toEqual([]);
    expect(readRunSession(defaultGameSession).runEndTalentXP).toEqual({});
    expect(readRunSession(defaultGameSession).runEndItems).toEqual([]);
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(true);
  });
});

describe("finalizeRunEndSession", () => {
  it("copies obtained items onto the run-end session snapshot", () => {
    const obtained = [
      {
        kind: "gear" as const,
        instance: { instanceId: "end-armor", definitionId: "leather-armor-basic", affixes: [] },
      },
      { kind: "trinket" as const, trinketId: "bone-charm" },
    ];
    setRunSession({ hasActiveRun: true });
    setRunProgress({ runObtainedItems: obtained });

    finalizeRunEndSession({ awardRunEndMaterials, finalizeRunXP: mutateFinalizeRunXP }, defaultGameSession);

    const recap = readRunSession(defaultGameSession).runEndItems;
    expect(recap).toEqual(obtained);
    expect(recap[0]).not.toBe(obtained[0]);
    if (recap[0]?.kind === "gear" && obtained[0]?.kind === "gear") {
      expect(recap[0].instance).not.toBe(obtained[0].instance);
    }
    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(false);
  });

  it("keeps run progress for the recap screens until teardown", () => {
    setRunSession({ hasActiveRun: true });
    setRunProgress({ runBoons: ["test-boon"], roomsEncountered: 4 });

    finalizeRunEndSession({ awardRunEndMaterials, finalizeRunXP: mutateFinalizeRunXP }, defaultGameSession);

    expect(readRunSession(defaultGameSession).hasActiveRun).toBe(false);
    expect(readActiveRun(defaultGameSession).runBoons).toEqual(["test-boon"]);
    expect(readActiveRun(defaultGameSession).roomsEncountered).toBe(4);
  });
});

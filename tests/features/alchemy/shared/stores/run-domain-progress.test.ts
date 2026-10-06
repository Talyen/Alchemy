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
import { computeTalentPoints, type BattleCard } from "@/lib/game-data";
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

import { awardRunEndMaterials } from "@/features/alchemy/run-loop/run/run-materials";
import { createCompleteActiveRunData, makeActiveRunData } from "./active-run-data-fixture";
import { createEmptyRewardState, serializePendingReward } from "@/lib/active-run-session";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import {
  ACTIVE_RUN_PROGRESS_KEYS,
  EMPTY_ACTIVE_RUN_COLLECTION_KEYS,
  RUN_SNAPSHOT_FIELD_KEYS,
} from "@/features/alchemy/shared/stores/run-state-init";

const syncGearRunHealth = createGameplayCommand((...args: Parameters<typeof rebindLiveRunMeta>) =>
  acceptCommand(rebindLiveRunMeta(...args)),
);
const applyRunStartSnapshot = createGameplayCommand((...args: Parameters<typeof mutateRunStartSnapshot>) =>
  acceptCommand(mutateRunStartSnapshot(...args)),
);
const finalizeRunXP = createGameplayCommand((...args: Parameters<typeof mutateFinalizeRunXP>) =>
  acceptCommand(mutateFinalizeRunXP(...args)),
);
const unlockAllTalents = createGameplayCommand((...args: Parameters<typeof mutateUnlockAllTalents>) =>
  acceptCommand(mutateUnlockAllTalents(...args)),
);
const initializeActiveRun = createGameplayCommand((...args: Parameters<typeof mutateInitializeActiveRun>) =>
  acceptCommand(mutateInitializeActiveRun(...args)),
);
const applyTalentState = createGameplayCommand((...args: Parameters<typeof mutateApplyTalentState>) =>
  acceptCommand(mutateApplyTalentState(...args)),
);
const awardCardXP = createGameplayCommand((...args: Parameters<typeof mutateAwardCardXP>) =>
  acceptCommand(mutateAwardCardXP(...args)),
);
const awardMysteryXP = createGameplayCommand((...args: Parameters<typeof mutateAwardMysteryXP>) =>
  acceptCommand(mutateAwardMysteryXP(...args)),
);
const unlockTalent = createGameplayCommand((...args: Parameters<typeof mutateUnlockTalent>) =>
  acceptCommand(mutateUnlockTalent(...args)),
);
const resetUnlockedTalents = createGameplayCommand((...args: Parameters<typeof mutateResetUnlockedTalents>) =>
  acceptCommand(mutateResetUnlockedTalents(...args)),
);
const resetRunXP = createGameplayCommand((...args: Parameters<typeof mutateResetRunXP>) =>
  acceptCommand(mutateResetRunXP(...args)),
);
const resetProgress = createGameplayCommand((...args: Parameters<typeof mutateResetProgress>) =>
  acceptCommand(mutateResetProgress(...args)),
);
const clearPermanentData = createGameplayCommand((...args: Parameters<typeof mutateClearPermanentData>) =>
  acceptCommand(mutateClearPermanentData(...args)),
);

beforeEach(() => {
  resetRunDomainStore();
});

describe("run-domain progress: initial state", () => {
  it.each([
    ["defaults to knight character", () => expect(readActiveRun().characterId).toBe("knight")],
    ["has a starting deck", () => expect(readActiveRun().runDeck.length).toBeGreaterThan(0)],
    ["starts with zero gold", () => expect(readRunProfile().gold).toBe(0)],
    [
      "starts with full health",
      () => {
        expect(readActiveRun().runPlayerHealth).toBeGreaterThan(0);
        expect(readActiveRun().runMaxHealth).toBeGreaterThanOrEqual(readActiveRun().runPlayerHealth);
      },
    ],
    ["starts at act 1", () => expect(readActiveRun().currentAct).toBe(1)],
    [
      "has empty talent XP",
      () => {
        expect(readRunProfile().talentXP).toEqual({});
        expect(readActiveRun().runTalentXP).toEqual({});
      },
    ],
    ["has empty unlocked talents", () => expect(readRunProfile().unlockedTalents).toEqual({})],
  ] as const)("%s", (_name, assert) => {
    assert();
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
      rng: readActiveRun().rng,
    });
    initializeActiveRun(activeRun);
    applyTalentState({ physical: 100 }, { physical: ["talent-1"] });
    expect(readActiveRun().characterId).toBe("rogue");
    expect(readRunProfile().gold).toBe(0);
    expect(readActiveRun().runPlayerHealth).toBe(25);
    expect(readRunProfile().talentXP.physical).toBe(100);
    expect(readRunProfile().unlockedTalents.physical).toEqual(["talent-1"]);
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

    expect(readActiveRun().completedDestinations).toEqual(["Normal Combat", "Corruption"]);
  });

  it("uses fallback character when no active run", () => {
    initializeActiveRun(null, "wizard");
    expect(readActiveRun().characterId).toBe("wizard");
  });

  it("uses knight as default fallback", () => {
    initializeActiveRun(null);
    expect(readActiveRun().characterId).toBe("knight");
  });

  it("restores navigation screen via restoreRun", () => {
    const activeRun = makeActiveRunData({ currentScreen: "shop" });
    restoreRun(activeRun, {}, {});
    expect(readActiveRunScreen()).toBe("shop");
  });

  it("round-trips every active-run persistence region through the aggregate", () => {
    const activeRun = createCompleteActiveRunData();
    activeRun.interruptedFlow = {
      kind: "primary-reward",
      pending: serializePendingReward({
        ...createEmptyRewardState(["Mystery", "Card Shop"]),
        gold: 7,
        lastVictoryEnemyType: "elite",
        lastVictoryContentSystem: "labyrinth",
      })!,
    };

    restoreRun(activeRun, { armor: 21 }, { armor: ["armor-1"] });
    const snapshot = snapshotRun();

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
      currentScreen: "battle",
      // Actual unclaimed Gold survives alongside its routing data. Victory
      // markers alone must not fabricate a new reward visit.
      interruptedFlow: { kind: "primary-reward" },
      shopState: null,
      alchemistState: null,
      trinketShopState: null,
      equipmentShopState: null,
      mysteryVisit: activeRun.mysteryVisit,
      corruptionResult: activeRun.corruptionResult,
    });
    expect(snapshot.rng).toEqual(activeRun.rng);
    if (snapshot.interruptedFlow.kind !== "primary-reward") {
      throw new Error("Expected unclaimed Gold to survive as a primary-reward interruption");
    }
    expect(snapshot.interruptedFlow.pending.gold).toBe(7);
    expect(snapshot.interruptedFlow.pending.destinations).toEqual(["Mystery", "Card Shop"]);
    expect(snapshot.activeCombat).toMatchObject({
      battleState: {
        turn: (activeRun.activeCombat?.battleState.turn ?? 0) + 1,
        playerHealth: activeRun.activeCombat?.battleState.playerHealth,
        turnPhase: "player",
      },
      pendingBattleTransition: null,
      activeLabyrinthModifiers: activeRun.activeCombat?.activeLabyrinthModifiers,
      activeLabyrinthRewardModifiers: activeRun.activeCombat?.activeLabyrinthRewardModifiers,
    });
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

    expect(readActiveRun().runMaxHealth).toBe(37);
    expect(readActiveRun().runPlayerHealth).toBe(30);
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

    expect(readActiveRun().runMaxHealth).toBe(30);
    expect(readActiveRun().runPlayerHealth).toBe(30);
  });
});

describe("awardCardXP", () => {
  it("awards XP for card keywords to runTalentXP", () => {
    const card: BattleCard = {
      id: "fireball",
      title: "Fireball",
      descriptionLines: [""],
      art: "",
      cost: 3,
      effects: [{ kind: "damage", damageType: "burn", amount: 8 }],
    };
    awardCardXP(card);
    expect(readActiveRun().runTalentXP.burn).toBeGreaterThan(0);
    expect(readRunProfile().talentXP.burn).toBeUndefined();
  });

  it("does nothing for card with no keywords", () => {
    const card: BattleCard = {
      id: "blank",
      title: "Blank",
      descriptionLines: [""],
      art: "",
      cost: 0,
      effects: [],
    };
    awardCardXP(card);
    expect(readActiveRun().runTalentXP).toEqual({});
    expect(readRunProfile().talentXP).toEqual({});
  });

  it("accumulates XP across multiple cards", () => {
    const burnCard: BattleCard = {
      id: "fireball",
      title: "Fireball",
      descriptionLines: [""],
      art: "",
      cost: 3,
      effects: [{ kind: "damage", damageType: "burn", amount: 8 }],
    };
    const physCard: BattleCard = {
      id: "slash",
      title: "Slash",
      descriptionLines: [""],
      art: "",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    };
    awardCardXP(burnCard);
    awardCardXP(physCard);
    expect(readActiveRun().runTalentXP.burn).toBeGreaterThan(0);
    expect(readActiveRun().runTalentXP.physical).toBeGreaterThan(0);
    expect(readRunProfile().talentXP.burn).toBeUndefined();
    expect(readRunProfile().talentXP.physical).toBeUndefined();
  });
});

describe("awardMysteryXP", () => {
  it("awards XP directly to a keyword runTalentXP", () => {
    awardMysteryXP("burn", 50);
    expect(readActiveRun().runTalentXP.burn).toBe(50);
    expect(readRunProfile().talentXP.burn).toBeUndefined();
  });

  it("accumulates with existing runTalentXP", () => {
    awardMysteryXP("burn", 30);
    awardMysteryXP("burn", 20);
    expect(readActiveRun().runTalentXP.burn).toBe(50);
  });

  it("awards XP to all visible keywords", () => {
    awardMysteryXP("consume", 50);
    expect(readActiveRun().runTalentXP.consume).toBe(50);
  });
});

describe("unlockTalent", () => {
  it("appends the next eligible talent when points are available", () => {
    setRunProgress({ talentXP: { burn: 20 } });
    unlockTalent("burn", "burn-dmg-1");
    expect(readRunProfile().unlockedTalents.burn).toEqual(["burn-dmg-1"]);
  });

  it("preserves existing unlocks for sequential choices", () => {
    setRunProgress({ talentXP: { burn: 60 } });
    unlockTalent("burn", "burn-dmg-1");
    unlockTalent("burn", "burn-dmg-2");
    expect(readRunProfile().unlockedTalents.burn).toEqual(["burn-dmg-1", "burn-dmg-2"]);
  });

  it("ignores duplicate unlock of the same talentId", () => {
    setRunProgress({ talentXP: { burn: 20 } });
    unlockTalent("burn", "burn-dmg-1");
    unlockTalent("burn", "burn-dmg-1");
    expect(readRunProfile().unlockedTalents.burn).toEqual(["burn-dmg-1"]);
  });

  it("rejects unlock without unspent points", () => {
    setRunSession({ hasActiveRun: true });
    const before = readGameplayState();
    purchaseTalent("burn", "burn-dmg-1");
    expect(readGameplayState()).toBe(before);
  });

  it("rejects out-of-order unlocks", () => {
    setRunProgress({ talentXP: { burn: 20 } });
    unlockTalent("burn", "burn-dmg-5");
    expect(readRunProfile().unlockedTalents.burn).toBeUndefined();
  });

  it("rejects unknown talent ids", () => {
    setRunProgress({ talentXP: { nature: 100 } });
    unlockTalent("nature", "nature-not-a-real-talent");
    expect(readRunProfile().unlockedTalents.nature).toBeUndefined();
  });
});

describe("unlockAllTalents", () => {
  it("unlocks every talent from the pool", () => {
    unlockAllTalents();
    const unlocked = readRunProfile().unlockedTalents;
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
    dispatchGameplayCommand((draft) => {
      draft.runProfile.effects.homesteadHealing = 2;
      initializeActiveBattle(draft, patchBattleState({ playerHealth: 15 }));
      rebindLiveRunMeta(draft);

      return acceptCommand();
    });
    expect(readBattle().battleState.talentEffects.healMultiplier).toBe(1.1);
    const before = readBattle().battleState;
    resetUnlockedTalents();
    expect(readRunProfile().unlockedTalents).toEqual({});
    expect(readRunProfile().talentXP).toEqual({ health: 100 });
    expect(readBattle().battleState.talentEffects).toMatchObject({ healMultiplier: 1, homesteadHealing: 2 });
    expect(readBattle().battleState.playerHealth).toBe(before.playerHealth);
    expect(readBattle().battleState.hand).toEqual(before.hand);
  });
});

describe("resetRunXP", () => {
  it("clears runTalentXP but preserves talentXP after finalize", () => {
    awardMysteryXP("burn", 50);
    finalizeRunXP();
    resetRunXP();
    expect(readRunProfile().talentXP.burn).toBe(50);
    expect(readActiveRun().runTalentXP).toEqual({});
  });
});

describe("clearPermanentData", () => {
  it("clears talentXP, runTalentXP, and unlockedTalents", () => {
    awardMysteryXP("burn", 50);
    finalizeRunXP();
    unlockTalent("burn", "burn-dmg-1");
    clearPermanentData();
    expect(readRunProfile().talentXP).toEqual({});
    expect(readActiveRun().runTalentXP).toEqual({});
    expect(readRunProfile().unlockedTalents).toEqual({});
  });
});

describe("reset", () => {
  it("preserves talentXP and unlockedTalents while clearing run state", () => {
    awardMysteryXP("burn", 50);
    finalizeRunXP();
    unlockTalent("burn", "burn-dmg-1");
    setRunProgress({ gold: 100, runPlayerHealth: 15 });
    resetProgress();
    expect(readRunProfile().talentXP.burn).toBe(50);
    expect(readRunProfile().unlockedTalents.burn).toEqual(["burn-dmg-1"]);
    expect(readActiveRun().runTalentXP).toEqual({});
    expect(readRunProfile().gold).toBe(100);
    expect(readActiveRun().runPlayerHealth).toBeGreaterThan(0);
    expect(readRunInitialized()).toBe(false);
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
    expect(readActiveRun().runTalentXP.physical).toBe(20);
    expect(computeTalentPoints(readRunProfile().talentXP.physical ?? 0)).toBe(0);

    finalizeRunXP();

    expect(readActiveRun().runTalentXP).toEqual({});
    expect(readRunProfile().talentXP.physical).toBe(20);
    expect(computeTalentPoints(readRunProfile().talentXP.physical ?? 0)).toBe(1);
    expect(readRunSession().runEndTalentXP.physical).toBe(20);
  });
});

describe("finalizeRunXP", () => {
  it("applies no multiplier for difficulty-1", () => {
    setRunProgress({ selectedDifficulty: "difficulty-1" });
    awardMysteryXP("burn", 10);
    finalizeRunXP();
    expect(readRunProfile().talentXP.burn).toBe(10);
    expect(readActiveRun().runTalentXP).toEqual({});
    expect(readRunSession().runEndTalentXP.burn).toBe(10);
  });

  it("applies 1.3x multiplier for difficulty-2", () => {
    setRunProgress({ selectedDifficulty: "difficulty-2" });
    awardMysteryXP("burn", 10);
    finalizeRunXP();
    expect(readRunProfile().talentXP.burn).toBe(13);
    expect(readActiveRun().runTalentXP).toEqual({});
    expect(readRunSession().runEndTalentXP.burn).toBe(13);
  });

  it("applies 1.6x multiplier for difficulty-3", () => {
    setRunProgress({ selectedDifficulty: "difficulty-3" });
    awardMysteryXP("burn", 10);
    finalizeRunXP();
    expect(readRunProfile().talentXP.burn).toBe(16);
    expect(readActiveRun().runTalentXP).toEqual({});
  });

  it("is idempotent — second call does not double-count XP", () => {
    setRunProgress({ selectedDifficulty: "difficulty-2" });
    awardMysteryXP("burn", 10);
    finalizeRunXP();
    expect(readRunSession().runEndTalentXP.burn).toBe(13);
    finalizeRunXP();
    expect(readRunProfile().talentXP.burn).toBe(13);
    expect(readActiveRun().runTalentXP).toEqual({});
    expect(readRunSession().runEndTalentXP).toEqual({});
  });

  it("clears runEndTalentXP snapshot when there is no run XP to merge", () => {
    setRunSession({ runEndTalentXP: { burn: 99 } });
    finalizeRunXP();
    expect(readRunSession().runEndTalentXP).toEqual({});
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
    expect(readActiveRun().runTalentXP).toEqual({});
    expect(readActiveRun().runObtainedItems).toEqual([]);
    expect(readRunSession().runEndTalentXP).toEqual({});
    expect(readRunSession().runEndItems).toEqual([]);
    expect(readRunSession().hasActiveRun).toBe(true);
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

    finalizeRunEndSession({ awardRunEndMaterials, finalizeRunXP: mutateFinalizeRunXP });

    const recap = readRunSession().runEndItems;
    expect(recap).toEqual(obtained);
    expect(recap[0]).not.toBe(obtained[0]);
    if (recap[0]?.kind === "gear" && obtained[0]?.kind === "gear") {
      expect(recap[0].instance).not.toBe(obtained[0].instance);
    }
    expect(readRunSession().hasActiveRun).toBe(false);
  });

  it("keeps run progress for the recap screens until teardown", () => {
    setRunSession({ hasActiveRun: true });
    setRunProgress({ runBoons: ["test-boon"], roomsEncountered: 4 });

    finalizeRunEndSession({ awardRunEndMaterials, finalizeRunXP: mutateFinalizeRunXP });

    expect(readRunSession().hasActiveRun).toBe(false);
    expect(readActiveRun().runBoons).toEqual(["test-boon"]);
    expect(readActiveRun().roomsEncountered).toBe(4);
  });
});

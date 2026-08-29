import "../../../../helpers/mock-audio";
import "../../../../helpers/mock-flush-save";
import { beforeEach, describe, expect, it } from "vitest";
import {
  restoreRun,
  snapshotRun,
  finalizeRunEndSession,
} from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
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
} from "@/features/alchemy/shared/stores/write-port-run";
import { applyTalentState as mutateApplyTalentState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { mutateGearForTest } from "../../../../helpers/gameplay-store-test";
import { createEmptyGearInventories, createEmptyGearLoadouts, type GearInstance } from "@/lib/gear";
import { createRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { rebindLiveRunMeta } from "@/features/alchemy/shared/stores/run-meta-rebind";
import { computeTalentPoints, type BattleCard } from "@/lib/game-data";
import {
  readActiveRun,
  readActiveRunScreen,
  readRunProfile,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";

import { awardRunEndMaterials } from "@/features/alchemy/run-loop/run/run-flow-session-helpers";
import { createCompleteActiveRunData, makeActiveRunData } from "./active-run-data-fixture";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";

const syncGearRunHealth = createRunSessionCommand(rebindLiveRunMeta);
const applyRunStartSnapshot = createRunSessionCommand(mutateRunStartSnapshot);
const finalizeRunXP = createRunSessionCommand(mutateFinalizeRunXP);
const unlockAllTalents = createRunSessionCommand(mutateUnlockAllTalents);
const initializeActiveRun = createRunSessionCommand(mutateInitializeActiveRun);
const applyTalentState = createRunSessionCommand(mutateApplyTalentState);
const awardCardXP = createRunSessionCommand(mutateAwardCardXP);
const awardMysteryXP = createRunSessionCommand(mutateAwardMysteryXP);
const unlockTalent = createRunSessionCommand(mutateUnlockTalent);
const resetUnlockedTalents = createRunSessionCommand(mutateResetUnlockedTalents);
const resetRunXP = createRunSessionCommand(mutateResetRunXP);
const resetProgress = createRunSessionCommand(mutateResetProgress);
const clearPermanentData = createRunSessionCommand(mutateClearPermanentData);

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
      currentScreen: activeRun.currentScreen,
      interruptedFlow: activeRun.interruptedFlow,
      shopState: null,
      alchemistState: null,
      trinketShopState: null,
      equipmentShopState: null,
      mysteryVisit: activeRun.mysteryVisit,
      corruptionResult: activeRun.corruptionResult,
    });
    expect(snapshot.rng).toEqual(activeRun.rng);
    expect(snapshot.activeCombat).toMatchObject({
      battleState: {
        turn: activeRun.activeCombat?.battleState.turn,
        playerHealth: activeRun.activeCombat?.battleState.playerHealth,
        turnPhase: activeRun.activeCombat?.battleState.turnPhase,
      },
      pendingBattleTransition: activeRun.activeCombat?.pendingBattleTransition,
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
    setRunProgress({ talentXP: { burn: 10 } });
    unlockTalent("burn", "burn-dmg-1");
    expect(readRunProfile().unlockedTalents.burn).toEqual(["burn-dmg-1"]);
  });

  it("preserves existing unlocks for sequential choices", () => {
    setRunProgress({ talentXP: { burn: 30 } });
    unlockTalent("burn", "burn-dmg-1");
    unlockTalent("burn", "burn-dmg-2");
    expect(readRunProfile().unlockedTalents.burn).toEqual(["burn-dmg-1", "burn-dmg-2"]);
  });

  it("ignores duplicate unlock of the same talentId", () => {
    setRunProgress({ talentXP: { burn: 10 } });
    unlockTalent("burn", "burn-dmg-1");
    unlockTalent("burn", "burn-dmg-1");
    expect(readRunProfile().unlockedTalents.burn).toEqual(["burn-dmg-1"]);
  });

  it("rejects unlock without unspent points", () => {
    unlockTalent("burn", "burn-dmg-1");
    expect(readRunProfile().unlockedTalents.burn).toBeUndefined();
  });

  it("rejects out-of-order unlocks", () => {
    setRunProgress({ talentXP: { burn: 10 } });
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
  it("clears all unlocked talents", () => {
    unlockTalent("burn", "talent-1");
    resetUnlockedTalents();
    expect(readRunProfile().unlockedTalents).toEqual({});
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

    for (let i = 0; i < 10; i++) {
      awardCardXP(card);
    }
    expect(readActiveRun().runTalentXP.physical).toBe(10);
    expect(computeTalentPoints(readRunProfile().talentXP.physical ?? 0)).toBe(0);

    finalizeRunXP();

    expect(readActiveRun().runTalentXP).toEqual({});
    expect(readRunProfile().talentXP.physical).toBe(10);
    expect(computeTalentPoints(readRunProfile().talentXP.physical ?? 0)).toBe(1);
    expect(readRunSession().runEndTalentXP.physical).toBe(10);
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
});

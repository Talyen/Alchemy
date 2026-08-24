import "../../../../helpers/mock-audio";
import "../../../../helpers/mock-flush-save";
import { beforeEach, describe, expect, it } from "vitest";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import {
  applyRunStartSnapshot as mutateRunStartSnapshot,
  finalizeRunXP as mutateFinalizeRunXP,
  unlockAllTalents as mutateUnlockAllTalents,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { applyGameplayStateUpdate, useGearStore, useRunProfileStore } from "../../../../helpers/gameplay-store-test";
import { createEmptyGearInventories, createEmptyGearLoadouts, type GearInstance } from "@/lib/gear";
import { createRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { rebindLiveRunMeta } from "@/features/alchemy/shared/stores/run-meta-rebind";
import { computeTalentPoints, type BattleCard } from "@/lib/game-data";

import { createCompleteActiveRunData, makeActiveRunData } from "./active-run-data-fixture";

const syncGearRunHealth = createRunSessionCommand(rebindLiveRunMeta);
const applyRunStartSnapshot = createRunSessionCommand(mutateRunStartSnapshot);
const finalizeRunXP = createRunSessionCommand(mutateFinalizeRunXP);
const unlockAllTalents = createRunSessionCommand(mutateUnlockAllTalents);

import {
  getNavigationStoreView,
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunDomainStore,
  setRunProgress,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunDomainStore();
});

describe("run-domain progress: initial state", () => {
  it("defaults to knight character", () => {
    expect(getRunProgressStoreView().characterId).toBe("knight");
  });

  it("has a starting deck", () => {
    expect(getRunProgressStoreView().runDeck.length).toBeGreaterThan(0);
  });

  it("starts with zero gold", () => {
    expect(getRunProgressStoreView().runGold).toBe(0);
  });

  it("starts with full health", () => {
    expect(getRunProgressStoreView().runPlayerHealth).toBeGreaterThan(0);
    expect(getRunProgressStoreView().runMaxHealth).toBeGreaterThanOrEqual(getRunProgressStoreView().runPlayerHealth);
  });

  it("starts at act 1", () => {
    expect(getRunProgressStoreView().currentAct).toBe(1);
  });

  it("has empty talent XP", () => {
    expect(getRunProgressStoreView().talentXP).toEqual({});
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
  });

  it("has empty unlocked talents", () => {
    expect(getRunProgressStoreView().unlockedTalents).toEqual({});
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
      rng: getRunProgressStoreView().rng,
    });
    getRunProgressStoreView().initialize(activeRun);
    useRunProfileStore.getState().applyTalentState({ physical: 100 }, { physical: ["talent-1"] });
    expect(getRunProgressStoreView().characterId).toBe("rogue");
    expect(getRunProgressStoreView().runGold).toBe(0);
    expect(getRunProgressStoreView().runPlayerHealth).toBe(25);
    expect(getRunProgressStoreView().talentXP.physical).toBe(100);
    expect(getRunProgressStoreView().unlockedTalents.physical).toEqual(["talent-1"]);
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

    getRunProgressStoreView().initialize(activeRun);

    expect(getRunProgressStoreView().completedDestinations).toEqual(["Normal Combat", "Corruption"]);
  });

  it("uses fallback character when no active run", () => {
    getRunProgressStoreView().initialize(null, "wizard");
    expect(getRunProgressStoreView().characterId).toBe("wizard");
  });

  it("uses knight as default fallback", () => {
    getRunProgressStoreView().initialize(null);
    expect(getRunProgressStoreView().characterId).toBe("knight");
  });

  it("restores navigation screen via restoreRun", () => {
    const activeRun = makeActiveRunData({ currentScreen: "shop" });
    restoreRun(activeRun, {}, {});
    expect(getNavigationStoreView().screen).toBe("shop");
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
      runTrinkets: activeRun.runTrinkets,
      encounteredRunEnemyIds: activeRun.encounteredRunEnemyIds,
      selectedDifficulty: activeRun.selectedDifficulty,
      contentSystemType: activeRun.contentSystemType,
      labyrinthMap: activeRun.labyrinthMap,
      labyrinthPendingNode: activeRun.labyrinthPendingNode,
      runTalentXP: activeRun.runTalentXP,
      runMaterialsEarned: activeRun.runMaterialsEarned,
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
    useGearStore.getState().initialize(inventories, loadouts);
    setRunProgress({
      characterId: "knight",
      runMaxHealth: 30,
      runPlayerHealth: 30,
      runMetaMaxHealth: 30,
    });
    setRunSession({ hasActiveRun: true });

    syncGearRunHealth();

    expect(getRunProgressStoreView().runMaxHealth).toBe(37);
    expect(getRunProgressStoreView().runPlayerHealth).toBe(30);
  });

  it("rebinds max health when equipped gear is removed", () => {
    useGearStore.getState().initialize(createEmptyGearInventories(), createEmptyGearLoadouts());
    setRunProgress({
      characterId: "knight",
      runMaxHealth: 37,
      runPlayerHealth: 35,
      runMetaMaxHealth: 37,
    });
    setRunSession({ hasActiveRun: true });

    syncGearRunHealth();

    expect(getRunProgressStoreView().runMaxHealth).toBe(30);
    expect(getRunProgressStoreView().runPlayerHealth).toBe(30);
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
    getRunProgressStoreView().awardCardXP(card);
    expect(getRunProgressStoreView().runTalentXP.burn).toBeGreaterThan(0);
    expect(getRunProgressStoreView().talentXP.burn).toBeUndefined();
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
    getRunProgressStoreView().awardCardXP(card);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
    expect(getRunProgressStoreView().talentXP).toEqual({});
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
    getRunProgressStoreView().awardCardXP(burnCard);
    getRunProgressStoreView().awardCardXP(physCard);
    expect(getRunProgressStoreView().runTalentXP.burn).toBeGreaterThan(0);
    expect(getRunProgressStoreView().runTalentXP.physical).toBeGreaterThan(0);
    expect(getRunProgressStoreView().talentXP.burn).toBeUndefined();
    expect(getRunProgressStoreView().talentXP.physical).toBeUndefined();
  });
});

describe("awardMysteryXP", () => {
  it("awards XP directly to a keyword runTalentXP", () => {
    getRunProgressStoreView().awardMysteryXP("burn", 50);
    expect(getRunProgressStoreView().runTalentXP.burn).toBe(50);
    expect(getRunProgressStoreView().talentXP.burn).toBeUndefined();
  });

  it("accumulates with existing runTalentXP", () => {
    getRunProgressStoreView().awardMysteryXP("burn", 30);
    getRunProgressStoreView().awardMysteryXP("burn", 20);
    expect(getRunProgressStoreView().runTalentXP.burn).toBe(50);
  });

  it("awards XP to all visible keywords", () => {
    getRunProgressStoreView().awardMysteryXP("consume", 50);
    expect(getRunProgressStoreView().runTalentXP.consume).toBe(50);
  });
});

describe("unlockTalent", () => {
  it("appends the next eligible talent when points are available", () => {
    setRunProgress({ talentXP: { burn: 10 } });
    getRunProgressStoreView().unlockTalent("burn", "burn-dmg-1");
    expect(getRunProgressStoreView().unlockedTalents.burn).toEqual(["burn-dmg-1"]);
  });

  it("preserves existing unlocks for sequential choices", () => {
    setRunProgress({ talentXP: { burn: 30 } });
    getRunProgressStoreView().unlockTalent("burn", "burn-dmg-1");
    getRunProgressStoreView().unlockTalent("burn", "burn-dmg-2");
    expect(getRunProgressStoreView().unlockedTalents.burn).toEqual(["burn-dmg-1", "burn-dmg-2"]);
  });

  it("ignores duplicate unlock of the same talentId", () => {
    setRunProgress({ talentXP: { burn: 10 } });
    getRunProgressStoreView().unlockTalent("burn", "burn-dmg-1");
    getRunProgressStoreView().unlockTalent("burn", "burn-dmg-1");
    expect(getRunProgressStoreView().unlockedTalents.burn).toEqual(["burn-dmg-1"]);
  });

  it("rejects unlock without unspent points", () => {
    getRunProgressStoreView().unlockTalent("burn", "burn-dmg-1");
    expect(getRunProgressStoreView().unlockedTalents.burn).toBeUndefined();
  });

  it("rejects out-of-order unlocks", () => {
    setRunProgress({ talentXP: { burn: 10 } });
    getRunProgressStoreView().unlockTalent("burn", "burn-dmg-5");
    expect(getRunProgressStoreView().unlockedTalents.burn).toBeUndefined();
  });

  it("rejects unknown talent ids", () => {
    setRunProgress({ talentXP: { nature: 100 } });
    getRunProgressStoreView().unlockTalent("nature", "nature-not-a-real-talent");
    expect(getRunProgressStoreView().unlockedTalents.nature).toBeUndefined();
  });
});

describe("unlockAllTalents", () => {
  it("unlocks every talent from the pool", () => {
    unlockAllTalents();
    const unlocked = getRunProgressStoreView().unlockedTalents;
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
    getRunProgressStoreView().unlockTalent("burn", "talent-1");
    getRunProgressStoreView().resetUnlockedTalents();
    expect(getRunProgressStoreView().unlockedTalents).toEqual({});
  });
});

describe("resetRunXP", () => {
  it("clears runTalentXP but preserves talentXP after finalize", () => {
    getRunProgressStoreView().awardMysteryXP("burn", 50);
    finalizeRunXP();
    getRunProgressStoreView().resetRunXP();
    expect(getRunProgressStoreView().talentXP.burn).toBe(50);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
  });
});

describe("clearPermanentData", () => {
  it("clears talentXP, runTalentXP, and unlockedTalents", () => {
    getRunProgressStoreView().awardMysteryXP("burn", 50);
    finalizeRunXP();
    getRunProgressStoreView().unlockTalent("burn", "burn-dmg-1");
    getRunProgressStoreView().clearPermanentData();
    expect(getRunProgressStoreView().talentXP).toEqual({});
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
    expect(getRunProgressStoreView().unlockedTalents).toEqual({});
  });
});

describe("reset", () => {
  it("preserves talentXP and unlockedTalents while clearing run state", () => {
    getRunProgressStoreView().awardMysteryXP("burn", 50);
    finalizeRunXP();
    getRunProgressStoreView().unlockTalent("burn", "burn-dmg-1");
    setRunProgress({ runGold: 100, runPlayerHealth: 15 });
    getRunProgressStoreView().reset();
    expect(getRunProgressStoreView().talentXP.burn).toBe(50);
    expect(getRunProgressStoreView().unlockedTalents.burn).toEqual(["burn-dmg-1"]);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
    expect(getRunProgressStoreView().runGold).toBe(100);
    expect(getRunProgressStoreView().runPlayerHealth).toBeGreaterThan(0);
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
      getRunProgressStoreView().awardCardXP(card);
    }
    expect(getRunProgressStoreView().runTalentXP.physical).toBe(10);
    expect(computeTalentPoints(getRunProgressStoreView().talentXP.physical ?? 0)).toBe(0);

    finalizeRunXP();

    expect(getRunProgressStoreView().runTalentXP).toEqual({});
    expect(getRunProgressStoreView().talentXP.physical).toBe(10);
    expect(computeTalentPoints(getRunProgressStoreView().talentXP.physical ?? 0)).toBe(1);
    expect(getRunSessionStoreView().runEndTalentXP.physical).toBe(10);
  });
});

describe("finalizeRunXP", () => {
  it("applies no multiplier for difficulty-1", () => {
    setRunProgress({ selectedDifficulty: "difficulty-1" });
    getRunProgressStoreView().awardMysteryXP("burn", 10);
    finalizeRunXP();
    expect(getRunProgressStoreView().talentXP.burn).toBe(10);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
    expect(getRunSessionStoreView().runEndTalentXP.burn).toBe(10);
  });

  it("applies 1.3x multiplier for difficulty-2", () => {
    setRunProgress({ selectedDifficulty: "difficulty-2" });
    getRunProgressStoreView().awardMysteryXP("burn", 10);
    finalizeRunXP();
    expect(getRunProgressStoreView().talentXP.burn).toBe(13);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
    expect(getRunSessionStoreView().runEndTalentXP.burn).toBe(13);
  });

  it("applies 1.6x multiplier for difficulty-3", () => {
    setRunProgress({ selectedDifficulty: "difficulty-3" });
    getRunProgressStoreView().awardMysteryXP("burn", 10);
    finalizeRunXP();
    expect(getRunProgressStoreView().talentXP.burn).toBe(16);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
  });

  it("is idempotent — second call does not double-count XP", () => {
    setRunProgress({ selectedDifficulty: "difficulty-2" });
    getRunProgressStoreView().awardMysteryXP("burn", 10);
    finalizeRunXP();
    expect(getRunSessionStoreView().runEndTalentXP.burn).toBe(13);
    finalizeRunXP();
    expect(getRunProgressStoreView().talentXP.burn).toBe(13);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
    expect(getRunSessionStoreView().runEndTalentXP).toEqual({});
  });

  it("clears runEndTalentXP snapshot when there is no run XP to merge", () => {
    applyGameplayStateUpdate((state) => {
      state.session.runEndTalentXP = { burn: 99 };
    });
    finalizeRunXP();
    expect(getRunSessionStoreView().runEndTalentXP).toEqual({});
  });
});

describe("applyRunStartSnapshot", () => {
  it("clears runTalentXP and runEndTalentXP when starting a fresh run", () => {
    getRunProgressStoreView().awardMysteryXP("burn", 5);
    applyGameplayStateUpdate((state) => {
      state.session.runEndTalentXP = { burn: 5 };
    });
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
      runTrinkets: [],
      hasActiveRun: true,
    });
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
    expect(getRunSessionStoreView().runEndTalentXP).toEqual({});
    expect(getRunSessionStoreView().hasActiveRun).toBe(true);
  });
});

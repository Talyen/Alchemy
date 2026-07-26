import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { ROUTE_SCREENS } from "@/lib/routing";
import { createActiveRunSnapshot } from "@/lib/active-run-session";
import { createEmptyRewardState } from "@/features/alchemy/run-loop/navigation/reward-flow";
import {
  applyRunDefeatTeardown,
  finalizeRunEndSession,
  flushSaveAfterRunEnd,
  restoreRun,
  syncBattleToRun,
  syncRunMaxHealthFromGearMutation,
  syncRunToBattleStart,
  teardownRun,
} from "@/features/alchemy/shared/stores/run-transitions";
import { getCombinedRunGold, getCurrentRunPhase } from "../../../../helpers/run-session-assertions";
import { getRunSession, snapshotRun } from "@/features/alchemy/shared/stores/run-session-facade";
import { flattenRunSessionForScreens } from "@/features/alchemy/shared/stores/run-screen-data";
import { computeTalentPoints, type BattleCard } from "@/lib/game-data";
import type { ActiveRunData } from "@/lib/active-run-session";
import { emptyInventory } from "@/lib/homestead/inventory";
import { createEmptyGearLoadouts, type GearInstance } from "@/lib/gear";

vi.mock("@/features/alchemy/shared/storage/flush-save", () => ({
  flushAlchemySaveNow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/audio", () => ({
  playDefeat: vi.fn(),
  stopAllSfx: vi.fn(),
}));

import { flushAlchemySaveNow } from "@/features/alchemy/shared/storage/flush-save";
import { playDefeat, stopAllSfx } from "@/lib/audio";
import {
  getBattleStoreView,
  getNavigationStoreView,
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunBattleSlice,
  resetRunDomainStore,
  resetRunSessionSlice,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetRunDomainStore();
});

describe("initial state", () => {
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
    const activeRun: ActiveRunData = {
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
      runGold: 50,
      runPlayerHealth: 25,
      runMaxHealth: 30,
      roomsEncountered: 3,
      currentAct: 1,
      destinationIndexInAct: 2,
      completedDestinations: ["combat"],
      runTrinkets: [],
      encounteredRunEnemyIds: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      labyrinthPendingNode: null,
      activeCombat: null,
      runTalentXP: {},
      lastOfferedDestinations: [],
      destinationRoundsSinceOffered: {},
      wildwoodDraft: null,
      runMaterialsEarned: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
      shopState: null,
      alchemistState: null,
      trinketShopState: null,
      equipmentShopState: null,
      currentScreen: null,
      destinationChoices: [],
      pendingReward: null,
    };
    getRunProgressStoreView().initialize(activeRun, { physical: 100 }, { physical: ["talent-1"] });
    expect(getRunProgressStoreView().characterId).toBe("rogue");
    expect(getRunProgressStoreView().runGold).toBe(50);
    expect(getRunProgressStoreView().runPlayerHealth).toBe(25);
    expect(getRunProgressStoreView().talentXP.physical).toBe(100);
    expect(getRunProgressStoreView().unlockedTalents.physical).toEqual(["talent-1"]);
  });

  it("restores valid completed destination labels", () => {
    const activeRun: ActiveRunData = {
      characterId: "rogue",
      runDeck: [],
      runGold: 50,
      runPlayerHealth: 25,
      runMaxHealth: 30,
      roomsEncountered: 3,
      currentAct: 1,
      destinationIndexInAct: 2,
      completedDestinations: ["Normal Combat", "Corruption"],
      runTrinkets: [],
      encounteredRunEnemyIds: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      labyrinthPendingNode: null,
      activeCombat: null,
      runTalentXP: {},
      lastOfferedDestinations: [],
      destinationRoundsSinceOffered: {},
      wildwoodDraft: null,
      runMaterialsEarned: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
      shopState: null,
      alchemistState: null,
      trinketShopState: null,
      equipmentShopState: null,
      currentScreen: null,
      destinationChoices: [],
      pendingReward: null,
    };

    getRunProgressStoreView().initialize(activeRun, {}, {});

    expect(getRunProgressStoreView().completedDestinations).toEqual(["Normal Combat", "Corruption"]);
  });

  it("uses fallback character when no active run", () => {
    getRunProgressStoreView().initialize(null, {}, {}, "wizard");
    expect(getRunProgressStoreView().characterId).toBe("wizard");
  });

  it("uses knight as default fallback", () => {
    getRunProgressStoreView().initialize(null, {}, {});
    expect(getRunProgressStoreView().characterId).toBe("knight");
  });

  it("restores navigation screen via restoreRun", () => {
    const activeRun: ActiveRunData = {
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 20,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      encounteredRunEnemyIds: [],
      selectedDifficulty: null,
      contentSystemType: "campaign",
      labyrinthMap: null,
      labyrinthPendingNode: null,
      activeCombat: null,
      runTalentXP: {},
      lastOfferedDestinations: [],
      destinationRoundsSinceOffered: {},
      wildwoodDraft: null,
      runMaterialsEarned: { wood: 0, iron: 0, herbs: 0, food: 0, crystal: 0 },
      shopState: null,
      alchemistState: null,
      trinketShopState: null,
      equipmentShopState: null,
      currentScreen: "shop",
      destinationChoices: [],
      pendingReward: null,
    };
    restoreRun(activeRun, {}, {});
    expect(getNavigationStoreView().screen).toBe("shop");
  });
});

describe("gear max health sync", () => {
  const maxHealthHelm: GearInstance = {
    instanceId: "max-health-helm",
    definitionId: "leather-helm-basic",
    affixes: [{ id: "max-health", value: 7 }],
  };

  it("applies max-health deltas when equipped gear inventory mutates", () => {
    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.helm = maxHealthHelm.instanceId;
    setRunProgress({ characterId: "knight", runMaxHealth: 37, runPlayerHealth: 37, initialized: true });

    syncRunMaxHealthFromGearMutation(
      "knight",
      [maxHealthHelm],
      loadouts,
      [{ ...maxHealthHelm, affixes: [] }],
      loadouts,
    );

    expect(getRunProgressStoreView().runMaxHealth).toBe(30);
    expect(getRunProgressStoreView().runPlayerHealth).toBe(30);
  });

  it("applies max-health deltas when equipped gear is removed", () => {
    const loadoutsBefore = createEmptyGearLoadouts();
    loadoutsBefore.knight.helm = maxHealthHelm.instanceId;
    const loadoutsAfter = createEmptyGearLoadouts();
    setRunProgress({ characterId: "knight", runMaxHealth: 37, runPlayerHealth: 35, initialized: true });

    syncRunMaxHealthFromGearMutation("knight", [maxHealthHelm], loadoutsBefore, [], loadoutsAfter);

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

describe("addRunGold", () => {
  it("adds gold with multiplier applied", () => {
    setRunProgress({ runGold: 10 });
    getRunProgressStoreView().addRunGold(5);
    const mult = 1; // knight, difficulty-1
    expect(getRunProgressStoreView().runGold).toBe(10 + Math.floor(5 * mult));
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
    getRunProgressStoreView().unlockTalent("burn", "burn-dmg-2");
    expect(getRunProgressStoreView().unlockedTalents.burn).toBeUndefined();
  });

  it("rejects placeholder talents", () => {
    setRunProgress({ talentXP: { nature: 100 } });
    getRunProgressStoreView().unlockTalent("nature", "nature-placeholder-1");
    expect(getRunProgressStoreView().unlockedTalents.nature).toBeUndefined();
  });
});

describe("unlockAllTalents", () => {
  it("unlocks every talent from the pool", () => {
    getRunProgressStoreView().unlockAllTalents();
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
    getRunProgressStoreView().finalizeRunXP();
    getRunProgressStoreView().resetRunXP();
    expect(getRunProgressStoreView().talentXP.burn).toBe(50);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
  });
});

describe("clearPermanentData", () => {
  it("clears talentXP, runTalentXP, and unlockedTalents", () => {
    getRunProgressStoreView().awardMysteryXP("burn", 50);
    getRunProgressStoreView().finalizeRunXP();
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
    getRunProgressStoreView().finalizeRunXP();
    getRunProgressStoreView().unlockTalent("burn", "burn-dmg-1");
    setRunProgress({ runGold: 100, runPlayerHealth: 15 });
    getRunProgressStoreView().reset();
    expect(getRunProgressStoreView().talentXP.burn).toBe(50);
    expect(getRunProgressStoreView().unlockedTalents.burn).toEqual(["burn-dmg-1"]);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
    expect(getRunProgressStoreView().runGold).toBe(0);
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

    getRunProgressStoreView().finalizeRunXP();

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
    getRunProgressStoreView().finalizeRunXP();
    expect(getRunProgressStoreView().talentXP.burn).toBe(10);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
    expect(getRunSessionStoreView().runEndTalentXP.burn).toBe(10);
  });

  it("applies 1.3x multiplier for difficulty-2", () => {
    setRunProgress({ selectedDifficulty: "difficulty-2" });
    getRunProgressStoreView().awardMysteryXP("burn", 10);
    getRunProgressStoreView().finalizeRunXP();
    expect(getRunProgressStoreView().talentXP.burn).toBe(13);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
    expect(getRunSessionStoreView().runEndTalentXP.burn).toBe(13);
  });

  it("applies 1.6x multiplier for difficulty-3", () => {
    setRunProgress({ selectedDifficulty: "difficulty-3" });
    getRunProgressStoreView().awardMysteryXP("burn", 10);
    getRunProgressStoreView().finalizeRunXP();
    expect(getRunProgressStoreView().talentXP.burn).toBe(16);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
  });

  it("is idempotent — second call does not double-count XP", () => {
    setRunProgress({ selectedDifficulty: "difficulty-2" });
    getRunProgressStoreView().awardMysteryXP("burn", 10);
    getRunProgressStoreView().finalizeRunXP();
    expect(getRunSessionStoreView().runEndTalentXP.burn).toBe(13);
    getRunProgressStoreView().finalizeRunXP();
    expect(getRunProgressStoreView().talentXP.burn).toBe(13);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
    expect(getRunSessionStoreView().runEndTalentXP).toEqual({});
  });

  it("clears runEndTalentXP snapshot when there is no run XP to merge", () => {
    getRunSessionStoreView().setRunEndTalentXP({ burn: 99 });
    getRunProgressStoreView().finalizeRunXP();
    expect(getRunSessionStoreView().runEndTalentXP).toEqual({});
  });
});

describe("hydrateFromSnapshot", () => {
  it("clears runTalentXP and runEndTalentXP when starting a fresh run", () => {
    getRunProgressStoreView().awardMysteryXP("burn", 5);
    getRunSessionStoreView().setRunEndTalentXP({ burn: 5 });
    getRunProgressStoreView().hydrateFromSnapshot({
      characterId: "knight",
      contentSystemType: "campaign",
      freshDeck: [],
      selectedDifficulty: "difficulty-1",
      runGold: 0,
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
  });
});

describe("session slice", () => {
  beforeEach(() => {
    resetRunSessionSlice();
  });

  it("has empty shop and alchemist state", () => {
    expect(getRunSessionStoreView().shopState.cards).toEqual([]);
    expect(getRunSessionStoreView().alchemistState.potions).toEqual([]);
  });

  it("starts with empty reward state and no active run", () => {
    expect(getRunSessionStoreView().rewardState).toEqual(createEmptyRewardState());
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
  });

  it("setRewardState accepts direct values and updaters", () => {
    getRunSessionStoreView().setRewardState({ ...createEmptyRewardState(), gold: 50 });
    expect(getRunSessionStoreView().rewardState.gold).toBe(50);
    getRunSessionStoreView().setRewardState((prev) => ({ ...prev, gold: prev.gold + 25 }));
    expect(getRunSessionStoreView().rewardState.gold).toBe(75);
  });
});

describe("battle slice", () => {
  beforeEach(() => {
    resetRunBattleSlice();
  });

  it("initializes battleState and hasActiveBattle defaults", () => {
    expect(getBattleStoreView().battleState).not.toBeNull();
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
  });

  it("hydrates and resets active battle", () => {
    getBattleStoreView().initializeActiveBattle({ ...defaultBattleState(), turn: 4, playerHealth: 9 });
    expect(getBattleStoreView().hasActiveBattle).toBe(true);
    getBattleStoreView().initializeActiveBattle(null);
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
  });
});

describe("run transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRunDomainStore();
    teardownRun();
    setRunProgress({ runPlayerHealth: 18, runMaxHealth: 24, runGold: 40, initialized: true });
    getBattleStoreView().setSyncedBattleState({ ...defaultBattleState(), playerHealth: 10, gold: 7 });
    getRunSessionStoreView().setHasActiveRun(true);
  });

  it("syncRunToBattleStart clamps and persists run HP", () => {
    const health = syncRunToBattleStart();
    expect(health).toBeGreaterThan(0);
    expect(getRunProgressStoreView().runPlayerHealth).toBe(health);
  });

  it("syncBattleToRun copies battle HP to the run store", () => {
    syncBattleToRun({ playerHealth: 14 });
    expect(getRunProgressStoreView().runPlayerHealth).toBe(14);
  });

  it("teardownRun clears session flags and returns to menu", () => {
    teardownRun();
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
    expect(getNavigationStoreView().screen).toBe(ROUTE_SCREENS.MENU);
  });

  it("flushSaveAfterRunEnd persists with no active run", async () => {
    flushSaveAfterRunEnd();
    await vi.waitFor(() => {
      expect(flushAlchemySaveNow).toHaveBeenCalledWith(null, expect.objectContaining({ initialized: true }), {}, {});
    });
  });

  it("finalizeRunEndSession clears hasActiveRun", () => {
    getRunSessionStoreView().setHasActiveRun(true);
    finalizeRunEndSession({
      awardRunEndMaterials: vi.fn(() => emptyInventory()),
      finalizeRunXP: vi.fn(),
    });
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
  });

  it("applyRunDefeatTeardown awards materials, finalizes XP, flushes, and clears combat", async () => {
    getRunSessionStoreView().setHasActiveRun(true);
    const awardRunEndMaterials = vi.fn(() => emptyInventory());
    const finalizeRunXP = vi.fn();
    const clearCombatState = vi.fn();
    applyRunDefeatTeardown({ awardRunEndMaterials, finalizeRunXP, clearCombatState });
    expect(awardRunEndMaterials).toHaveBeenCalledOnce();
    expect(finalizeRunXP).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(flushAlchemySaveNow).toHaveBeenCalledWith(null, expect.objectContaining({ initialized: true }), {}, {});
    });
    expect(clearCombatState).toHaveBeenCalledOnce();
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
    expect(stopAllSfx).toHaveBeenCalledOnce();
    expect(playDefeat).toHaveBeenCalledOnce();
  });
});

describe("session facade API", () => {
  beforeEach(() => {
    teardownRun();
    getRunProgressStoreView().reset();
    setRunProgress({ runPlayerHealth: 18, runMaxHealth: 24, runGold: 40, initialized: true });
    getBattleStoreView().setSyncedBattleState({ ...defaultBattleState(), playerHealth: 10, gold: 7 });
    getRunSessionStoreView().setHasActiveRun(true);
  });

  it("flattenRunSessionForScreens aggregates run, battle, and session fields", () => {
    const flat = flattenRunSessionForScreens(getRunSession(ROUTE_SCREENS.MENU));
    expect(flat.runPlayerHealth).toBe(18);
    expect(flat.runGold).toBe(40);
    expect(flat.battleState.playerHealth).toBe(10);
    expect(flat.hasActiveRun).toBe(true);
    expect(flat.phase).toBe("meta");
  });

  it("getCombinedRunGold sums map and combat gold", () => {
    expect(getCombinedRunGold()).toBe(47);
  });

  it("getCurrentRunPhase reflects battle screen and hasActiveBattle", () => {
    getBattleStoreView().setHasActiveBattle(true);
    expect(getCurrentRunPhase(ROUTE_SCREENS.BATTLE)).toBe("battle");
    getBattleStoreView().setHasActiveBattle(false);
    expect(getCurrentRunPhase(ROUTE_SCREENS.BATTLE)).toBe("runLoop");
  });

  it("snapshotRun matches explicit snapshot fields", () => {
    setRunProgress({
      characterId: "knight",
      runDeck: [],
      runGold: 12,
      runPlayerHealth: 18,
      runMaxHealth: 24,
      contentSystemType: "campaign",
    });
    getRunSessionStoreView().setRewardState((prev) => ({ ...prev, destinations: ["Campfire", "Merchant's Shop"] }));
    const fromStores = snapshotRun(ROUTE_SCREENS.DESTINATION);
    const explicit = createActiveRunSnapshot({
      characterId: "knight",
      runDeck: [],
      runGold: 12,
      runPlayerHealth: 18,
      runMaxHealth: 24,
      roomsEncountered: getRunProgressStoreView().roomsEncountered,
      currentAct: getRunProgressStoreView().currentAct,
      destinationIndexInAct: getRunProgressStoreView().destinationIndexInAct,
      completedDestinations: getRunProgressStoreView().completedDestinations,
      lastOfferedDestinations: getRunProgressStoreView().lastOfferedDestinations,
      destinationRoundsSinceOffered: Object.fromEntries(
        Object.entries(getRunProgressStoreView().destinationRoundsSinceOffered),
      ),
      runTrinkets: getRunProgressStoreView().runTrinkets,
      encounteredRunEnemyIds: getRunProgressStoreView().encounteredRunEnemyIds,
      selectedDifficulty: getRunProgressStoreView().selectedDifficulty,
      contentSystemType: "campaign",
      labyrinthMap: getRunSessionStoreView().labyrinthMap,
      hasActiveBattle: getBattleStoreView().hasActiveBattle,
      battleState: getBattleStoreView().battleState,
      labyrinthPendingNode: getRunSessionStoreView().activeLabyrinthPendingNode,
      activeLabyrinthModifiers: getRunSessionStoreView().activeLabyrinthModifiers,
      activeLabyrinthRewardModifiers: getRunSessionStoreView().activeLabyrinthRewardModifiers,
      runTalentXP: getRunProgressStoreView().runTalentXP,
      runMaterialsEarned: getRunProgressStoreView().runMaterialsEarned,
      currentScreen: ROUTE_SCREENS.DESTINATION,
      destinationChoices: ["Campfire", "Merchant's Shop"],
      pendingReward: null,
      shopState: null,
      alchemistState: null,
      trinketShopState: null,
      equipmentShopState: null,
      wildwoodDraft: null,
    });
    expect(fromStores).toEqual(explicit);
  });

  it("snapshots pending rewards whenever choices are present", () => {
    const instance = { instanceId: "gear-1", definitionId: "ruby-ring-basic" as const, affixes: [] };
    getRunSessionStoreView().setRewardState({
      ...createEmptyRewardState(),
      rewardType: "gear",
      choices: [instance],
      gold: 5,
    });
    const snap = snapshotRun(ROUTE_SCREENS.DESTINATION);
    expect(snap.pendingReward).toEqual(
      expect.objectContaining({
        rewardType: "gear",
        gearChoices: [instance],
        gold: 5,
      }),
    );
  });

  it("snapshots and restores pending gear rewards on the rewards screen", () => {
    const instance = { instanceId: "gear-1", definitionId: "ruby-ring-basic" as const, affixes: [] };
    getRunSessionStoreView().setRewardState({
      ...createEmptyRewardState(),
      rewardType: "gear",
      choices: [instance],
      gold: 5,
    });
    const snap = snapshotRun(ROUTE_SCREENS.REWARDS);
    expect(snap.pendingReward).toEqual(
      expect.objectContaining({
        rewardType: "gear",
        gearChoices: [instance],
        gold: 5,
      }),
    );

    getRunSessionStoreView().setRewardState(createEmptyRewardState());
    restoreRun(snap, {}, {});
    expect(getRunSessionStoreView().rewardState.rewardType).toBe("gear");
    expect(getRunSessionStoreView().rewardState.choices).toEqual([instance]);
  });

  it("restores wildwood gear rewards from recovery-phase draft when pendingReward is absent", () => {
    const instance = { instanceId: "gear-1", definitionId: "ruby-ring-basic" as const, affixes: [] };
    const activeRun = {
      ...snapshotRun(ROUTE_SCREENS.LABYRINTH_MAP),
      pendingReward: null,
      wildwoodDraft: {
        version: 3 as const,
        phase: "recovery" as const,
        draftChoices: [],
        remainingBossIds: ["iron-bear"] as Array<"forge-golem" | "frostwarden" | "blight-treant" | "iron-bear">,
        previousBossId: null,
        currentBossId: null,
        currentCombatTraitIds: [],
        currentRewardTraitIds: [],
        rewardType: "gear" as const,
        rewardChoiceIds: [],
        rewardGearChoices: [instance],
        selectedRewardId: null,
      },
    };

    getRunSessionStoreView().setRewardState(createEmptyRewardState());
    restoreRun(activeRun, {}, {});
    expect(getRunSessionStoreView().rewardState.rewardType).toBe("gear");
    expect(getRunSessionStoreView().rewardState.choices).toEqual([instance]);
  });

  it("warns when pending reward choices cannot be restored", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const activeRun: ActiveRunData = {
      ...snapshotRun(ROUTE_SCREENS.REWARD),
      destinationChoices: [],
      pendingReward: {
        rewardType: "card",
        choiceIds: ["not-a-real-card-id"],
        selectedId: null,
        gold: 0,
        materials: emptyInventory(),
        destinations: [],
        selectedBossId: null,
        lastVictoryEnemyType: null,
        lastVictoryContentSystem: null,
      },
    };

    getRunSessionStoreView().setRewardState(createEmptyRewardState());
    restoreRun(activeRun, {}, {});

    expect(getRunSessionStoreView().rewardState.choices).toEqual([]);
    expect(warn).toHaveBeenCalledWith("Pending reward could not be restored; reward choices were dropped", {
      rewardType: "card",
    });
    warn.mockRestore();
  });
});

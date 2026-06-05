import { describe, expect, it, beforeEach } from "vitest";
import { initializeActiveRunStores } from "@/features/alchemy/stores/run-transitions";
import { computeTalentPoints } from "@/lib/talents";
import type { BattleCard } from "@/lib/game-data";
import type { ActiveRunData } from "@/lib/active-run-session";
import {
  getNavigationStoreView,
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunDomainStore,
  setRunProgress,
} from "../../helpers/run-domain-store-test";

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
      runDeck: [{ id: "stab", title: "Stab", descriptionLines: [""], art: "", cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 4 }], uid: 1 }],
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
      currentScreen: null,
      destinationChoices: [],
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
      currentScreen: null,
      destinationChoices: [],
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

  it("restores navigation screen via initializeActiveRunStores", () => {
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
      currentScreen: "shop",
      destinationChoices: [],
    };
    initializeActiveRunStores(activeRun, {}, {});
    expect(getNavigationStoreView().screen).toBe("shop");
  });
});

describe("awardCardXP", () => {
  it("awards XP for card keywords to runTalentXP", () => {
    const card: BattleCard = {
      id: "fireball", title: "Fireball", descriptionLines: [""], art: "", cost: 3,
      effects: [{ kind: "damage", damageType: "burn", amount: 8 }],
    };
    getRunProgressStoreView().awardCardXP(card);
    expect(getRunProgressStoreView().runTalentXP.burn).toBeGreaterThan(0);
    expect(getRunProgressStoreView().talentXP.burn).toBeUndefined();
  });

  it("does nothing for card with no keywords", () => {
    const card: BattleCard = {
      id: "blank", title: "Blank", descriptionLines: [""], art: "", cost: 0, effects: [],
    };
    getRunProgressStoreView().awardCardXP(card);
    expect(getRunProgressStoreView().runTalentXP).toEqual({});
    expect(getRunProgressStoreView().talentXP).toEqual({});
  });

  it("accumulates XP across multiple cards", () => {
    const burnCard: BattleCard = {
      id: "fireball", title: "Fireball", descriptionLines: [""], art: "", cost: 3,
      effects: [{ kind: "damage", damageType: "burn", amount: 8 }],
    };
    const physCard: BattleCard = {
      id: "slash", title: "Slash", descriptionLines: [""], art: "", cost: 1,
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
  it("appends talentId to keyword's array", () => {
    getRunProgressStoreView().unlockTalent("burn", "burn-increased-damage");
    expect(getRunProgressStoreView().unlockedTalents.burn).toEqual(["burn-increased-damage"]);
  });

  it("preserves existing unlocks", () => {
    getRunProgressStoreView().unlockTalent("burn", "talent-1");
    getRunProgressStoreView().unlockTalent("burn", "talent-2");
    expect(getRunProgressStoreView().unlockedTalents.burn).toEqual(["talent-1", "talent-2"]);
  });

  it("ignores duplicate unlock of the same talentId", () => {
    getRunProgressStoreView().unlockTalent("burn", "talent-1");
    getRunProgressStoreView().unlockTalent("burn", "talent-1");
    expect(getRunProgressStoreView().unlockedTalents.burn).toEqual(["talent-1"]);
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
    getRunProgressStoreView().unlockTalent("burn", "talent-1");
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
    getRunProgressStoreView().unlockTalent("burn", "talent-1");
    setRunProgress({ runGold: 100, runPlayerHealth: 15 });
    getRunProgressStoreView().reset();
    expect(getRunProgressStoreView().talentXP.burn).toBe(50);
    expect(getRunProgressStoreView().unlockedTalents.burn).toEqual(["talent-1"]);
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

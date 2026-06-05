import { describe, expect, it, beforeEach } from "vitest";
import { useRunStore } from "@/features/alchemy/stores/run-store";
import { useRunSessionStore } from "@/features/alchemy/stores/run-session-store";
import { useNavigationStore } from "@/features/alchemy/shared/stores/navigation-store";
import { initializeActiveRunStores } from "@/features/alchemy/shared/stores/run-store-sync";
import { computeTalentPoints } from "@/lib/talents";
import type { BattleCard } from "@/lib/game-data";
import type { ActiveRunData } from "@/lib/active-run-session";

beforeEach(() => {
  useRunStore.setState(useRunStore.getInitialState());
  useRunSessionStore.setState(useRunSessionStore.getInitialState(), true);
  useNavigationStore.setState(useNavigationStore.getInitialState(), true);
});

describe("initial state", () => {
  it("defaults to knight character", () => {
    expect(useRunStore.getState().characterId).toBe("knight");
  });

  it("has a starting deck", () => {
    expect(useRunStore.getState().runDeck.length).toBeGreaterThan(0);
  });

  it("starts with zero gold", () => {
    expect(useRunStore.getState().runGold).toBe(0);
  });

  it("starts with full health", () => {
    expect(useRunStore.getState().runPlayerHealth).toBeGreaterThan(0);
    expect(useRunStore.getState().runMaxHealth).toBeGreaterThanOrEqual(useRunStore.getState().runPlayerHealth);
  });

  it("starts at act 1", () => {
    expect(useRunStore.getState().currentAct).toBe(1);
  });

  it("has empty talent XP", () => {
    expect(useRunStore.getState().talentXP).toEqual({});
    expect(useRunStore.getState().runTalentXP).toEqual({});
  });

  it("has empty unlocked talents", () => {
    expect(useRunStore.getState().unlockedTalents).toEqual({});
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
    useRunStore.getState().initialize(activeRun, { physical: 100 }, { physical: ["talent-1"] });
    expect(useRunStore.getState().characterId).toBe("rogue");
    expect(useRunStore.getState().runGold).toBe(50);
    expect(useRunStore.getState().runPlayerHealth).toBe(25);
    expect(useRunStore.getState().talentXP.physical).toBe(100);
    expect(useRunStore.getState().unlockedTalents.physical).toEqual(["talent-1"]);
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

    useRunStore.getState().initialize(activeRun, {}, {});

    expect(useRunStore.getState().completedDestinations).toEqual(["Normal Combat", "Corruption"]);
  });

  it("uses fallback character when no active run", () => {
    useRunStore.getState().initialize(null, {}, {}, "wizard");
    expect(useRunStore.getState().characterId).toBe("wizard");
  });

  it("uses knight as default fallback", () => {
    useRunStore.getState().initialize(null, {}, {});
    expect(useRunStore.getState().characterId).toBe("knight");
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
    expect(useNavigationStore.getState().screen).toBe("shop");
  });
});

describe("awardCardXP", () => {
  it("awards XP for card keywords to runTalentXP", () => {
    const card: BattleCard = {
      id: "fireball", title: "Fireball", descriptionLines: [""], art: "", cost: 3,
      effects: [{ kind: "damage", damageType: "burn", amount: 8 }],
    };
    useRunStore.getState().awardCardXP(card);
    expect(useRunStore.getState().runTalentXP.burn).toBeGreaterThan(0);
    expect(useRunStore.getState().talentXP.burn).toBeUndefined();
  });

  it("does nothing for card with no keywords", () => {
    const card: BattleCard = {
      id: "blank", title: "Blank", descriptionLines: [""], art: "", cost: 0, effects: [],
    };
    useRunStore.getState().awardCardXP(card);
    expect(useRunStore.getState().runTalentXP).toEqual({});
    expect(useRunStore.getState().talentXP).toEqual({});
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
    useRunStore.getState().awardCardXP(burnCard);
    useRunStore.getState().awardCardXP(physCard);
    expect(useRunStore.getState().runTalentXP.burn).toBeGreaterThan(0);
    expect(useRunStore.getState().runTalentXP.physical).toBeGreaterThan(0);
    expect(useRunStore.getState().talentXP.burn).toBeUndefined();
    expect(useRunStore.getState().talentXP.physical).toBeUndefined();
  });
});

describe("awardMysteryXP", () => {
  it("awards XP directly to a keyword runTalentXP", () => {
    useRunStore.getState().awardMysteryXP("burn", 50);
    expect(useRunStore.getState().runTalentXP.burn).toBe(50);
    expect(useRunStore.getState().talentXP.burn).toBeUndefined();
  });

  it("accumulates with existing runTalentXP", () => {
    useRunStore.getState().awardMysteryXP("burn", 30);
    useRunStore.getState().awardMysteryXP("burn", 20);
    expect(useRunStore.getState().runTalentXP.burn).toBe(50);
  });
});

describe("addRunGold", () => {
  it("adds gold with multiplier applied", () => {
    useRunStore.setState({ runGold: 10 });
    useRunStore.getState().addRunGold(5);
    const mult = 1; // knight, difficulty-1
    expect(useRunStore.getState().runGold).toBe(10 + Math.floor(5 * mult));
  });
});

describe("unlockTalent", () => {
  it("appends talentId to keyword's array", () => {
    useRunStore.getState().unlockTalent("burn", "burn-increased-damage");
    expect(useRunStore.getState().unlockedTalents.burn).toEqual(["burn-increased-damage"]);
  });

  it("preserves existing unlocks", () => {
    useRunStore.getState().unlockTalent("burn", "talent-1");
    useRunStore.getState().unlockTalent("burn", "talent-2");
    expect(useRunStore.getState().unlockedTalents.burn).toEqual(["talent-1", "talent-2"]);
  });

  it("ignores duplicate unlock of the same talentId", () => {
    useRunStore.getState().unlockTalent("burn", "talent-1");
    useRunStore.getState().unlockTalent("burn", "talent-1");
    expect(useRunStore.getState().unlockedTalents.burn).toEqual(["talent-1"]);
  });
});

describe("unlockAllTalents", () => {
  it("unlocks every talent from the pool", () => {
    useRunStore.getState().unlockAllTalents();
    const unlocked = useRunStore.getState().unlockedTalents;
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
    useRunStore.getState().unlockTalent("burn", "talent-1");
    useRunStore.getState().resetUnlockedTalents();
    expect(useRunStore.getState().unlockedTalents).toEqual({});
  });
});

describe("resetRunXP", () => {
  it("clears runTalentXP but preserves talentXP after finalize", () => {
    useRunStore.getState().awardMysteryXP("burn", 50);
    useRunStore.getState().finalizeRunXP();
    useRunStore.getState().resetRunXP();
    expect(useRunStore.getState().talentXP.burn).toBe(50);
    expect(useRunStore.getState().runTalentXP).toEqual({});
  });
});

describe("clearPermanentData", () => {
  it("clears talentXP, runTalentXP, and unlockedTalents", () => {
    useRunStore.getState().awardMysteryXP("burn", 50);
    useRunStore.getState().finalizeRunXP();
    useRunStore.getState().unlockTalent("burn", "talent-1");
    useRunStore.getState().clearPermanentData();
    expect(useRunStore.getState().talentXP).toEqual({});
    expect(useRunStore.getState().runTalentXP).toEqual({});
    expect(useRunStore.getState().unlockedTalents).toEqual({});
  });
});

describe("reset", () => {
  it("preserves talentXP and unlockedTalents while clearing run state", () => {
    useRunStore.getState().awardMysteryXP("burn", 50);
    useRunStore.getState().finalizeRunXP();
    useRunStore.getState().unlockTalent("burn", "talent-1");
    useRunStore.setState({ runGold: 100, runPlayerHealth: 15 });
    useRunStore.getState().reset();
    expect(useRunStore.getState().talentXP.burn).toBe(50);
    expect(useRunStore.getState().unlockedTalents.burn).toEqual(["talent-1"]);
    expect(useRunStore.getState().runTalentXP).toEqual({});
    expect(useRunStore.getState().runGold).toBe(0);
    expect(useRunStore.getState().runPlayerHealth).toBeGreaterThan(0);
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
    useRunStore.setState({ selectedDifficulty: "difficulty-1" });

    for (let i = 0; i < 10; i++) {
      useRunStore.getState().awardCardXP(card);
    }
    expect(useRunStore.getState().runTalentXP.physical).toBe(10);
    expect(computeTalentPoints(useRunStore.getState().talentXP.physical ?? 0)).toBe(0);

    useRunStore.getState().finalizeRunXP();

    expect(useRunStore.getState().runTalentXP).toEqual({});
    expect(useRunStore.getState().talentXP.physical).toBe(10);
    expect(computeTalentPoints(useRunStore.getState().talentXP.physical ?? 0)).toBe(1);
    expect(useRunSessionStore.getState().runEndTalentXP.physical).toBe(10);
  });
});

describe("finalizeRunXP", () => {
  it("applies no multiplier for difficulty-1", () => {
    useRunStore.setState({ selectedDifficulty: "difficulty-1" });
    useRunStore.getState().awardMysteryXP("burn", 10);
    useRunStore.getState().finalizeRunXP();
    expect(useRunStore.getState().talentXP.burn).toBe(10);
    expect(useRunStore.getState().runTalentXP).toEqual({});
    expect(useRunSessionStore.getState().runEndTalentXP.burn).toBe(10);
  });

  it("applies 1.3x multiplier for difficulty-2", () => {
    useRunStore.setState({ selectedDifficulty: "difficulty-2" });
    useRunStore.getState().awardMysteryXP("burn", 10);
    useRunStore.getState().finalizeRunXP();
    expect(useRunStore.getState().talentXP.burn).toBe(13);
    expect(useRunStore.getState().runTalentXP).toEqual({});
    expect(useRunSessionStore.getState().runEndTalentXP.burn).toBe(13);
  });

  it("applies 1.6x multiplier for difficulty-3", () => {
    useRunStore.setState({ selectedDifficulty: "difficulty-3" });
    useRunStore.getState().awardMysteryXP("burn", 10);
    useRunStore.getState().finalizeRunXP();
    expect(useRunStore.getState().talentXP.burn).toBe(16);
    expect(useRunStore.getState().runTalentXP).toEqual({});
  });

  it("is idempotent — second call does not double-count XP", () => {
    useRunStore.setState({ selectedDifficulty: "difficulty-2" });
    useRunStore.getState().awardMysteryXP("burn", 10);
    useRunStore.getState().finalizeRunXP();
    expect(useRunSessionStore.getState().runEndTalentXP.burn).toBe(13);
    useRunStore.getState().finalizeRunXP();
    expect(useRunStore.getState().talentXP.burn).toBe(13);
    expect(useRunStore.getState().runTalentXP).toEqual({});
    expect(useRunSessionStore.getState().runEndTalentXP).toEqual({});
  });

  it("clears runEndTalentXP snapshot when there is no run XP to merge", () => {
    useRunSessionStore.getState().setRunEndTalentXP({ burn: 99 });
    useRunStore.getState().finalizeRunXP();
    expect(useRunSessionStore.getState().runEndTalentXP).toEqual({});
  });
});

describe("hydrateFromSnapshot", () => {
  it("clears runTalentXP and runEndTalentXP when starting a fresh run", () => {
    useRunStore.getState().awardMysteryXP("burn", 5);
    useRunSessionStore.getState().setRunEndTalentXP({ burn: 5 });
    useRunStore.getState().hydrateFromSnapshot({
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
    expect(useRunStore.getState().runTalentXP).toEqual({});
    expect(useRunSessionStore.getState().runEndTalentXP).toEqual({});
  });
});

import { describe, expect, it, vi } from "vitest";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { createSessionPersistence } from "@/features/alchemy/shared/storage/session-persistence";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { resetHomestead } from "@/features/alchemy/shared/stores/meta-commands";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import { createPlaythroughController } from "@/app/playthrough/controller";
import { chooseMysteryOption } from "@/features/alchemy/run-loop/navigation/mystery-commands";
import { readActivityData } from "@/lib/active-run-session";
import { savedActivityFixture } from "../../../../fixtures/run-activity";

function battleSave() {
  const source = createGameSession({ runtimeInputs: { generateRunSeed: () => 123 } });
  const { flow } = createPlaythroughController(source);
  flow.goToScreen("game-mode-select");
  flow.beginCampaign();
  flow.handleCharacterSelect("knight");
  const save = createSessionPersistence(source).snapshot();
  void source.dispose();
  if (save.activeRun?.activity.kind !== "battle") throw new Error("Fixture did not enter battle");
  save.gold = 725;
  save.talentXP = { armor: 29 };
  save.discoveredCardIds = ["slash", "bash"];
  save.gearInventories.knight.push({ instanceId: "restored-gear", definitionId: "longsword-basic", affixes: [] });
  return save;
}

describe("session save restoration", () => {
  it("recomputes Homestead effects without regranting starting Thorns or multiplying saved loot", async () => {
    const save = battleSave();
    save.constructedBuildings = { "hunters-lodge": 4, "wishing-well": 4 };
    save.plantedFarms = { orchard: 4, "wheat-field": 4, "crystal-garden": 4 };
    save.materialInventory.gems = 14;
    save.activeRun!.runMaterialsEarned.gems = 14;
    if (save.activeRun?.activity.kind !== "battle") throw new Error("Battle was lost");
    save.activeRun.activity.data.battleState.playerStatuses.thorns = 7;
    const session = createGameSession();
    const persistence = createSessionPersistence(session);
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        persistence.restore(attempt === 0 ? save : persistence.snapshot());
        const restored = persistence.snapshot();
        expect(restored.activeRun?.rng).toEqual(save.activeRun.rng);
        expect(restored.materialInventory.gems).toBe(14);
        expect(restored.activeRun?.runMaterialsEarned.gems).toBe(14);
        if (restored.activeRun?.activity.kind !== "battle") throw new Error("Battle was lost");
        expect(restored.activeRun.activity.data.battleState.playerStatuses.thorns).toBe(7);
        expect(readGameplayState(session).runProfile.effects).toMatchObject({
          startThorns: 4,
          healthRestorePerCombat: 4,
          freezeDamagePerMana: 100,
          gemFindBonus: 0.4,
          goldFindBonus: 0.4,
          foodFindBonus: 0.8,
          hideFindBonus: 0.4,
        });
        expect(restored.activeRun.activity.data.battleState.talentEffects).toMatchObject({
          startThorns: 4,
          healthRestorePerCombat: 4,
          freezeDamagePerMana: 100,
          gemFindBonus: 0.4,
          goldFindBonus: 0.4,
        });
      }
    } finally {
      await session.dispose();
    }
  });

  it("resets Homestead atomically and resumes without refunding or replaying combat grants", async () => {
    const save = battleSave();
    save.discoveredCardIds.push("wolf-companion");
    save.constructedBuildings = { "blacksmiths-forge": 1 };
    save.plantedFarms = { "chicken-coop": 4, orchard: 2 };
    save.completedResearch = { "leyline-energy": 1 };
    save.bondedCompanions.wolf = 1;
    save.materialInventory.iron = 7;
    save.activeRun!.runMaterialsEarned.iron = 5;
    if (save.activeRun?.activity.kind !== "battle") throw new Error("Battle was lost");
    save.activeRun.activity.data.battleState.playerStatuses.thorns = 7;
    const session = createGameSession();
    const other = createGameSession();
    const persistence = createSessionPersistence(session);
    try {
      persistence.restore(save);
      dispatchGameplayCommand(
        (draft) => {
          draft.run.activeRun.runPlayerHealth = draft.run.activeRun.runMaxHealth;
          if (draft.session.activity.kind === "battle") {
            draft.session.activity.data.battleState.playerHealth =
              draft.session.activity.data.battleState.playerMaxHealth;
          }
          return acceptCommand();
        },
        undefined,
        session,
      );
      const before = persistence.snapshot();
      const state = readGameplayState(session);
      const commits: number[] = [];
      const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision), session);
      expect(resetHomestead(session)).toBe(true);
      unsubscribe();
      expect(commits).toEqual([state.revision + 1]);
      const reset = persistence.snapshot();
      expect(reset.materialInventory.iron).toBe(18);
      expect(reset.materialInventory.stone).toBe(4);
      expect(reset.materialInventory.food).toBeGreaterThan(before.materialInventory.food);
      expect(reset.gold).toBe(before.gold);
      expect(reset.discoveredCardIds).toEqual(before.discoveredCardIds);
      expect(reset.activeRun?.runMaterialsEarned).toEqual(before.activeRun?.runMaterialsEarned);
      expect(reset.activeRun?.rng).toEqual(before.activeRun?.rng);
      if (reset.activeRun?.activity.kind !== "battle" || before.activeRun?.activity.kind !== "battle")
        throw new Error("Battle was lost");
      const battle = reset.activeRun.activity.data.battleState;
      expect(battle.playerStatuses.thorns).toBe(7);
      expect(battle.talentEffects.startThorns).toBe(0);
      expect(battle.talentEffects.homesteadFreeManaChance).toBe(0);
      expect(battle.talentEffects.companionBondLevels.wolf).toBe(0);
      expect(battle.playerMaxHealth).toBe(before.activeRun.activity.data.battleState.playerMaxHealth - 20);
      expect(battle.playerHealth).toBe(battle.playerMaxHealth);
      expect(reset.activeRun.runPlayerHealth).toBe(reset.activeRun.runMaxHealth);
      expect(readGameplayState(other).revision).toBe(0);
      expect(resetHomestead(session)).toBe(false);
      expect(readGameplayState(session).revision).toBe(state.revision + 1);
      persistence.restore(reset);
      expect(persistence.snapshot().materialInventory).toEqual(reset.materialInventory);
      expect(readGameplayState(session).runProfile.effects.startThorns).toBe(0);
    } finally {
      await session.dispose();
      await other.dispose();
    }
  });

  it("saves actual Mystery payouts for the summary and rejects repeated claims after resume", async () => {
    const save = battleSave();
    save.constructedBuildings = { "wishing-well": 4 };
    save.activeRun!.activity = savedActivityFixture("mystery", {
      event: {
        id: "treasure",
        title: "Treasure",
        art: "",
        narrative: "Treasure",
        choices: [
          {
            label: "Take",
            effects: [
              { kind: "gainGold", amount: 10 },
              { kind: "gainMaterial", material: "gems", amount: 10 },
            ],
          },
        ],
      },
      chosenChoice: null,
      cardChoices: null,
      grantedTrinketIds: [],
      grantedGear: [],
      chosenCardId: null,
    });
    const session = createGameSession();
    const persistence = createSessionPersistence(session);
    try {
      persistence.restore(save);
      const choice = readActivityData(readGameplayState(session).session.activity, "mystery").mysteryEvent!.choices[0]!;
      expect(chooseMysteryOption(choice, session)).toEqual(["gain"]);
      const claimed = persistence.snapshot();
      expect(claimed.gold).toBe(save.gold + 14);
      expect(claimed.materialInventory.gems).toBe(save.materialInventory.gems + 10);
      expect(
        readActivityData(readGameplayState(session).session.activity, "mystery").mysteryChosenChoice?.effects,
      ).toEqual([
        { kind: "gainGold", amount: 14 },
        { kind: "gainMaterial", material: "gems", amount: 10 },
      ]);
      expect(chooseMysteryOption(choice, session)).toBeNull();
      persistence.restore(claimed);
      const restored = readActivityData(readGameplayState(session).session.activity, "mystery");
      expect(restored.mysteryChosenChoice?.effects).toEqual([
        { kind: "gainGold", amount: 14 },
        { kind: "gainMaterial", material: "gems", amount: 10 },
      ]);
      expect(chooseMysteryOption(restored.mysteryEvent!.choices[0]!, session)).toBeNull();
      expect(persistence.snapshot().gold).toBe(claimed.gold);
      expect(persistence.snapshot().materialInventory).toEqual(claimed.materialInventory);
    } finally {
      await session.dispose();
    }
  });

  it("publishes permanent progression and its restored battle in one revision to save subscribers", async () => {
    const save = battleSave();
    const session = createGameSession();
    const persistence = createSessionPersistence(session);
    const before = readGameplayState(session);
    const snapshots: Array<ReturnType<typeof persistence.snapshot>> = [];
    const revisions: number[] = [];
    persistence.subscribe(() => snapshots.push(persistence.snapshot()));
    subscribeRunSessionCommits((revision) => revisions.push(revision), session);
    try {
      expect(persistence.restore(save)).toBe(true);
      expect(revisions).toEqual([before.revision + 1]);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toMatchObject({
        gold: 725,
        talentXP: { armor: 29 },
        discoveredCardIds: ["slash", "bash"],
        gearInventories: { knight: [{ instanceId: "restored-gear" }] },
        activeRun: { rng: save.activeRun!.rng, activity: { kind: "battle" } },
      });
      expect(snapshots[0]!.activeRun!.activity).toEqual(persistence.snapshot().activeRun!.activity);
    } finally {
      await session.dispose();
    }
  });

  it("rolls back all progression and leaves settings unchanged when run initialization fails", async () => {
    let fail = false;
    const session = createGameSession({
      runtimeInputs: {
        generateRunSeed: () => {
          if (fail) throw new Error("Seed source failed");
          return 123;
        },
      },
    });
    const persistence = createSessionPersistence(session);
    const before = readGameplayState(session);
    const snapshot = persistence.snapshot();
    const listener = vi.fn();
    persistence.subscribe(listener);
    const save = createDefaultSaveData();
    save.gold = 900;
    save.musicVolume = 7;
    save.discoveredCardIds = ["bash"];
    fail = true;
    try {
      expect(() => persistence.restore(save)).toThrow("Seed source failed");
      expect(readGameplayState(session)).toBe(before);
      expect(persistence.snapshot()).toEqual(snapshot);
      expect(listener).not.toHaveBeenCalled();
    } finally {
      await session.dispose();
    }
  });

  it("keeps an initialized battle while atomically hydrating progression on repeated bootstrap", async () => {
    const save = battleSave();
    const session = createGameSession({ initialSave: save });
    const persistence = createSessionPersistence(session);
    const before = persistence.snapshot().activeRun;
    const replacement = createDefaultSaveData();
    replacement.gold = 88;
    replacement.talentXP = { armor: 41 };
    const revisions: number[] = [];
    subscribeRunSessionCommits((revision) => revisions.push(revision), session);
    try {
      expect(persistence.restore(replacement, { preserveActiveRunIfInitialized: true })).toBe(false);
      const restored = persistence.snapshot();
      expect(revisions).toHaveLength(1);
      expect(restored.gold).toBe(88);
      expect(restored.talentXP).toEqual({ armor: 41 });
      expect(restored.activeRun?.rng).toEqual(before?.rng);
      expect(restored.activeRun?.activity.kind).toBe("battle");
      if (restored.activeRun?.activity.kind !== "battle") throw new Error("Battle was lost");
      expect(restored.activeRun.activity.data.battleState.gold).toBe(88);
    } finally {
      await session.dispose();
    }
  });

  it("settles an incompatible battle inside restore before teardown feedback or a save can observe it", async () => {
    const save = battleSave();
    save.activeRun!.runTalentXP = { armor: 5 };
    const stopAllSfx = vi.fn();
    const session = createGameSession({ feedback: { stopAllSfx } });
    const persistence = createSessionPersistence(session);
    const activities: Array<string | null> = [];
    persistence.subscribe(() => activities.push(persistence.snapshot().activeRun?.activity.kind ?? null));
    try {
      expect(persistence.restore(save, { restoreActions: ["abandon-active-run"] })).toBe(true);
      expect(activities).toEqual([null]);
      expect(persistence.snapshot().activeRun).toBeNull();
      expect(persistence.snapshot().talentXP.armor).toBeGreaterThan(29);
      expect(readGameplayState(session).run.navigation.screen).toBe("game-over");
      expect(stopAllSfx).toHaveBeenCalledOnce();
    } finally {
      await session.dispose();
    }
  });
});

it("owns the complete snapshot without sharing nested battle or progression state", async () => {
  const session = createGameSession({ initialSave: battleSave() });
  const persistence = createSessionPersistence(session);
  try {
    const save = persistence.snapshot();
    const before = persistence.snapshot();
    if (save.activeRun?.activity.kind !== "battle") throw new Error("Battle was lost");
    save.activeRun.runDeck.length = 0;
    save.activeRun.activity.data.battleState.playerStatuses.burn = 999;
    save.activeRun.activity.data.battleState.hand.length = 0;
    save.gearInventories.knight.length = 0;
    expect(persistence.snapshot()).toEqual(before);
  } finally {
    await session.dispose();
  }
});

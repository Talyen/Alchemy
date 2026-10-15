import { createSaveBackend } from "../../../../helpers/save-backend";
import { describe, expect, it, vi } from "vitest";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { evaluateSaveCandidates } from "@/features/alchemy/shared/storage/save-candidates";
import { createSessionPersistence } from "@/features/alchemy/shared/storage/session-persistence";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  encodePersistenceFields,
  hydrateAlchemyPersistenceFields,
} from "@/features/alchemy/shared/storage/persistence";
import { resetHomestead } from "@/features/alchemy/shared/stores/meta-commands";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import { setGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { sessionRuntime } from "@/features/alchemy/shared/stores/session-runtime";
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
  it("resumes a battle with a retired fixed ratio without replaying draws or losing progress", async () => {
    const save = battleSave();
    if (save.activeRun?.activity.kind !== "battle") throw new Error("Battle was lost");
    save.activeRun.activity.data.battleState.gold = save.gold;
    const loaded = evaluateSaveCandidates([JSON.stringify({ ...save, selectedAspectRatio: "21:9" })]);
    expect(loaded.status.kind).toBe("ok");
    await using session = createGameSession({ initialSave: loaded.data });
    const persistence = createSessionPersistence(session);

    const before = persistence.snapshot();
    const { flow } = createPlaythroughController(session);
    flow.goToScreen("menu");
    flow.beginCampaign();
    const resumed = persistence.snapshot();
    expect(readGameplayState(session).run.navigation.screen).toBe("battle");
    expect(resumed.activeRun?.activity.kind).toBe("battle");
    expect(resumed.activeRun?.activity).toEqual(before.activeRun?.activity);
    expect(resumed.activeRun?.rng).toEqual(save.activeRun.rng);
    expect(resumed).toMatchObject({
      gold: 725,
      talentXP: { armor: 29 },
      discoveredCardIds: ["slash", "bash"],
      gearInventories: { knight: [{ instanceId: "restored-gear" }] },
    });
    expect(resumed).not.toHaveProperty("selectedAspectRatio");
    expect(sessionRuntime(session).settings.getState()).not.toHaveProperty("selectedAspectRatio");
  });

  it("recomputes Homestead effects without regranting starting Thorns or multiplying saved loot", async () => {
    const save = battleSave();
    save.constructedBuildings = { ...save.constructedBuildings, "hunters-lodge": 4, "wishing-well": 4 };
    save.plantedFarms = { ...save.plantedFarms, orchard: 4, "wheat-field": 4, "crystal-garden": 4 };
    save.materialInventory.gems = 14;
    save.activeRun!.runMaterialsEarned.gems = 14;
    if (save.activeRun?.activity.kind !== "battle") throw new Error("Battle was lost");
    save.activeRun.activity.data.battleState.playerStatuses.thorns = 7;
    await using session = createGameSession();
    const persistence = createSessionPersistence(session);

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
  });

  it("resets Homestead atomically and resumes without refunding or replaying combat grants", async () => {
    const save = battleSave();
    save.discoveredCardIds.push("wolf-companion");
    save.constructedBuildings = { ...save.constructedBuildings, "blacksmiths-forge": 1 };
    save.plantedFarms = { ...save.plantedFarms, "chicken-coop": 4, orchard: 2 };
    save.completedResearch = { ...save.completedResearch, "leyline-energy": 1 };
    save.bondedCompanions.wolf = 1;
    save.materialInventory.iron = 7;
    save.activeRun!.runMaterialsEarned.iron = 5;
    if (save.activeRun?.activity.kind !== "battle") throw new Error("Battle was lost");
    save.activeRun.activity.data.battleState.playerStatuses.thorns = 7;
    await using session = createGameSession();
    await using other = createGameSession();
    const persistence = createSessionPersistence(session);

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
  });

  it("saves actual Mystery payouts for the summary and rejects repeated claims after resume", async () => {
    const save = battleSave();
    save.constructedBuildings = { ...save.constructedBuildings, "wishing-well": 4 };
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
    await using session = createGameSession();
    const persistence = createSessionPersistence(session);

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
  });

  it("publishes progression, battle, settings, and save protection together to every save observer", async () => {
    const save = battleSave();
    save.musicVolume = 7;
    save.brightness = 63;
    await using session = createGameSession();
    const persistence = createSessionPersistence(session);
    persistence.trackProgress(() => {});
    dispatchGameplayCommand((draft) => acceptCommand(setGold(draft, 30)), undefined, session);
    const before = readGameplayState(session);
    const snapshots: Array<ReturnType<typeof persistence.snapshot>> = [];
    const progressSnapshots: Array<ReturnType<typeof persistence.snapshot>> = [];
    const revisions: number[] = [];
    persistence.subscribe(() => snapshots.push(persistence.snapshot()));
    persistence.subscribeProgress(() => progressSnapshots.push(persistence.snapshot()));
    subscribeRunSessionCommits((revision) => revisions.push(revision), session);

    expect(persistence.restore(save)).toBe(true);
    expect(revisions).toEqual([before.revision + 1]);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      gold: 725,
      musicVolume: 7,
      brightness: 63,
      talentXP: { armor: 29 },
      discoveredCardIds: ["slash", "bash"],
      gearInventories: { knight: [{ instanceId: "restored-gear" }] },
      activeRun: { rng: save.activeRun!.rng, activity: { kind: "battle" } },
    });
    expect(snapshots[0]!.activeRun!.activity).toEqual(persistence.snapshot().activeRun!.activity);
    expect(progressSnapshots).toEqual(snapshots);
    expect(persistence.readProgress()).toEqual({ kind: "saving", revision: before.revision + 1 });
  });

  it.each(["run initialization", "settings preparation"] as const)(
    "preserves pending progress, completion feedback, and settings when %s fails",
    async (failure) => {
      let fail = false;
      await using session = createGameSession({
        saveBackend: createSaveBackend(),
        runtimeInputs: {
          generateRunSeed: () => {
            if (fail) throw new Error("Seed source failed");
            return 123;
          },
        },
      });
      const persistence = createSessionPersistence(session);
      persistence.trackProgress(() => {});
      dispatchGameplayCommand((draft) => acceptCommand(setGold(draft, 30)), undefined, session);
      const completed = vi.fn();
      persistence.afterProgressSaved(completed);
      const progress = persistence.readProgress();
      const before = readGameplayState(session);
      const snapshot = persistence.snapshot();
      const listener = vi.fn();
      persistence.subscribe(listener);
      persistence.subscribeProgress(listener);
      const save = createDefaultSaveData();
      save.gold = 900;
      save.musicVolume = 7;
      save.discoveredCardIds = ["bash"];
      if (failure === "run initialization") fail = true;
      else
        Object.defineProperty(save, "musicVolume", {
          get: () => {
            throw new Error("Settings preparation failed");
          },
        });

      expect(() => persistence.restore(save)).toThrow(
        failure === "run initialization" ? "Seed source failed" : "Settings preparation failed",
      );
      expect(readGameplayState(session)).toBe(before);
      expect(persistence.snapshot()).toEqual(snapshot);
      expect(persistence.readProgress()).toBe(progress);
      expect(listener).not.toHaveBeenCalled();
      expect(completed).not.toHaveBeenCalled();
      expect(await persistence.write(snapshot)).toBe("saved");
      expect(completed).toHaveBeenCalledOnce();
    },
  );

  it("retains complete restored state and notifies autosave even when a settings observer throws", async () => {
    const save = battleSave();
    save.musicVolume = 7;
    await using session = createGameSession();
    const persistence = createSessionPersistence(session);
    using logged = vi.spyOn(console, "error").mockImplementation(() => {});
    sessionRuntime(session).settings.subscribe(() => {
      throw new Error("Audio settings adapter failed");
    });
    const snapshots: Array<ReturnType<typeof persistence.snapshot>> = [];
    persistence.subscribe(() => snapshots.push(persistence.snapshot()));

    expect(() => persistence.restore(save)).not.toThrow();
    expect(snapshots).toEqual([persistence.snapshot()]);
    expect(snapshots[0]).toMatchObject({
      gold: 725,
      musicVolume: 7,
      activeRun: { rng: save.activeRun!.rng, activity: { kind: "battle" } },
    });
    expect(logged).toHaveBeenCalled();
  });

  it("keeps an initialized battle while atomically hydrating progression on repeated bootstrap", async () => {
    const save = battleSave();
    await using session = createGameSession({ initialSave: save });
    const persistence = createSessionPersistence(session);
    const before = persistence.snapshot().activeRun;
    const replacement = createDefaultSaveData();
    replacement.gold = 88;
    replacement.talentXP = { armor: 41 };
    const revisions: number[] = [];
    subscribeRunSessionCommits((revision) => revisions.push(revision), session);

    expect(persistence.restore(replacement, { preserveActiveRunIfInitialized: true })).toBe(false);
    const restored = persistence.snapshot();
    expect(revisions).toHaveLength(1);
    expect(restored.gold).toBe(88);
    expect(restored.talentXP).toEqual({ armor: 41 });
    expect(restored.activeRun?.rng).toEqual(before?.rng);
    expect(restored.activeRun?.activity.kind).toBe("battle");
    if (restored.activeRun?.activity.kind !== "battle") throw new Error("Battle was lost");
    expect(restored.activeRun.activity.data.battleState.gold).toBe(88);
  });

  it("settles an incompatible battle inside restore before teardown feedback or a save can observe it", async () => {
    const save = battleSave();
    save.activeRun!.runTalentXP = { armor: 5 };
    const stopAllSfx = vi.fn();
    await using session = createGameSession({ feedback: { stopAllSfx } });
    const persistence = createSessionPersistence(session);
    const activities: Array<string | null> = [];
    persistence.subscribe(() => activities.push(persistence.snapshot().activeRun?.activity.kind ?? null));

    expect(persistence.restore(save, { restoreActions: ["abandon-active-run"] })).toBe(true);
    expect(activities).toEqual([null]);
    expect(persistence.snapshot().activeRun).toBeNull();
    expect(persistence.snapshot().talentXP.armor).toBeGreaterThan(29);
    expect(readGameplayState(session).run.navigation.screen).toBe("game-over");
    expect(stopAllSfx).toHaveBeenCalledOnce();
  });
});

it("owns the complete snapshot without sharing nested battle or progression state", async () => {
  await using session = createGameSession({ initialSave: battleSave() });
  const persistence = createSessionPersistence(session);

  const save = persistence.snapshot();
  const before = persistence.snapshot();
  if (save.activeRun?.activity.kind !== "battle") throw new Error("Battle was lost");
  save.activeRun.runDeck.length = 0;
  save.activeRun.activity.data.battleState.playerStatuses.burn = 999;
  save.activeRun.activity.data.battleState.hand.length = 0;
  save.gearInventories.knight.length = 0;
  const run = snapshotRun(session);
  run.runDeck.length = 0;
  if (run.activity.kind !== "battle") throw new Error("Battle was lost");
  run.activity.data.battleState.playerStatuses.burn = 1000;
  const fields = encodePersistenceFields(session);
  fields.materialInventory.gems = 1000;
  fields.talentXP.armor = 1000;
  expect(persistence.snapshot()).toEqual(before);
});

it.each(["session", "run", "profile"] as const)(
  "owns %s restoration input without freezing the caller's save",
  async (kind) => {
    const save = battleSave();
    await using session = createGameSession();
    const persistence = createSessionPersistence(session);

    if (kind === "session") persistence.restore(save);
    else if (kind === "run") restoreRun(save.activeRun, save.talentXP, save.unlockedTalents, session);
    else hydrateAlchemyPersistenceFields(save, session);
    const before = persistence.snapshot();
    expect(Object.isFrozen(save.talentXP)).toBe(false);
    expect(Object.isFrozen(save.materialInventory)).toBe(false);
    expect(Object.isFrozen(save.activeRun!.rng)).toBe(false);
    if (save.activeRun?.activity.kind !== "battle") throw new Error("Battle was lost");
    expect(Object.isFrozen(save.activeRun.activity.data.battleState.playerStatuses)).toBe(false);
    save.talentXP.armor = 999;
    save.materialInventory.gems = 999;
    save.activeRun.rng.counters.world = 999;
    save.activeRun.activity.data.battleState.playerStatuses.burn = 999;
    expect(persistence.snapshot()).toEqual(before);
  },
);

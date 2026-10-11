import { describe, expect, it, vi } from "vitest";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage/defaults";
import { createSessionPersistence } from "@/features/alchemy/shared/storage/session-persistence";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import { createPlaythroughController } from "@/app/playthrough/controller";

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

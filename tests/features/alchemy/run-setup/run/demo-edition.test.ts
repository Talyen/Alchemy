import "../../../../helpers/mock-audio";

import { beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => vi.stubGlobal("__ALCHEMY_EDITION__", "demo"));
import { isEditionRunAvailable } from "@/lib/game-edition";
import { createNewRunInitialization } from "@/features/alchemy/run-setup/run/new-run-initialization";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { completeActInDraft } from "@/features/alchemy/run-loop/run/progression-commands";
import { readActiveRun, readHasActiveRun } from "@/features/alchemy/shared/stores/session/run-reads";
import { readProfileStore } from "@/features/alchemy/shared/stores/session/profile-store";
import { restoreRun } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import {
  completeRunDefeat,
  completeRunVictory,
  abandonCurrentRun,
} from "@/features/alchemy/run-loop/run/run-end-commands";
import { snapshotRun } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { resetAllTestStores } from "../../../../helpers/run-domain-store-test";
import {
  acceptCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import { defaultGameSession } from "@/app/application-session";
import { SAVE_KEY } from "@/lib/game-constants";
import { SaveStorage } from "@/features/alchemy/shared/storage/save-storage";
import { createSaveBackend } from "../../../../helpers/save-backend";
import { saveEnvelopeFixture } from "../../../../fixtures/saves";

function deps() {
  return {
    navigateTo: vi.fn(),
    resumeTo: vi.fn(),
    presentBattleStart: vi.fn(),
    onResumeWildwood: vi.fn(),
  };
}
beforeEach(resetAllTestStores);
describe("demo command boundaries", () => {
  it("rejects excluded characters, modes, difficulty and locked heroes without granting starting Gold", () => {
    const start = createNewRunInitialization(deps(), defaultGameSession);
    expect(() => start.initializeRunForDifficulty("wizard", "difficulty-1")).toThrow("unavailable");
    expect(() => start.initializeRunForDifficulty("rogue", "difficulty-1")).toThrow("unavailable");
    expect(() => start.initializeRunForDifficulty("knight", "difficulty-2")).toThrow("unavailable");
    expect(() => start.initializeLabyrinthRun("knight")).toThrow("unavailable");
    expect(readHasActiveRun(defaultGameSession)).toBe(false);
    expect(readActiveRun(defaultGameSession).currentAct).toBe(1);
  });
  it("blocks stale mode and character callbacks", () => {
    const navigation = deps();
    const flow = createContentSystemNavigation(navigation, defaultGameSession);
    flow.beginLabyrinth();
    flow.beginWildwood();
    expect(navigation.navigateTo).not.toHaveBeenCalled();
    flow.beginCampaign();
    flow.handleCharacterSelect("wizard");
    expect(navigation.presentBattleStart).not.toHaveBeenCalled();
  });
  it("ends Act 1 without recording a full Campaign win", () => {
    createNewRunInitialization(deps(), defaultGameSession).initializeRunForDifficulty("knight", "difficulty-1");
    expect(
      dispatchRunSessionCommand((draft) => acceptCommand(completeActInDraft(draft)), undefined, defaultGameSession),
    ).toBe(true);
    expect(readActiveRun(defaultGameSession).currentAct).toBe(1);
    expect(readProfileStore(defaultGameSession).completedDifficulties.knight).toEqual([]);
    completeRunVictory(defaultGameSession);
    expect(readHasActiveRun(defaultGameSession)).toBe(false);
    expect(readProfileStore(defaultGameSession).finishedRunCharacters).toEqual(["knight"]);
    completeRunVictory(defaultGameSession);
    expect(readProfileStore(defaultGameSession).finishedRunCharacters).toEqual(["knight"]);
  });
  it.each([completeRunVictory, completeRunDefeat, abandonCurrentRun])(
    "keeps earned character unlocks after every ending",
    (endRun) => {
      const start = createNewRunInitialization(deps(), defaultGameSession);
      start.initializeRunForDifficulty("knight", "difficulty-1");
      endRun(defaultGameSession);
      start.initializeRunForDifficulty("rogue", "difficulty-1");
      endRun(defaultGameSession);
      start.initializeRunForDifficulty("ranger", "difficulty-1");
      expect(readActiveRun(defaultGameSession).characterId).toBe("ranger");
      expect(readProfileStore(defaultGameSession).finishedRunCharacters).toEqual(["knight", "rogue"]);
    },
  );
  it("preserves valid resume and drops excluded activity without settlement", () => {
    createNewRunInitialization(deps(), defaultGameSession).initializeRunForDifficulty("knight", "difficulty-1");
    const snapshot = snapshotRun(defaultGameSession);
    expect(isEditionRunAvailable(snapshot)).toBe(true);
    resetAllTestStores();
    restoreRun(snapshot, {}, {}, defaultGameSession);
    expect(readHasActiveRun(defaultGameSession)).toBe(true);
    expect(snapshotRun(defaultGameSession).rng).toEqual(snapshot.rng);
    resetAllTestStores();
    restoreRun({ ...snapshot, currentAct: 2 }, {}, {}, defaultGameSession);
    expect(readHasActiveRun(defaultGameSession)).toBe(false);
    expect(readProfileStore(defaultGameSession).finishedRunCharacters).toEqual([]);
    expect(isEditionRunAvailable({ ...snapshot, contentSystemType: "labyrinth" })).toBe(false);
  });
  it("drops an incompatible saved run without resetting the permanent profile", async () => {
    createNewRunInitialization(deps(), defaultGameSession).initializeRunForDifficulty("knight", "difficulty-1");
    const save = saveEnvelopeFixture({
      gold: 777,
      finishedRunCharacters: ["knight"],
      discoveredCardIds: ["slash"],
      activeRun: { ...snapshotRun(defaultGameSession), currentAct: 2 },
    });
    const storage = new SaveStorage(
      createSaveBackend({
        readCandidates: async (key) => ({
          ok: true,
          candidates: key === SAVE_KEY ? [JSON.stringify(save)] : [],
        }),
      }),
    );
    const loaded = await storage.load();
    expect(loaded.data.activeRun).toBeNull();
    expect(loaded.data).toMatchObject({
      gold: 777,
      finishedRunCharacters: ["knight"],
      discoveredCardIds: ["slash"],
    });
  });
});

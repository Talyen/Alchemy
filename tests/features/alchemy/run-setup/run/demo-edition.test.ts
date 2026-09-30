import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => vi.stubGlobal("__ALCHEMY_EDITION__", "demo"));
import { isEditionRunAvailable } from "@/lib/game-edition";
import { createNewRunInitialization } from "@/features/alchemy/run-setup/run/new-run-initialization";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { createProgressionCommands } from "@/features/alchemy/run-loop/run/progression-commands";
import { readActiveRun, readHasActiveRun } from "@/features/alchemy/shared/stores/run-reads";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { restoreRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  completeRunDefeat,
  completeRunVictory,
  abandonCurrentRun,
} from "@/features/alchemy/run-loop/run/run-end-commands";
import { snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { DESTINATIONS } from "@/lib/routing";
import { resetAllTestStores } from "../../../../helpers/run-domain-store-test";

function deps() {
  return {
    navigateTo: vi.fn(),
    resumeTo: vi.fn(),
    onStartBattle: vi.fn(),
    getAvailableDestinations: () => [DESTINATIONS.NORMAL_COMBAT],
    onResumeWildwood: vi.fn(),
  };
}
beforeEach(resetAllTestStores);
describe("demo command boundaries", () => {
  it("rejects excluded characters, modes, difficulty and locked heroes without granting starting Gold", () => {
    const start = createNewRunInitialization(deps());
    expect(() => start.initializeRunForDifficulty("wizard", "difficulty-1")).toThrow("unavailable");
    expect(() => start.initializeRunForDifficulty("rogue", "difficulty-1")).toThrow("unavailable");
    expect(() => start.initializeRunForDifficulty("knight", "difficulty-2")).toThrow("unavailable");
    expect(() => start.initializeLabyrinthRun("knight")).toThrow("unavailable");
    expect(readHasActiveRun()).toBe(false);
    expect(readActiveRun().currentAct).toBe(1);
  });
  it("blocks stale mode and character callbacks", () => {
    const navigation = deps();
    const flow = createContentSystemNavigation(navigation);
    flow.beginLabyrinth();
    flow.beginWildwood();
    expect(navigation.navigateTo).not.toHaveBeenCalled();
    flow.beginCampaign();
    flow.handleCharacterSelect("wizard");
    expect(navigation.onStartBattle).not.toHaveBeenCalled();
  });
  it("ends Act 1 without recording a full Campaign win", () => {
    createNewRunInitialization(deps()).initializeRunForDifficulty("knight", "difficulty-1");
    expect(createProgressionCommands(deps().getAvailableDestinations).completeAct()).toBe(true);
    expect(readActiveRun().currentAct).toBe(1);
    expect(readProfileStore().completedDifficulties.knight).toEqual([]);
    completeRunVictory();
    expect(readHasActiveRun()).toBe(false);
    expect(readProfileStore().finishedRunCharacters).toEqual(["knight"]);
    completeRunVictory();
    expect(readProfileStore().finishedRunCharacters).toEqual(["knight"]);
  });
  it.each([completeRunVictory, completeRunDefeat, abandonCurrentRun])(
    "keeps earned character unlocks after every ending",
    (endRun) => {
      const start = createNewRunInitialization(deps());
      start.initializeRunForDifficulty("knight", "difficulty-1");
      endRun();
      start.initializeRunForDifficulty("rogue", "difficulty-1");
      endRun();
      start.initializeRunForDifficulty("ranger", "difficulty-1");
      expect(readActiveRun().characterId).toBe("ranger");
      expect(readProfileStore().finishedRunCharacters).toEqual(["knight", "rogue"]);
    },
  );
  it("preserves valid resume and drops excluded activity without settlement", () => {
    createNewRunInitialization(deps()).initializeRunForDifficulty("knight", "difficulty-1");
    const snapshot = snapshotRun();
    expect(isEditionRunAvailable(snapshot)).toBe(true);
    resetAllTestStores();
    restoreRun(snapshot, {}, {});
    expect(readHasActiveRun()).toBe(true);
    expect(snapshotRun().rng).toEqual(snapshot.rng);
    resetAllTestStores();
    restoreRun({ ...snapshot, currentAct: 2 }, {}, {});
    expect(readHasActiveRun()).toBe(false);
    expect(readProfileStore().finishedRunCharacters).toEqual([]);
    expect(isEditionRunAvailable({ ...snapshot, contentSystemType: "labyrinth" })).toBe(false);
  });
});

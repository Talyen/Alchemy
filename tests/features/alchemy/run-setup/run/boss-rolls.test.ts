import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNewRunInitialization } from "@/features/alchemy/run-setup/run/new-run-initialization";
import { createRunResumeNavigation } from "@/features/alchemy/run-setup/run/run-resume-navigation";
import { createProgressionCommands } from "@/features/alchemy/run-loop/run/progression-commands";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { DEFAULT_CAMPAIGN_DIFFICULTY_ID } from "@/lib/game-constants";
import { DESTINATIONS, type Screen } from "@/lib/routing";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/session/gameplay-command";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/session/run-reads";
import { setRewardState, setScreen } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import {
  mutateGameplayForTest,
  setRunProgress,
  resetAllTestStores,
  setRunSession,
} from "../../../../helpers/run-domain-store-test";
import { emptyAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";
import { createRunRngState } from "@/lib/rng";
import { defaultGameSession } from "@/app/application-session";

beforeEach(resetAllTestStores);

function navigationDeps() {
  return {
    navigateTo: vi.fn(),
    resumeTo: (_screen: Screen, onCommit?: () => void) => onCommit?.(),
    presentBattleStart: vi.fn(),
    onResumeWildwood: vi.fn(),
  };
}

function startCampaign() {
  const deps = navigationDeps();
  createNewRunInitialization(deps, defaultGameSession).initializeRunForDifficulty(
    "knight",
    DEFAULT_CAMPAIGN_DIFFICULTY_ID,
  );
  return deps;
}

describe("boss rolls in run commands", () => {
  it("initial offers use the destination stream without rolling an unoffered boss", () => {
    startCampaign();
    expect(readActiveRun(defaultGameSession).rng.counters.world).toBe(0);
    expect(readActiveRun(defaultGameSession).rng.counters.destinations).toBe(3);
    expect(readRunSession(defaultGameSession).rewardFlow.state.selectedBossId).toBeNull();
  });

  it.each([
    { index: 0, worldDraws: 0, destinationDraws: 3 },
    { index: 7, worldDraws: 1, destinationDraws: 0 },
  ])("progression at index $index uses its own RNG streams", ({ index, worldDraws, destinationDraws }) => {
    startCampaign();
    setRunProgress({ destinationIndexInAct: index });
    setRunSession({ activity: { kind: "transmutation", data: emptyAlchemyVisit() } });
    const before = readActiveRun(defaultGameSession).rng.counters;
    createProgressionCommands(defaultGameSession).leaveVisit("transmutation");
    expect(readActiveRun(defaultGameSession).rng.counters.world - before.world).toBe(worldDraws);
    expect(readActiveRun(defaultGameSession).rng.counters.destinations - before.destinations).toBe(destinationDraws);
    expect(Boolean(readRunSession(defaultGameSession).rewardFlow.state.selectedBossId)).toBe(worldDraws === 1);
  });

  it("commits a seeded destination offer and its pity history together", () => {
    startCampaign();
    mutateGameplayForTest((draft) => {
      draft.run.activeRun.rng = createRunRngState(1234);
      draft.run.activeRun.lastOfferedDestinations = [DESTINATIONS.NORMAL_COMBAT];
      draft.run.activeRun.destinationRoundsSinceOffered = {
        [DESTINATIONS.NORMAL_COMBAT]: 0,
        [DESTINATIONS.MYSTERY]: 3,
        [DESTINATIONS.CAMPFIRE]: 1,
      };
    });
    setRunSession({ activity: { kind: "transmutation", data: emptyAlchemyVisit() } });
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision), defaultGameSession);
    try {
      createProgressionCommands(defaultGameSession).leaveVisit("transmutation");
    } finally {
      unsubscribe();
    }
    expect(commits).toHaveLength(1);
    const run = readActiveRun(defaultGameSession);
    const offered = readRunSession(defaultGameSession).rewardFlow.state.destinations;
    expect(run.lastOfferedDestinations).toEqual(offered);
    expect(offered).toEqual([DESTINATIONS.CAMPFIRE, DESTINATIONS.TRANSMUTATION, DESTINATIONS.MYSTERY]);
    expect(run.destinationRoundsSinceOffered).toEqual({
      [DESTINATIONS.CAMPFIRE]: 0,
      [DESTINATIONS.ELITE_COMBAT]: 1,
      [DESTINATIONS.MYSTERY]: 0,
      [DESTINATIONS.TRANSMUTATION]: 0,
      [DESTINATIONS.CORRUPTION]: 1,
      [DESTINATIONS.NORMAL_COMBAT]: 1,
    });
    expect(run.rng.counters).toEqual({ destinations: 3, world: 0, events: 0, rewards: 0, shops: 0 });
  });

  it.each([
    { offer: DESTINATIONS.NORMAL_COMBAT, savedBossId: null, worldDraws: 0 },
    { offer: DESTINATIONS.BOSS_COMBAT, savedBossId: "mimic", worldDraws: 0 },
    { offer: DESTINATIONS.BOSS_COMBAT, savedBossId: null, worldDraws: 1 },
  ])("resuming $offer with boss $savedBossId uses $worldDraws world draw", ({ offer, savedBossId, worldDraws }) => {
    const deps = startCampaign();
    mutateGameplayForTest((draft) => {
      setRewardState(draft, { ...createEmptyRewardState([offer]), selectedBossId: savedBossId });
      setScreen(draft, "destination");
      setScreen(draft, "menu");
    });
    const before = readActiveRun(defaultGameSession).rng.counters.world;
    createRunResumeNavigation(deps, defaultGameSession).resumeRun();
    expect(readActiveRun(defaultGameSession).rng.counters.world - before).toBe(worldDraws);
    if (worldDraws === 1)
      expect(readRunSession(defaultGameSession).rewardFlow.state.selectedBossId).toEqual(expect.any(String));
    else expect(readRunSession(defaultGameSession).rewardFlow.state.selectedBossId).toBe(savedBossId);
  });
});

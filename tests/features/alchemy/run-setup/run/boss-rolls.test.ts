import "../../../../helpers/mock-audio";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNewRunInitialization } from "@/features/alchemy/run-setup/run/new-run-initialization";
import { createRunResumeNavigation } from "@/features/alchemy/run-setup/run/run-resume-navigation";
import { createProgressionCommands } from "@/features/alchemy/run-loop/run/progression-commands";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { DEFAULT_CAMPAIGN_DIFFICULTY_ID } from "@/lib/game-constants";
import { DESTINATIONS, type Destination, type Screen } from "@/lib/routing";
import {
  acceptCommand,
  dispatchGameplayCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/gameplay-command";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { setRewardState, setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetAllTestStores } from "../../../../helpers/run-domain-store-test";
import { createRunRngState } from "@/lib/rng";
import { defaultGameSession } from "@/app/application-session";

beforeEach(resetAllTestStores);

function navigationDeps(offer: Destination) {
  return {
    navigateTo: vi.fn(),
    resumeTo: (_screen: Screen, onCommit?: () => void) => onCommit?.(),
    startBattle: vi.fn(),
    getAvailableDestinations: () => [offer],
    onResumeWildwood: vi.fn(),
  };
}

function startCampaign(offer: Destination) {
  const deps = navigationDeps(offer);
  createNewRunInitialization(deps, defaultGameSession).initializeRunForDifficulty(
    "knight",
    DEFAULT_CAMPAIGN_DIFFICULTY_ID,
  );
  return deps;
}

describe("boss rolls in run commands", () => {
  it.each([
    { offer: DESTINATIONS.NORMAL_COMBAT, worldDraws: 0, destinationDraws: 1 },
    { offer: DESTINATIONS.BOSS_COMBAT, worldDraws: 1, destinationDraws: 0 },
  ])("initial $offer offer uses its own RNG streams", ({ offer, worldDraws, destinationDraws }) => {
    startCampaign(offer);
    expect(readActiveRun(defaultGameSession).rng.counters.world).toBe(worldDraws);
    expect(readActiveRun(defaultGameSession).rng.counters.destinations).toBe(destinationDraws);
    expect(Boolean(readRunSession(defaultGameSession).rewardFlow.state.selectedBossId)).toBe(worldDraws === 1);
  });

  it.each([
    { offer: DESTINATIONS.NORMAL_COMBAT, worldDraws: 0, destinationDraws: 1 },
    { offer: DESTINATIONS.BOSS_COMBAT, worldDraws: 1, destinationDraws: 0 },
  ])("progression to $offer uses its own RNG streams", ({ offer, worldDraws, destinationDraws }) => {
    startCampaign(DESTINATIONS.NORMAL_COMBAT);
    const before = readActiveRun(defaultGameSession).rng.counters;
    createProgressionCommands(() => [offer], defaultGameSession).prepareNextDestination();
    expect(readActiveRun(defaultGameSession).rng.counters.world - before.world).toBe(worldDraws);
    expect(readActiveRun(defaultGameSession).rng.counters.destinations - before.destinations).toBe(destinationDraws);
    expect(Boolean(readRunSession(defaultGameSession).rewardFlow.state.selectedBossId)).toBe(worldDraws === 1);
  });

  it("commits a seeded destination offer and its pity history together", () => {
    startCampaign(DESTINATIONS.NORMAL_COMBAT);
    dispatchGameplayCommand(
      (draft) => {
        draft.run.activeRun.rng = createRunRngState(1234);
        draft.run.activeRun.lastOfferedDestinations = [DESTINATIONS.NORMAL_COMBAT];
        draft.run.activeRun.destinationRoundsSinceOffered = {
          [DESTINATIONS.NORMAL_COMBAT]: 0,
          [DESTINATIONS.MYSTERY]: 3,
          [DESTINATIONS.CAMPFIRE]: 1,
        };

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision), defaultGameSession);
    try {
      createProgressionCommands(
        () => [DESTINATIONS.NORMAL_COMBAT, DESTINATIONS.ELITE_COMBAT, DESTINATIONS.MYSTERY, DESTINATIONS.CAMPFIRE],
        defaultGameSession,
      ).prepareNextDestination();
    } finally {
      unsubscribe();
    }
    expect(commits).toHaveLength(1);
    const run = readActiveRun(defaultGameSession);
    const offered = readRunSession(defaultGameSession).rewardFlow.state.destinations;
    expect(run.lastOfferedDestinations).toEqual(offered);
    expect(offered).toEqual([DESTINATIONS.CAMPFIRE, DESTINATIONS.MYSTERY, DESTINATIONS.ELITE_COMBAT]);
    expect(run.destinationRoundsSinceOffered).toEqual({
      [DESTINATIONS.CAMPFIRE]: 0,
      [DESTINATIONS.ELITE_COMBAT]: 0,
      [DESTINATIONS.MYSTERY]: 0,
      [DESTINATIONS.NORMAL_COMBAT]: 1,
    });
    expect(run.rng.counters).toEqual({ destinations: 3, world: 0, events: 0, rewards: 0, shops: 0 });
  });

  it.each([
    { offer: DESTINATIONS.NORMAL_COMBAT, savedBossId: null, worldDraws: 0 },
    { offer: DESTINATIONS.BOSS_COMBAT, savedBossId: "mimic", worldDraws: 0 },
    { offer: DESTINATIONS.BOSS_COMBAT, savedBossId: null, worldDraws: 1 },
  ])("resuming $offer with boss $savedBossId uses $worldDraws world draw", ({ offer, savedBossId, worldDraws }) => {
    const deps = startCampaign(DESTINATIONS.NORMAL_COMBAT);
    dispatchGameplayCommand(
      (draft) => {
        setRewardState(draft, { ...createEmptyRewardState([offer]), selectedBossId: savedBossId });
        setScreen(draft, "destination");
        setScreen(draft, "menu");

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    const before = readActiveRun(defaultGameSession).rng.counters.world;
    createRunResumeNavigation(deps, defaultGameSession).resumeRun();
    expect(readActiveRun(defaultGameSession).rng.counters.world - before).toBe(worldDraws);
    if (worldDraws === 1)
      expect(readRunSession(defaultGameSession).rewardFlow.state.selectedBossId).toEqual(expect.any(String));
    else expect(readRunSession(defaultGameSession).rewardFlow.state.selectedBossId).toBe(savedBossId);
  });
});

import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNewRunInitialization } from "@/features/alchemy/run-setup/run/new-run-initialization";
import { createRunResumeNavigation } from "@/features/alchemy/run-setup/run/run-resume-navigation";
import { createProgressionCommands } from "@/features/alchemy/run-loop/run/progression-commands";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { DEFAULT_CAMPAIGN_DIFFICULTY_ID } from "@/lib/game-constants";
import { DESTINATIONS, type Destination, type Screen } from "@/lib/routing";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { setRewardState, setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetAllTestStores } from "../../../../helpers/run-domain-store-test";

beforeEach(resetAllTestStores);

function navigationDeps(offer: Destination) {
  return {
    navigateTo: vi.fn(),
    resumeTo: (_screen: Screen, onCommit?: () => void) => onCommit?.(),
    onStartBattle: vi.fn(),
    getAvailableDestinations: () => [offer],
    onResumeWildwood: vi.fn(),
  };
}

function startCampaign(offer: Destination) {
  const deps = navigationDeps(offer);
  createNewRunInitialization(deps).initializeRunForDifficulty("knight", DEFAULT_CAMPAIGN_DIFFICULTY_ID);
  return deps;
}

describe("boss rolls in run commands", () => {
  it.each([
    { offer: DESTINATIONS.NORMAL_COMBAT, worldDraws: 0 },
    { offer: DESTINATIONS.BOSS_COMBAT, worldDraws: 1 },
  ])("initial $offer offer uses $worldDraws world draw", ({ offer, worldDraws }) => {
    startCampaign(offer);
    expect(readActiveRun().rng.counters.world).toBe(worldDraws);
    expect(Boolean(readRunSession().rewardFlow.state.selectedBossId)).toBe(worldDraws === 1);
  });

  it.each([
    { offer: DESTINATIONS.NORMAL_COMBAT, worldDraws: 0 },
    { offer: DESTINATIONS.BOSS_COMBAT, worldDraws: 1 },
  ])("progression to $offer uses $worldDraws world draw", ({ offer, worldDraws }) => {
    startCampaign(DESTINATIONS.NORMAL_COMBAT);
    const before = readActiveRun().rng.counters.world;
    createProgressionCommands(() => [offer]).prepareNextDestination();
    expect(readActiveRun().rng.counters.world - before).toBe(worldDraws);
    expect(Boolean(readRunSession().rewardFlow.state.selectedBossId)).toBe(worldDraws === 1);
  });

  it.each([
    { offer: DESTINATIONS.NORMAL_COMBAT, savedBossId: null, worldDraws: 0 },
    { offer: DESTINATIONS.BOSS_COMBAT, savedBossId: "mimic", worldDraws: 0 },
    { offer: DESTINATIONS.BOSS_COMBAT, savedBossId: null, worldDraws: 1 },
  ])("resuming $offer with boss $savedBossId uses $worldDraws world draw", ({ offer, savedBossId, worldDraws }) => {
    const deps = startCampaign(DESTINATIONS.NORMAL_COMBAT);
    dispatchRunSessionCommand((draft) => {
      setRewardState(draft, { ...createEmptyRewardState([offer]), selectedBossId: savedBossId });
      setScreen(draft, "destination");
      setScreen(draft, "menu");
    });
    const before = readActiveRun().rng.counters.world;
    createRunResumeNavigation(deps).resumeRun();
    expect(readActiveRun().rng.counters.world - before).toBe(worldDraws);
    if (worldDraws === 1) expect(readRunSession().rewardFlow.state.selectedBossId).toEqual(expect.any(String));
    else expect(readRunSession().rewardFlow.state.selectedBossId).toBe(savedBossId);
  });
});

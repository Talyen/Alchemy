import { describe, expect, it, beforeEach, vi } from "vitest";
import { createContentSystemNavigation } from "@/features/alchemy/run-setup/run/content-system-navigation";
import { useRunSessionStore } from "@/features/alchemy/stores/run-session-store";
import { resetScreenStores } from "@/features/alchemy/stores/screen-store";
import { useRunStore } from "@/features/alchemy/stores/run-store";
import { useHomesteadStore } from "@/features/alchemy/stores/homestead-store";
import { CONSTANTS } from "@/features/alchemy/types";
import { makeRunController, makeTalentController } from "../../helpers/run-controller";
import type { BattleCard } from "@/lib/game-data";

vi.mock("@/lib/audio", () => ({
  playGoldGain: vi.fn(),
}));

vi.mock("@/features/alchemy/navigation/run-navigation-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/alchemy/navigation/run-navigation-helpers")>();
  return {
    ...actual,
    afterCampaignCharacterResolved: vi.fn((_id, _deps, onContinue) => onContinue()),
  };
});

beforeEach(() => {
  resetScreenStores();
  useRunStore.setState(useRunStore.getInitialState());
  useHomesteadStore.setState(useHomesteadStore.getInitialState());
});

function makeDeps(overrides: Partial<Parameters<typeof createContentSystemNavigation>[0]> = {}) {
  const navigateTo = vi.fn();
  const returnToBattle = vi.fn();
  const onStartBattle = vi.fn();
  const draftedDeckRef = { current: null as BattleCard[] | null };
  return {
    run: makeRunController(),
    talents: makeTalentController(),
    draftedDeckRef,
    hasActiveRun: false,
    hasActiveBattle: false,
    pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN,
    completedDifficulties: {},
    navigateTo,
    returnToBattle,
    onStartBattle,
    getAvailableDestinations: () => [CONSTANTS.DESTINATIONS.NORMAL_COMBAT],
    setDiscoveredCardIds: vi.fn(),
    setEncounteredEnemyIds: vi.fn(),
    ...overrides,
  };
}

describe("createContentSystemNavigation", () => {
  it("beginCampaign routes to character select when no active run", () => {
    const deps = makeDeps();
    const nav = createContentSystemNavigation(deps);
    nav.beginCampaign();
    expect(useRunSessionStore.getState().pendingContentSystemType).toBe(CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN);
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.CHARACTER_SELECT);
  });

  it("initializeLabyrinthRun navigates to labyrinth map", () => {
    useRunSessionStore.setState({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH });
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.LABYRINTH });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("knight");
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.LABYRINTH_MAP);
    expect(useRunStore.getState().contentSystemType).toBe(CONSTANTS.CONTENT_SYSTEMS.LABYRINTH);
  });

  it("initializeWildwoodRun navigates to wildwood select", () => {
    useRunSessionStore.setState({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.WILDWOOD });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("knight");
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.WILDWOOD_SELECT);
    expect(useRunStore.getState().contentSystemType).toBe(CONSTANTS.CONTENT_SYSTEMS.WILDWOOD);
  });

  it("returns to battle when resuming the same content system with an active battle", () => {
    const deps = makeDeps({
      hasActiveRun: true,
      hasActiveBattle: true,
      pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN,
    });
    useRunStore.setState({ contentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    nav.beginCampaign();
    expect(deps.returnToBattle).toHaveBeenCalledOnce();
    expect(deps.navigateTo).not.toHaveBeenCalled();
  });

  it("routes wildcard draft to draft-deck screen", () => {
    const deps = makeDeps({ pendingContentSystemType: CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN });
    const nav = createContentSystemNavigation(deps);
    nav.handleCharacterSelect("wildcard");
    expect(deps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.DRAFT_DECK);
    expect(useRunSessionStore.getState().pendingCharacterId).toBe("wildcard");
  });
});

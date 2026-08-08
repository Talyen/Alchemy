// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { DRAFT_ROUNDS } from "@/lib/game-constants";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { useRunFlowEngine } from "@/features/alchemy/shell/use-run-flow-engine";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { makeTestCard } from "../../../fixtures/battle";
import {
  getBattleStoreView,
  getNavigationStoreView,
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunBattleSlice,
  resetRunProgressSlice,
  setRunProgress,
  setRunSession,
} from "../../../helpers/run-domain-store-test";

vi.mock("@/lib/audio", () => ({
  playUISound: vi.fn(),
}));

beforeEach(() => {
  resetRunProgressSlice();
  resetRunBattleSlice();
  resetTransientRunUi();
  getNavigationStoreView().setScreen(ROUTE_SCREENS.MENU);
});

describe("useRunFlowEngine", () => {
  it("resetRunState tears down run stores when navigating to menu", () => {
    getRunSessionStoreView().setHasActiveRun(true);
    getBattleStoreView().setHasActiveBattle(true);
    const navigateTo = vi.fn((_screen: string, onCommit?: () => void) => onCommit?.());
    const transition = vi.fn();
    const cancelPending = vi.fn();

    const { result } = renderHook(() =>
      useRunFlowEngine({
        screen: ROUTE_SCREENS.BATTLE,
        navigateTo,
        transition,
        cancelPending,
        battle: {
          onStartBattle: vi.fn(),
          onStartBossBattle: vi.fn(),
          onStartBossById: vi.fn(),
        },
        initializeShop: vi.fn(),
        labyrinthClearNode: vi.fn(),
        labyrinthFailNode: vi.fn(),
        onMarkDifficultyCompleted: vi.fn(),
        randomSources: {
          rewards: () => 0.5,
          destinations: () => 0.5,
          events: () => 0.5,
          world: () => 0.5,
        },
      }),
    );

    act(() => {
      result.current.resetRunState();
    });

    expect(cancelPending).toHaveBeenCalledOnce();
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.MENU, expect.any(Function));
    expect(getRunSessionStoreView().hasActiveRun).toBe(false);
    expect(getBattleStoreView().hasActiveBattle).toBe(false);
  });

  it("routes completed Wildwood drafts through the Wildwood owner", () => {
    const draftedCards = Array.from({ length: DRAFT_ROUNDS }, (_, index) =>
      makeTestCard({ id: `wildwood-draft-${index}` }),
    );
    const wildwoodDraft = createInitialWildwoodDraftState("knight", () => 0.5);
    setRunProgress({ contentSystemType: "wildwood", runDeck: draftedCards.slice(0, -1) });
    setRunSession({
      hasActiveRun: true,
      pendingCharacterId: "knight",
      pendingContentSystemType: "wildwood",
      wildwoodDraft,
    });
    const onStartBossById = vi.fn(() => true);
    const navigateTo = vi.fn();

    const { result } = renderHook(() =>
      useRunFlowEngine({
        screen: ROUTE_SCREENS.DRAFT_DECK,
        navigateTo,
        transition: vi.fn(),
        cancelPending: vi.fn(),
        battle: {
          onStartBattle: vi.fn(),
          onStartBossBattle: vi.fn(),
          onStartBossById,
        },
        initializeShop: vi.fn(),
        labyrinthClearNode: vi.fn(),
        labyrinthFailNode: vi.fn(),
        onMarkDifficultyCompleted: vi.fn(),
        randomSources: {
          rewards: () => 0.5,
          destinations: () => 0.5,
          events: () => 0.5,
          world: () => 0.5,
        },
      }),
    );

    act(() => {
      result.current.handleWildwoodDraftComplete(draftedCards);
    });

    expect(getRunProgressStoreView().runDeck).toEqual(draftedCards);
    expect(getRunSessionStoreView().pendingCharacterId).toBeNull();
    expect(getRunSessionStoreView().wildwoodDraft).toMatchObject({ phase: "battle" });
    expect(onStartBossById).toHaveBeenCalledOnce();
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.BATTLE, undefined);
  });

  it("does not advance an incomplete Wildwood draft", () => {
    const draftedCards = Array.from({ length: DRAFT_ROUNDS - 1 }, (_, index) =>
      makeTestCard({ id: `incomplete-wildwood-draft-${index}` }),
    );
    setRunProgress({ contentSystemType: "wildwood", runDeck: draftedCards });
    setRunSession({
      hasActiveRun: true,
      pendingCharacterId: "knight",
      pendingContentSystemType: "wildwood",
      wildwoodDraft: createInitialWildwoodDraftState("knight", () => 0.5),
    });
    const onStartBossById = vi.fn(() => true);

    const { result } = renderHook(() =>
      useRunFlowEngine({
        screen: ROUTE_SCREENS.DRAFT_DECK,
        navigateTo: vi.fn(),
        transition: vi.fn(),
        cancelPending: vi.fn(),
        battle: {
          onStartBattle: vi.fn(),
          onStartBossBattle: vi.fn(),
          onStartBossById,
        },
        initializeShop: vi.fn(),
        labyrinthClearNode: vi.fn(),
        labyrinthFailNode: vi.fn(),
        onMarkDifficultyCompleted: vi.fn(),
        randomSources: {
          rewards: () => 0.5,
          destinations: () => 0.5,
          events: () => 0.5,
          world: () => 0.5,
        },
      }),
    );

    act(() => {
      result.current.handleWildwoodDraftComplete(draftedCards);
    });

    expect(getRunSessionStoreView().pendingCharacterId).toBe("knight");
    expect(getRunSessionStoreView().wildwoodDraft).toMatchObject({ phase: "draft" });
    expect(onStartBossById).not.toHaveBeenCalled();
  });
});

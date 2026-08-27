// @vitest-environment jsdom
import "../../../helpers/mock-audio";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { DRAFT_ROUNDS } from "@/lib/game-constants";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { useRunFlowEngine } from "@/features/alchemy/shell/use-run-flow-engine";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readBattle, readRunSession } from "@/features/alchemy/shared/stores/run-session-read-port";
import { setHasActiveBattle } from "@/features/alchemy/shared/stores/run-session-write-port";
import { setHasActiveRun } from "@/features/alchemy/shared/stores/write-port-session";
import { makeTestCard } from "../../../fixtures/battle";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetAllTestStores();
});

describe("useRunFlowEngine", () => {
  it("resetRunState tears down run stores when navigating to menu", () => {
    dispatchRunSessionCommand((draft) => {
      setHasActiveRun(draft, true);
      setHasActiveBattle(draft, true);
    });
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
      }),
    );

    act(() => {
      result.current.resetRunState();
    });

    expect(cancelPending).toHaveBeenCalledOnce();
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.MENU, expect.any(Function));
    expect(readRunSession().hasActiveRun).toBe(false);
    expect(readBattle().hasActiveBattle).toBe(false);
  });

  it("routes completed Wildwood drafts through the Wildwood owner", () => {
    const draftedCards = Array.from({ length: DRAFT_ROUNDS }, (_, index) =>
      makeTestCard({ id: `wildwood-draft-${index}` }),
    );
    const wildwoodDraft = createInitialWildwoodDraftState("knight", () => 0.5);
    setRunProgress({ contentSystemType: "wildwood", runDeck: draftedCards });
    setRunSession({
      hasActiveRun: true,
      pendingCharacterId: "knight",
      pendingContentSystemType: "wildwood",
      wildwoodDraft,
    });
    const onStartBossById = vi.fn(() => true);
    let commit: (() => void) | undefined;
    const navigateTo = vi.fn((_screen: string, onCommit?: () => void) => {
      commit = onCommit;
    });

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
      }),
    );

    act(() => {
      result.current.handleWildwoodDraftComplete(draftedCards);
    });

    expect(readActiveRun().runDeck).toEqual(draftedCards);
    expect(readRunSession().pendingCharacterId).toBeNull();
    expect(readRunSession().wildwoodDraft).toMatchObject({ phase: "draft" });
    expect(onStartBossById).not.toHaveBeenCalled();
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.BATTLE, expect.any(Function));

    act(() => commit?.());

    expect(readRunSession().wildwoodDraft).toMatchObject({ phase: "battle" });
    expect(onStartBossById).toHaveBeenCalledOnce();
  });

  it("removes a Wildwood card in the same command that enters battle", () => {
    const runDeck = Array.from({ length: 8 }, (_, index) => makeTestCard({ id: `wildwood-removal-${index}` }));
    setRunProgress({ contentSystemType: "wildwood", runDeck });
    setRunSession({
      hasActiveRun: true,
      wildwoodDraft: { ...createInitialWildwoodDraftState("knight", () => 0.5), phase: "removal" },
    });
    const onStartBossById = vi.fn(() => true);
    let commit: (() => void) | undefined;
    const navigateTo = vi.fn((_screen: string, onCommit?: () => void) => {
      commit = onCommit;
    });

    const { result } = renderHook(() =>
      useRunFlowEngine({
        screen: ROUTE_SCREENS.WILDWOOD_REMOVAL,
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
      }),
    );

    act(() => result.current.handleWildwoodRemoveCard(1));

    expect(readActiveRun().runDeck).toEqual(runDeck);
    expect(readRunSession().wildwoodDraft).toMatchObject({ phase: "removal" });
    expect(onStartBossById).not.toHaveBeenCalled();

    act(() => commit?.());

    expect(readActiveRun().runDeck.map((card) => card.id)).toEqual([
      "wildwood-removal-0",
      "wildwood-removal-2",
      "wildwood-removal-3",
      "wildwood-removal-4",
      "wildwood-removal-5",
      "wildwood-removal-6",
      "wildwood-removal-7",
    ]);
    expect(readRunSession().wildwoodDraft).toMatchObject({ phase: "battle" });
    expect(onStartBossById).toHaveBeenCalledOnce();
  });

  it("keeps the Wildwood removal phase intact when skipping until the battle screen swap", () => {
    const runDeck = Array.from({ length: 3 }, (_, index) => makeTestCard({ id: `wildwood-skip-${index}` }));
    setRunProgress({ contentSystemType: "wildwood", runDeck });
    setRunSession({
      hasActiveRun: true,
      wildwoodDraft: { ...createInitialWildwoodDraftState("knight", () => 0.5), phase: "removal" },
    });
    const onStartBossById = vi.fn(() => true);
    let commit: (() => void) | undefined;
    const navigateTo = vi.fn((_screen: string, onCommit?: () => void) => {
      commit = onCommit;
    });

    const { result } = renderHook(() =>
      useRunFlowEngine({
        screen: ROUTE_SCREENS.WILDWOOD_REMOVAL,
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
      }),
    );

    act(() => {
      result.current.handleWildwoodSkipRemoval();
      result.current.handleWildwoodSkipRemoval();
    });

    expect(readActiveRun().runDeck).toEqual(runDeck);
    expect(readRunSession().wildwoodDraft).toMatchObject({ phase: "removal" });
    expect(navigateTo).toHaveBeenCalledOnce();

    act(() => commit?.());

    expect(readActiveRun().runDeck).toEqual(runDeck);
    expect(readRunSession().wildwoodDraft).toMatchObject({ phase: "battle" });
    expect(onStartBossById).toHaveBeenCalledOnce();
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
      }),
    );

    act(() => {
      result.current.handleWildwoodDraftComplete(draftedCards);
    });

    expect(readRunSession().pendingCharacterId).toBe("knight");
    expect(readRunSession().wildwoodDraft).toMatchObject({ phase: "draft" });
    expect(onStartBossById).not.toHaveBeenCalled();
  });

  it("does not advance a Wildwood draft when the screen deck disagrees", () => {
    const draftedCards = Array.from({ length: DRAFT_ROUNDS }, (_, index) =>
      makeTestCard({ id: `wildwood-draft-${index}` }),
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
      }),
    );

    act(() => {
      result.current.handleWildwoodDraftComplete([makeTestCard({ id: "mismatched-card" })]);
    });

    expect(readRunSession().pendingCharacterId).toBe("knight");
    expect(readRunSession().wildwoodDraft).toMatchObject({ phase: "draft" });
    expect(onStartBossById).not.toHaveBeenCalled();
  });
});

import "../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTE_SCREENS, type Screen, type ScreenTransitionOptions } from "@/lib/routing";
import { DRAFT_ROUNDS } from "@/lib/game-constants";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { BattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import { createRunFlowEngine } from "@/features/alchemy/shell/run-flow-engine";
import { createRunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { readRunAvailableDestinations } from "@/features/alchemy/shell/run-destination-wiring";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readBattle, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { setHasActiveBattle, setHasActiveRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import { makeTestCard } from "../../../fixtures/battle";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../helpers/run-domain-store-test";

beforeEach(() => {
  resetAllTestStores();
});

type TestNavigate = (screen: Screen, prepare?: () => void) => void;
type TestTransition = (screen: Screen, options?: ScreenTransitionOptions) => void;

function makeOutcomes(navigateTo: TestNavigate, transition: TestTransition) {
  return createRunOutcomes({
    actions: { navigateTo, transition, clearCardHover: () => {} },
    getAvailableDestinations: readRunAvailableDestinations,
  });
}

function makeEngine({
  navigateTo = vi.fn(),
  resumeTo = vi.fn(),
  transition = vi.fn(),
  cancelPending = vi.fn(),
  startBattle = vi.fn(),
  startBossBattle = vi.fn(),
  startBossById = vi.fn(),
  initializeShop = vi.fn(),
  labyrinthClearNode = vi.fn(),
}: {
  navigateTo?: TestNavigate;
  resumeTo?: TestNavigate;
  transition?: TestTransition;
  cancelPending?: () => void;
  startBattle?: () => void;
  startBossBattle?: () => void;
  startBossById?: BattleStartCommands["startBossById"];
  initializeShop?: () => void;
  labyrinthClearNode?: () => void;
} = {}) {
  return createRunFlowEngine(
    {
      navigateTo,
      resumeTo,
      transition,
      cancelPending,
      battle: {
        startBattle,
        startBossBattle,
        startBossById,
      },
      initializeShop,
      labyrinthClearNode,
    },
    makeOutcomes(navigateTo, transition),
  );
}

describe("createRunFlowEngine", () => {
  it("clears card hover on every flow navigation", () => {
    const navigateTo = vi.fn();
    const engine = makeEngine({ navigateTo });

    useUiStore.setState({ hoveredCardId: "card-1" });
    engine.beginCampaign();
    expect(useUiStore.getState().hoveredCardId).toBeNull();
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.CHARACTER_SELECT, undefined);
  });

  it("resetRunState tears down run stores when navigating to menu", () => {
    dispatchRunSessionCommand((draft) => {
      setHasActiveRun(draft, true);
      setHasActiveBattle(draft, true);
    });
    const navigateTo = vi.fn((_screen: string, onCommit?: () => void) => onCommit?.());
    const cancelPending = vi.fn();

    const engine = makeEngine({ navigateTo, cancelPending });
    engine.resetRunState();

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
    const startBossById = vi.fn(() => true);
    const navigateTo = vi.fn();

    const engine = makeEngine({ navigateTo, startBossById });
    engine.handleWildwoodDraftComplete();

    expect(readActiveRun().runDeck).toEqual(draftedCards);
    expect(readRunSession().pendingCharacterId).toBeNull();
    expect(readRunSession().wildwoodDraft).toMatchObject({ phase: "battle" });
    expect(startBossById).toHaveBeenCalledOnce();
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.BATTLE, undefined);
  });

  it("removes a Wildwood card in the same command that enters battle", () => {
    const runDeck = Array.from({ length: 8 }, (_, index) => makeTestCard({ id: `wildwood-removal-${index}` }));
    setRunProgress({ contentSystemType: "wildwood", runDeck });
    setRunSession({
      hasActiveRun: true,
      wildwoodDraft: { ...createInitialWildwoodDraftState("knight", () => 0.5), phase: "removal" },
    });
    const startBossById = vi.fn(() => true);

    const engine = makeEngine({ startBossById });
    engine.handleWildwoodRemoveCard(1);

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
    expect(startBossById).toHaveBeenCalledOnce();
  });

  it("commits a skipped Wildwood removal before the battle screen swap", () => {
    const runDeck = Array.from({ length: 3 }, (_, index) => makeTestCard({ id: `wildwood-skip-${index}` }));
    setRunProgress({ contentSystemType: "wildwood", runDeck });
    setRunSession({
      hasActiveRun: true,
      wildwoodDraft: { ...createInitialWildwoodDraftState("knight", () => 0.5), phase: "removal" },
    });
    const startBossById = vi.fn(() => true);
    const navigateTo = vi.fn();

    const engine = makeEngine({ navigateTo, startBossById });
    engine.handleWildwoodSkipRemoval();
    engine.handleWildwoodSkipRemoval();

    expect(readActiveRun().runDeck).toEqual(runDeck);
    expect(readRunSession().wildwoodDraft).toMatchObject({ phase: "battle" });
    expect(navigateTo).toHaveBeenCalledOnce();
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
    const startBossById = vi.fn(() => true);

    const engine = makeEngine({ startBossById });
    engine.handleWildwoodDraftComplete();

    expect(readRunSession().pendingCharacterId).toBe("knight");
    expect(readRunSession().wildwoodDraft).toMatchObject({ phase: "draft" });
    expect(startBossById).not.toHaveBeenCalled();
  });

  it("advances Wildwood draft from authoritative deck regardless of stale screen payload", () => {
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
    const startBossById = vi.fn(() => true);
    const navigateTo = vi.fn();

    const engine = makeEngine({ navigateTo, startBossById });
    engine.handleWildwoodDraftComplete();

    expect(readRunSession().pendingCharacterId).toBeNull();
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.BATTLE, undefined);
  });
});

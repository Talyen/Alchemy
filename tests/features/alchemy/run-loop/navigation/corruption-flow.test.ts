import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/corruption-flow";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  abandonLabyrinthCorruptionVisit,
  setActiveLabyrinthPendingNode,
  setCorruptionResult,
  setRunDeck,
  setSelectedLabyrinthNodeId,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { makeTestCard } from "../../../../fixtures/cards";
import { readActivityData } from "@/lib/active-run-session";
beforeEach(() => {
  resetTransientRunUi();
});

describe("corruption destination exit", () => {
  it("handleCorruptionExit restores the current picker when no card was corrupted", () => {
    const advanceToNextDestination = vi.fn();
    const returnToCurrentDestination = vi.fn();
    createCorruptionFlowHandlers({
      advanceToNextDestination,
      returnToCurrentDestination,
    }).handleCorruptionExit();

    expect(returnToCurrentDestination).toHaveBeenCalledOnce();
    expect(advanceToNextDestination).not.toHaveBeenCalled();
  });

  it("handleCorruptionExit advances after a corruption result", () => {
    const card = makeTestCard({ id: "slash" });
    dispatchRunSessionCommand((draft) =>
      setCorruptionResult(draft, {
        originalCard: card,
        corruptedCard: { ...card, corrupted: true },
        transformed: false,
        delta: -1,
      }),
    );

    const advanceToNextDestination = vi.fn();
    const returnToCurrentDestination = vi.fn();
    createCorruptionFlowHandlers({
      advanceToNextDestination,
      returnToCurrentDestination,
    }).handleCorruptionExit();

    expect(advanceToNextDestination).toHaveBeenCalledOnce();
    expect(returnToCurrentDestination).not.toHaveBeenCalled();
  });

  it("handleCorruptCard ignores a second pick after a result is stored", () => {
    const original = makeTestCard({ id: "slash" });
    dispatchRunSessionCommand((draft) => {
      setRunDeck(draft, [original]);
      setCorruptionResult(draft, {
        originalCard: original,
        corruptedCard: { ...original, corrupted: true },
        transformed: false,
        delta: -1,
      });
    });

    createCorruptionFlowHandlers({
      advanceToNextDestination: vi.fn(),
      returnToCurrentDestination: vi.fn(),
    }).handleCorruptCard(1);

    expect(readActiveRun().runDeck).toEqual([original]);
  });

  it("handleCorruptionExit returns to the maze when leaving a labyrinth altar untouched", () => {
    const advanceToNextDestination = vi.fn();
    const returnToCurrentDestination = vi.fn();
    const returnToLabyrinthMap = vi.fn();
    createCorruptionFlowHandlers({
      advanceToNextDestination,
      returnToCurrentDestination,
      returnToLabyrinthMap,
      isLabyrinthRun: () => true,
    }).handleCorruptionExit();

    expect(returnToLabyrinthMap).toHaveBeenCalledOnce();
    expect(returnToCurrentDestination).not.toHaveBeenCalled();
    expect(advanceToNextDestination).not.toHaveBeenCalled();
  });

  it("abandonLabyrinthCorruptionVisit clears pending state without consuming the chamber", () => {
    const card = makeTestCard({ id: "slash" });
    dispatchRunSessionCommand((draft) => {
      setActiveLabyrinthPendingNode(draft, "labyrinth-floor-1-n0");
      setSelectedLabyrinthNodeId(draft, "labyrinth-floor-1-n0");
      setCorruptionResult(draft, {
        originalCard: card,
        corruptedCard: { ...card, corrupted: true },
        transformed: false,
        delta: 1,
      });
    });
    dispatchRunSessionCommand((draft) => abandonLabyrinthCorruptionVisit(draft));

    expect(readRunSession().activeLabyrinthPendingNode).toBeNull();
    expect(readRunSession().selectedLabyrinthNodeId).toBeNull();
    expect(readActivityData(readRunSession().activity, "corruption")).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/corruption-flow";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
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
import { defaultGameSession } from "@/app/application-session";
beforeEach(() => {
  resetTransientRunUi(defaultGameSession);
});

describe("corruption destination exit", () => {
  it("handleCorruptionExit restores the current picker when no card was corrupted", () => {
    const advanceToNextDestination = vi.fn();
    const returnToCurrentDestination = vi.fn();
    createCorruptionFlowHandlers(
      {
        advanceToNextDestination,
        returnToCurrentDestination,
      },
      defaultGameSession,
    ).handleCorruptionExit();

    expect(returnToCurrentDestination).toHaveBeenCalledOnce();
    expect(advanceToNextDestination).not.toHaveBeenCalled();
  });

  it("handleCorruptionExit advances after a corruption result", () => {
    const card = makeTestCard({ id: "slash" });
    dispatchRunSessionCommand(
      (draft) =>
        acceptCommand(
          setCorruptionResult(draft, {
            originalCard: card,
            corruptedCard: { ...card, corrupted: true },
            transformed: false,
            delta: -1,
          }),
        ),
      undefined,
      defaultGameSession,
    );

    const advanceToNextDestination = vi.fn();
    const returnToCurrentDestination = vi.fn();
    createCorruptionFlowHandlers(
      {
        advanceToNextDestination,
        returnToCurrentDestination,
      },
      defaultGameSession,
    ).handleCorruptionExit();

    expect(advanceToNextDestination).toHaveBeenCalledOnce();
    expect(returnToCurrentDestination).not.toHaveBeenCalled();
  });

  it("handleCorruptCard ignores a second pick after a result is stored", () => {
    const original = makeTestCard({ id: "slash" });
    dispatchRunSessionCommand(
      (draft) => {
        setRunDeck(draft, [original]);
        setCorruptionResult(draft, {
          originalCard: original,
          corruptedCard: { ...original, corrupted: true },
          transformed: false,
          delta: -1,
        });

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

    createCorruptionFlowHandlers(
      {
        advanceToNextDestination: vi.fn(),
        returnToCurrentDestination: vi.fn(),
      },
      defaultGameSession,
    ).handleCorruptCard(1);

    expect(readActiveRun(defaultGameSession).runDeck).toEqual([original]);
  });

  it("handleCorruptionExit returns to the maze when leaving a labyrinth altar untouched", () => {
    const advanceToNextDestination = vi.fn();
    const returnToCurrentDestination = vi.fn();
    const returnToLabyrinthMap = vi.fn();
    createCorruptionFlowHandlers(
      {
        advanceToNextDestination,
        returnToCurrentDestination,
        returnToLabyrinthMap,
        isLabyrinthRun: () => true,
      },
      defaultGameSession,
    ).handleCorruptionExit();

    expect(returnToLabyrinthMap).toHaveBeenCalledOnce();
    expect(returnToCurrentDestination).not.toHaveBeenCalled();
    expect(advanceToNextDestination).not.toHaveBeenCalled();
  });

  it("abandonLabyrinthCorruptionVisit clears pending state without consuming the chamber", () => {
    const card = makeTestCard({ id: "slash" });
    dispatchRunSessionCommand(
      (draft) => {
        setActiveLabyrinthPendingNode(draft, "labyrinth-floor-1-n0");
        setSelectedLabyrinthNodeId(draft, "labyrinth-floor-1-n0");
        setCorruptionResult(draft, {
          originalCard: card,
          corruptedCard: { ...card, corrupted: true },
          transformed: false,
          delta: 1,
        });

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    dispatchRunSessionCommand(
      (draft) => acceptCommand(abandonLabyrinthCorruptionVisit(draft)),
      undefined,
      defaultGameSession,
    );

    expect(readRunSession(defaultGameSession).activeLabyrinthPendingNode).toBeNull();
    expect(readRunSession(defaultGameSession).selectedLabyrinthNodeId).toBeNull();
    expect(readActivityData(readRunSession(defaultGameSession).activity, "corruption")).toBeNull();
  });
});

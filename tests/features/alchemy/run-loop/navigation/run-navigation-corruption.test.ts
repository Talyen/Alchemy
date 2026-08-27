import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCorruptionFlowHandlers } from "@/features/alchemy/run-loop/navigation/run-navigation-corruption";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setCorruptionResult } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { makeTestCard } from "../../../../fixtures/cards";

beforeEach(() => {
  resetTransientRunUi();
});

describe("corruption destination exit", () => {
  it("handleCorruptionExit restores the current picker when no card was corrupted", () => {
    const advanceToNextDestination = vi.fn();
    const returnToCurrentDestination = vi.fn();
    createCorruptionFlowHandlers({
      updateRunDeck: () => {},
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
      updateRunDeck: () => {},
      advanceToNextDestination,
      returnToCurrentDestination,
    }).handleCorruptionExit();

    expect(advanceToNextDestination).toHaveBeenCalledOnce();
    expect(returnToCurrentDestination).not.toHaveBeenCalled();
  });

  it("handleCorruptCard ignores a second pick after a result is stored", () => {
    const original = makeTestCard({ id: "slash" });
    dispatchRunSessionCommand((draft) =>
      setCorruptionResult(draft, {
        originalCard: original,
        corruptedCard: { ...original, corrupted: true },
        transformed: false,
        delta: -1,
      }),
    );

    const updateRunDeck = vi.fn();
    createCorruptionFlowHandlers({
      updateRunDeck,
      advanceToNextDestination: vi.fn(),
      returnToCurrentDestination: vi.fn(),
    }).handleCorruptCard(1);

    expect(updateRunDeck).not.toHaveBeenCalled();
  });
});

import "../../../../helpers/mock-audio";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftDeckScreen } from "@/features/alchemy/run-setup/screens/draft-deck-screen";
import { DRAFT_ROUNDS, MOTION_FADE_MS } from "@/lib/game-constants";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { makeTestCard } from "../../../../fixtures/battle";
import { useUiStore } from "@/features/alchemy/shared/stores/react/ui-store";

describe("DraftDeckScreen", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useUiStore.setState({ hoveredCardId: null, shimmerState: null, plasmaInteraction: null });
  });

  it("finishes the final pick before enabling Continue and dispatches completion", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const onPick = vi.fn();
    const drafting = Array.from({ length: DRAFT_ROUNDS - 1 }, (_, index) =>
      makeTestCard({ id: `drafted-${index}`, title: `Drafted ${index}` }),
    );
    const choices = [
      makeTestCard({ id: "final-a", title: "Final A" }),
      makeTestCard({ id: "final-b", title: "Final B" }),
      makeTestCard({ id: "final-c", title: "Final C" }),
    ];
    const completed = [...drafting, makeTestCard({ id: "final-a", title: "Final A" })];

    const { rerender } = render(
      <DraftDeckScreen onComplete={onComplete} draftedCards={drafting} draftChoices={choices} onPick={onPick} />,
    );
    expect(screen.getByText("Draft a Deck")).toBeDefined();
    expect(screen.queryByText("Draft Complete")).toBeNull();
    expect(screen.queryByRole("button", { name: /Continue/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Select Final A" }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith("final-a");
    expect(onComplete).not.toHaveBeenCalled();

    rerender(<DraftDeckScreen onComplete={onComplete} draftedCards={completed} draftChoices={[]} onPick={onPick} />);

    expect(screen.getByText("Draft a Deck")).toBeDefined();
    expect(screen.queryByText("Draft Complete")).toBeNull();
    expect(screen.queryByRole("button", { name: /Continue/i })).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(resolveGameDelay(MOTION_FADE_MS));
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(20);
    });

    expect(screen.getByText("Draft Complete")).toBeDefined();
    expect(screen.queryByText("Draft a Deck")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
    expect(onComplete).toHaveBeenCalledExactlyOnceWith();
  });
});

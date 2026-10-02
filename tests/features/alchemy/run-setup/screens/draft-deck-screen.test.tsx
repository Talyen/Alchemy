import "../../../../helpers/mock-audio";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftDeckScreen } from "@/features/alchemy/run-setup/screens/draft-deck-screen";
import { DRAFT_ROUNDS, MOTION_FADE_MS } from "@/lib/game-constants";
import { resolveGameDelay } from "@/lib/animation/game-timer";
import { makeTestCard } from "../../../../fixtures/battle";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";

describe("DraftDeckScreen", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    useUiStore.setState({ hoveredCardId: null, shimmerState: null, plasmaInteraction: null });
  });

  it("renders completed draft state with continue action", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onPick = vi.fn();
    const drafted = Array.from({ length: DRAFT_ROUNDS }, (_, index) =>
      makeTestCard({ id: `card-${index}`, title: `Card ${index}` }),
    );

    render(<DraftDeckScreen onComplete={onComplete} draftedCards={drafted} draftChoices={[]} onPick={onPick} />);

    expect(screen.getByText("Draft Complete")).toBeDefined();
    expect(screen.getByText(`You drafted ${String(DRAFT_ROUNDS)} cards. Ready to begin your run.`)).toBeDefined();

    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);
    expect(onComplete).toHaveBeenCalledWith();
  });

  it("holds the Continue action until the Draft Complete art grid swaps in", async () => {
    vi.useFakeTimers();
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
      <DraftDeckScreen onComplete={vi.fn()} draftedCards={drafting} draftChoices={choices} onPick={vi.fn()} />,
    );
    expect(screen.getByText("Draft a Deck")).toBeDefined();
    expect(screen.queryByText("Draft Complete")).toBeNull();
    expect(screen.queryByRole("button", { name: /Continue/i })).toBeNull();

    rerender(<DraftDeckScreen onComplete={vi.fn()} draftedCards={completed} draftChoices={[]} onPick={vi.fn()} />);

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
    expect(screen.getByRole("button", { name: /Continue/i })).toBeDefined();
  });
});

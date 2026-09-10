import "../../../../helpers/mock-audio";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("renders in-progress draft header and choices", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onComplete = vi.fn();

    const card1 = makeTestCard({ id: "strike", title: "Strike" });
    const card2 = makeTestCard({ id: "defend", title: "Defend" });
    const card3 = makeTestCard({ id: "heal", title: "Heal" });

    render(
      <DraftDeckScreen
        onComplete={onComplete}
        draftedCards={[card1]}
        draftChoices={[card1, card2, card3]}
        onPick={onPick}
      />,
    );

    expect(screen.getByText("Draft a Deck")).toBeDefined();
    expect(screen.getByText(`Pick 1 of 3 cards - 1/${String(DRAFT_ROUNDS)} selected`)).toBeDefined();

    const choices = screen.getAllByRole("button");
    expect(choices.length).toBeGreaterThanOrEqual(3);

    const defendCard = screen.getByRole("button", { name: /Defend/i });
    await user.click(defendCard);
    expect(onPick).toHaveBeenCalledWith(card2.id);
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

  it("updates plasma interaction on hovering draft choice", () => {
    const card = makeTestCard({ id: "fireball", title: "Fireball", tags: ["burn"] });

    render(<DraftDeckScreen onComplete={vi.fn()} draftedCards={[]} draftChoices={[card]} onPick={vi.fn()} />);

    const choiceBtn = screen.getByRole("button", { name: /Fireball/i });
    fireEvent.mouseEnter(choiceBtn);

    expect(useUiStore.getState().plasmaInteraction).not.toBeNull();

    fireEvent.mouseLeave(choiceBtn);
    expect(useUiStore.getState().plasmaInteraction).toBeNull();
  });

  it("isolates hover state for duplicate drafted cards", () => {
    const cardA = makeTestCard({ id: "strike", title: "Strike" });
    const cardB = makeTestCard({ id: "strike", title: "Strike" });
    const drafted = [
      cardA,
      cardB,
      ...Array.from({ length: DRAFT_ROUNDS - 2 }, (_, index) =>
        makeTestCard({ id: `card-${index}`, title: `Card ${index}` }),
      ),
    ];

    render(<DraftDeckScreen onComplete={vi.fn()} draftedCards={drafted} draftChoices={[]} onPick={vi.fn()} />);

    const strikeButtons = screen.getAllByRole("button", { name: /Strike/i });
    expect(strikeButtons).toHaveLength(2);

    fireEvent.mouseEnter(strikeButtons[0]!);
    expect(useUiStore.getState().hoveredCardId).toBe("drafted-strike-0-strike");

    fireEvent.mouseEnter(strikeButtons[1]!);
    expect(useUiStore.getState().hoveredCardId).toBe("drafted-strike-1-strike");
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

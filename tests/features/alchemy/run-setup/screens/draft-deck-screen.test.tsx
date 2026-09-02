import "../../../../helpers/mock-audio";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftDeckScreen } from "@/features/alchemy/run-setup/screens/draft-deck-screen";
import { DRAFT_ROUNDS } from "@/lib/game-constants";
import { makeTestCard } from "../../../../fixtures/battle";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";

describe("DraftDeckScreen", () => {
  afterEach(() => {
    cleanup();
    useUiStore.setState({ hoveredCardId: null, shimmerState: null, plasmaInteraction: null });
  });

  it("renders in-progress draft header and choices", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onComplete = vi.fn();
    const onOpenMenu = vi.fn();

    const card1 = makeTestCard({ id: "strike", title: "Strike" });
    const card2 = makeTestCard({ id: "defend", title: "Defend" });
    const card3 = makeTestCard({ id: "heal", title: "Heal" });

    render(
      <DraftDeckScreen
        onComplete={onComplete}
        draftedCards={[card1]}
        draftChoices={[card1, card2, card3]}
        onPick={onPick}
        onOpenMenu={onOpenMenu}
      />,
    );

    expect(screen.getByText("Draft a Deck")).toBeDefined();
    expect(screen.getByText(`Pick 1 of 3 cards - 2/${String(DRAFT_ROUNDS)} selected`)).toBeDefined();

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

    render(
      <DraftDeckScreen
        onComplete={onComplete}
        draftedCards={drafted}
        draftChoices={[]}
        onPick={onPick}
        onOpenMenu={vi.fn()}
      />,
    );

    expect(screen.getByText("Draft Complete")).toBeDefined();
    expect(screen.getByText(`You drafted ${String(DRAFT_ROUNDS)} cards. Ready to begin your run.`)).toBeDefined();

    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await user.click(continueBtn);
    expect(onComplete).toHaveBeenCalledWith();
  });

  it("updates plasma interaction on hovering draft choice", () => {
    const card = makeTestCard({ id: "fireball", title: "Fireball", tags: ["burn"] });

    render(
      <DraftDeckScreen
        onComplete={vi.fn()}
        draftedCards={[]}
        draftChoices={[card]}
        onPick={vi.fn()}
        onOpenMenu={vi.fn()}
      />,
    );

    const choiceBtn = screen.getByRole("button", { name: /Fireball/i });
    fireEvent.mouseEnter(choiceBtn);

    expect(useUiStore.getState().plasmaInteraction).not.toBeNull();

    fireEvent.mouseLeave(choiceBtn);
    expect(useUiStore.getState().plasmaInteraction).toBeNull();
  });
});

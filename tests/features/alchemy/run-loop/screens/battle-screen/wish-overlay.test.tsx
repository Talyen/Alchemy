// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { WishOverlay } from "@/features/alchemy/run-loop/screens/battle-screen/wish-overlay";
import type { BattleActionsProps, BattleScreenState } from "@/features/alchemy/run-loop/screens/battle-screen/types";
import type { BattleCard } from "@/lib/game-data";

vi.mock("@/features/alchemy/shared/ui/card-button", () => ({
  BattleCardButton: ({ ariaLabel, onClick }: { ariaLabel: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {ariaLabel}
    </button>
  ),
}));

vi.mock("@/features/alchemy/shared/ui/use-interactive-card", () => ({
  useInteractiveCard: () => ({
    isHovered: false,
    onHoverStart: vi.fn(),
    onHoverEnd: vi.fn(),
    shimmerActive: false,
    shimmerToken: 0,
  }),
}));

const wishCard = {
  id: "wish-card",
  title: "Wish Card",
  descriptionLines: ["A wish."],
  art: "wish",
  cost: 1,
  effects: [],
} as BattleCard;

function renderWish(onWishChoice = vi.fn()) {
  const battleState = {
    wishOptions: [wishCard],
    talentEffects: {},
    trinketEffects: { companionDamageBonus: 0 },
    companionDamageBuff: 0,
  } as unknown as BattleScreenState;
  const actions = { onWishChoice } as unknown as BattleActionsProps;
  return render(<WishOverlay open battleState={battleState} actions={actions} />);
}

describe("WishOverlay", () => {
  afterEach(() => {
    cleanup();
    resetEscapeStackForTests();
  });

  it("skips on Escape and stops GameMenu from receiving the key", async () => {
    const user = userEvent.setup();
    const onWishChoice = vi.fn();
    const gameMenuHandler = vi.fn();

    window.addEventListener("keydown", gameMenuHandler);
    renderWish(onWishChoice);

    await user.keyboard("{Escape}");

    expect(onWishChoice).toHaveBeenCalledWith(null);
    expect(gameMenuHandler).not.toHaveBeenCalled();

    window.removeEventListener("keydown", gameMenuHandler);
  });

  it("ignores rapid Skip taps after the first resolve", async () => {
    const user = userEvent.setup();
    const onWishChoice = vi.fn();
    renderWish(onWishChoice);

    const skip = screen.getByRole("button", { name: "Skip" });
    await user.click(skip);
    await user.click(skip);

    expect(onWishChoice).toHaveBeenCalledTimes(1);
    expect(onWishChoice).toHaveBeenCalledWith(null);
  });

  it("accepts a new choice after the overlay reopens", async () => {
    const user = userEvent.setup();
    const onWishChoice = vi.fn();
    const battleState = {
      wishOptions: [wishCard],
      talentEffects: {},
      trinketEffects: { companionDamageBonus: 0 },
      companionDamageBuff: 0,
    } as unknown as BattleScreenState;
    const actions = { onWishChoice } as unknown as BattleActionsProps;
    const { rerender } = render(<WishOverlay open battleState={battleState} actions={actions} />);

    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(onWishChoice).toHaveBeenCalledTimes(1);

    rerender(<WishOverlay open={false} battleState={battleState} actions={actions} />);
    rerender(<WishOverlay open battleState={battleState} actions={actions} />);

    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(onWishChoice).toHaveBeenCalledTimes(2);
  });
});

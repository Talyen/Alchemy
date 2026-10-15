import { makeTestCard } from "../../../../../fixtures/cards";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { WishOverlay } from "@/features/alchemy/run-loop/screens/battle-screen/wish-overlay";
import type { BattleActionsProps } from "@/features/alchemy/run-loop/screens/battle-screen/types";
import { waitForArtwork } from "../../../../../helpers/artwork-test";
import type { CardDescriptionContext } from "@/lib/game-data";
import { patchBattleState } from "../../../../../fixtures/battle";
import { MOTION_FADE_MS } from "@/lib/game-constants";

vi.mock("@/features/alchemy/shared/ui/cards/card-button", () => ({
  BattleCardButton: ({
    ariaLabel,
    onClick,
    descriptionContext,
  }: {
    ariaLabel: string;
    onClick: () => void;
    descriptionContext: CardDescriptionContext;
  }) => (
    <button
      type="button"
      onClick={onClick}
      data-companion-damage={descriptionContext.companionDamageModifiers?.damageBonus}
    >
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

const wishCard = makeTestCard({
  id: "wish-card",
  title: "Wish Card",
  descriptionLines: ["A wish."],
  art: "wish",
});

function renderWish(onWishChoice = vi.fn()) {
  const battleState = patchBattleState({ wishOptions: [wishCard] });
  const actions = { onWishChoice } as unknown as BattleActionsProps;
  return render(<WishOverlay open battleState={battleState} actions={actions} />);
}

describe("WishOverlay", () => {
  afterEach(() => {
    cleanup();
    resetEscapeStackForTests();
    vi.useRealTimers();
  });

  it("ignores Escape and stops GameMenu from receiving the key", async () => {
    const user = userEvent.setup();
    const onWishChoice = vi.fn();
    const gameMenuHandler = vi.fn();

    window.addEventListener("keydown", gameMenuHandler);
    renderWish(onWishChoice);

    await user.keyboard("{Escape}");

    expect(onWishChoice).not.toHaveBeenCalled();
    expect(gameMenuHandler).not.toHaveBeenCalled();

    window.removeEventListener("keydown", gameMenuHandler);
  });

  it.each(["queued", "reopened"])("accepts the next %s Wish even when its cards repeat", async (nextPrompt) => {
    const user = userEvent.setup();
    const onWishChoice = vi.fn();
    const battleState = patchBattleState({ wishOptions: [wishCard] });
    const actions = { onWishChoice } as unknown as BattleActionsProps;
    const { rerender } = render(<WishOverlay open battleState={battleState} actions={actions} />);

    await waitForArtwork();
    await user.click(screen.getByRole("button", { name: "Choose Wish Card" }));
    expect(onWishChoice).toHaveBeenCalledExactlyOnceWith(wishCard);

    if (nextPrompt === "queued") {
      rerender(<WishOverlay open battleState={{ ...battleState, wishOptions: [wishCard] }} actions={actions} />);
    } else {
      rerender(<WishOverlay open={false} battleState={battleState} actions={actions} />);
      rerender(<WishOverlay open battleState={battleState} actions={actions} />);
    }

    await waitForArtwork();
    await user.click(screen.getByRole("button", { name: "Choose Wish Card" }));
    expect(onWishChoice).toHaveBeenCalledTimes(2);
    expect(onWishChoice).toHaveBeenLastCalledWith(wishCard);
  });

  it("holds outgoing choices and scaling through exit, then uses the next Wish's context", async () => {
    const battleState = patchBattleState({ wishOptions: [wishCard], talentEffects: { companionDamage: 3 } });
    const actions = { onWishChoice: vi.fn() } as unknown as BattleActionsProps;
    const { rerender } = render(<WishOverlay open battleState={battleState} actions={actions} />);
    await waitForArtwork();
    vi.useFakeTimers();
    const nextState = patchBattleState({ wishOptions: null, talentEffects: { companionDamage: 9 } });

    rerender(<WishOverlay open={false} battleState={nextState} actions={actions} />);
    expect(screen.getByText("Choose Wish Card").getAttribute("data-companion-damage")).toBe("3");
    act(() => vi.advanceTimersByTime(MOTION_FADE_MS));
    expect(screen.queryByText("Choose Wish Card")).toBeNull();

    rerender(<WishOverlay open battleState={{ ...nextState, wishOptions: [wishCard] }} actions={actions} />);
    expect(screen.getByText("Choose Wish Card").getAttribute("data-companion-damage")).toBe("9");
  });
});

import { installFocusInputForTests } from "../../../../../helpers/focus-input-test";
import { createCleanup } from "@/lib/cleanup";
import { makeTestCard } from "../../../../../fixtures/cards";
import { createRef, type MouseEventHandler, type RefObject } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mutateRunForTest, setBattleActiveForTest } from "../../../../../helpers/run-domain-store-test";
import { setScreen } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { battlePresentation } from "@/app/battle-presentation";
import { BattleHand } from "@/features/alchemy/run-loop/screens/battle-screen/hand";
import type {
  BattleActionsProps,
  BattleRefsProps,
  RequiredBattleViewProps,
} from "@/features/alchemy/run-loop/screens/battle-screen/types";
import { defaultBattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import { audioState } from "@/lib/audio/state";
import { getHandCardKey } from "@/features/alchemy/run-loop/battle/playable-hand";

installFocusInputForTests(true);

vi.mock("@/features/alchemy/shared/ui/cards/card-button", () => ({
  BattleCardButton: ({
    ariaLabel,
    className,
    scaleOnHover,
    buttonRef,
    onClick,
  }: {
    ariaLabel: string;
    className: string;
    scaleOnHover: boolean;
    buttonRef: RefObject<HTMLButtonElement | null>;
    onClick: MouseEventHandler<HTMLButtonElement>;
  }) => (
    <button
      ref={buttonRef}
      onClick={onClick}
      type="button"
      aria-label={ariaLabel}
      className={className}
      data-scale-on-hover={scaleOnHover}
    />
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

vi.mock("@/features/alchemy/run-loop/screens/battle-screen/use-battle-description-context", () => ({
  useBattleDescriptionContext: () => ({}),
}));

const affordableCard: BattleCard = makeTestCard({
  id: "slash",
  title: "Slash",
  descriptionLines: ["Deal damage."],
  effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
  uid: 1,
});

const expensiveCard: BattleCard = {
  ...affordableCard,
  id: "meteor",
  title: "Meteor",
  cost: 9,
  uid: 2,
};

function renderHand() {
  const battleState = {
    ...defaultBattleState(),
    turnPhase: "player" as const,
    mana: 2,
    wishOptions: null,
    hand: [affordableCard, expensiveCard],
  };
  const view = {
    battleState,
    stagePixelRatio: 1,
  } as unknown as RequiredBattleViewProps;
  const refs = {
    handCardRefs: { current: {} },
  } as unknown as BattleRefsProps;
  const actions = {
    onCardClick: vi.fn(),
  } as unknown as BattleActionsProps;

  return render(
    <BattleHand
      presentation={battlePresentation}
      view={view}
      refs={refs}
      actions={actions}
      playabilityState={battleState}
    />,
  );
}

describe("BattleHand", () => {
  afterEach(() => {
    cleanup();
    battlePresentation.getState().resetPresentation();
  });

  it.each(["none", "blur", "ArrowRight", "F7", "wheel"])("respects input after playing a card (%s)", (interruption) => {
    const endTurnButtonRef = createRef<HTMLButtonElement>();
    const refs = { handCardRefs: { current: {} }, endTurnButtonRef } as unknown as BattleRefsProps;
    const onCardClick = vi.fn();
    const state = { ...defaultBattleState(), hand: [affordableCard], mana: 2 };
    const tree = (hand: BattleCard[]) => (
      <>
        <button type="button" ref={endTurnButtonRef}>
          End Turn
        </button>
        <section data-battle-bottom-bar>
          <BattleHand
            presentation={battlePresentation}
            view={{ battleState: { ...state, hand }, stagePixelRatio: 1 } as unknown as RequiredBattleViewProps}
            refs={refs}
            actions={{ onCardClick, onWishChoice: vi.fn() }}
            playabilityState={{ ...state, hand }}
          />
        </section>
      </>
    );
    const { rerender } = render(tree(state.hand));
    const target = endTurnButtonRef.current!;
    const geometry = vi
      .spyOn(target, "getClientRects")
      .mockReturnValue([new DOMRect(0, 0, 44, 44)] as unknown as DOMRectList);
    target.scrollIntoView = vi.fn();
    using _scopeCleanup = createCleanup(() => geometry.mockRestore());

    const card = screen.getByRole("button", { name: "Play Slash" });
    card.focus();
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.click(card);
    expect(onCardClick).toHaveBeenCalledOnce();
    if (interruption === "blur") {
      fireEvent.blur(window);
      fireEvent.focus(window);
    }
    if (interruption === "wheel") {
      fireEvent.wheel(document.body);
      fireEvent.keyDown(document.body, { key: "Tab" });
    }
    if (interruption !== "none" && interruption !== "blur" && interruption !== "wheel") {
      fireEvent.keyDown(card, { key: interruption });
    }
    rerender(tree([]));
    expect(document.activeElement).toBe(interruption !== "none" ? document.body : target);
  });

  it("keeps playable cards colored and interactive during transfers", () => {
    battlePresentation.getState().setCardTransferInProgress(true);
    renderHand();

    const affordable = screen.getByRole("button", { name: "Play Slash" });
    const expensive = screen.getByRole("button", { name: "Play Meteor" });

    expect(affordable.classList.contains("hand-card-unplayable")).toBe(false);
    expect(affordable.classList.contains("cursor-default")).toBe(false);
    expect(expensive.classList.contains("hand-card-unplayable")).toBe(true);
  });

  it("visibly acknowledges an unaffordable rejection while muted and clears it afterwards", () => {
    const wasMuted = audioState.muted;
    audioState.muted = true;
    mutateRunForTest((draft) => {
      setBattleActiveForTest(draft, true);
      setScreen(draft, "battle");
    });
    using _scopeCleanup = createCleanup(() => (audioState.muted = wasMuted));

    renderHand();
    const expensive = screen.getByRole("button", { name: "Play Meteor" });
    const affordable = screen.getByRole("button", { name: "Play Slash" });
    act(() => battlePresentation.getState().rejectCardPlay(getHandCardKey(expensiveCard, 1), true));
    expect(expensive.classList.contains("card-play-rejected")).toBe(true);
    expect(affordable.classList.contains("card-play-rejected")).toBe(false);
    act(() => battlePresentation.getState().resetPresentation());
    expect(expensive.classList.contains("card-play-rejected")).toBe(false);
  });
});

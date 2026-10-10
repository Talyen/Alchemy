import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/features/alchemy/shared/ui/cards/card-button", () => ({
  BattleCardButton: ({
    ariaLabel,
    className,
    scaleOnHover,
  }: {
    ariaLabel: string;
    className: string;
    scaleOnHover: boolean;
  }) => <button type="button" aria-label={ariaLabel} className={className} data-scale-on-hover={scaleOnHover} />,
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

const affordableCard: BattleCard = {
  id: "slash",
  title: "Slash",
  descriptionLines: ["Deal damage."],
  art: "",
  cost: 1,
  effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
  uid: 1,
};

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

  it("keeps playable cards colored and interactive during transfers", () => {
    battlePresentation.setState({ cardTransferInProgress: true });
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
    try {
      renderHand();
      const expensive = screen.getByRole("button", { name: "Play Meteor" });
      const affordable = screen.getByRole("button", { name: "Play Slash" });
      act(() =>
        battlePresentation.setState({ cardRejection: { cardKey: getHandCardKey(expensiveCard, 1), mana: true } }),
      );
      expect(expensive.classList.contains("card-play-rejected")).toBe(true);
      expect(affordable.classList.contains("card-play-rejected")).toBe(false);
      act(() => battlePresentation.setState({ cardRejection: null }));
      expect(expensive.classList.contains("card-play-rejected")).toBe(false);
    } finally {
      audioState.muted = wasMuted;
    }
  });

  it("overlays stun presentation on hand cards while the player is crowd-controlled", () => {
    const battleState = {
      ...defaultBattleState(),
      turnPhase: "player" as const,
      mana: 2,
      wishOptions: null,
      hand: [affordableCard, expensiveCard],
      playerCC: { stunSkipTurns: 1, freezeSkipTurns: 0, cooldown: 0 },
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

    render(
      <BattleHand
        presentation={battlePresentation}
        view={view}
        refs={refs}
        actions={actions}
        playabilityState={battleState}
      />,
    );

    expect(screen.getAllByTestId("combatant-status-effect")).toHaveLength(2);
  });
});

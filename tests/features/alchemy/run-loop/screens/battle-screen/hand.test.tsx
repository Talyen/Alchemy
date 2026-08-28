import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { BattleHand } from "@/features/alchemy/run-loop/screens/battle-screen/hand";
import type {
  BattleActionsProps,
  BattleRefsProps,
  RequiredBattleViewProps,
} from "@/features/alchemy/run-loop/screens/battle-screen/types";
import { defaultBattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";

vi.mock("@/features/alchemy/shared/ui/card-button", () => ({
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

  return render(<BattleHand view={view} refs={refs} actions={actions} playabilityState={battleState} />);
}

describe("BattleHand", () => {
  afterEach(() => {
    cleanup();
    useBattlePresentationStore.getState().resetPresentation();
  });

  it("keeps genuinely playable cards colored while a transfer blocks interaction", () => {
    useBattlePresentationStore.setState({ cardTransferInProgress: true });
    renderHand();

    const affordable = screen.getByRole("button", { name: "Play Slash" });
    const expensive = screen.getByRole("button", { name: "Play Meteor" });

    expect(affordable.classList.contains("grayscale")).toBe(false);
    expect(affordable.classList.contains("cursor-default")).toBe(true);
    expect(expensive.classList.contains("grayscale")).toBe(true);
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

    render(<BattleHand view={view} refs={refs} actions={actions} playabilityState={battleState} />);

    expect(screen.getAllByTestId("combatant-status-effect")).toHaveLength(2);
  });
});

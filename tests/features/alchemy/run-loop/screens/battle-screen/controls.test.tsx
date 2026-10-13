import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { battlePresentation } from "@/app/battle-presentation";
import { BattleBottomBar } from "@/features/alchemy/run-loop/screens/battle-screen/controls";
import type {
  BattleActionsProps,
  BattleRefsProps,
  RequiredBattleViewProps,
} from "@/features/alchemy/run-loop/screens/battle-screen/types";
import type { BattleSnapshot } from "@/lib/battle";
import { makeTestBattleState } from "../../../../../fixtures/battle";
import { makeTestCard } from "../../../../../fixtures/cards";

vi.mock("@/features/alchemy/run-loop/screens/battle-screen/hand", () => ({ BattleHand: () => null }));
vi.mock("@/features/alchemy/run-loop/screens/battle-screen/boss-lyrics", () => ({ BossLyrics: () => null }));
vi.mock("@/features/alchemy/run-loop/battle/presentation/ui/resources", () => ({
  ManaPanel: () => null,
  PilePanel: () => null,
}));

const card = makeTestCard({ cost: 1, effects: [{ kind: "damage", damageType: "physical", amount: 6 }] });

function bottomBar(state: BattleSnapshot, onEndTurn: () => void) {
  return (
    <BattleBottomBar
      presentation={battlePresentation}
      view={{ battleState: state } as unknown as RequiredBattleViewProps}
      refs={{ drawPileRef: { current: null }, discardPileRef: { current: null } } as BattleRefsProps}
      actions={{ onEndTurn } as BattleActionsProps}
      playabilityState={state}
    />
  );
}

afterEach(() => {
  cleanup();
  battlePresentation.getState().resetPresentation();
});

describe("End Turn confirmation", () => {
  it("requires a second activation while cards remain playable and consumes the confirmation", () => {
    const onEndTurn = vi.fn();
    render(bottomBar(makeTestBattleState({ hand: [card], mana: 1 }), onEndTurn));

    fireEvent.click(screen.getByRole("button", { name: "End Turn" }));
    expect(onEndTurn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onEndTurn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "End Turn" })).toBeTruthy();
  });

  it.each([
    { hand: [], mana: 1 },
    { hand: [card], mana: 0 },
    { hand: [makeTestCard({ cost: 0, effects: [{ kind: "remove-harmful-status", amount: 1 }] })], mana: 1 },
  ])("ends immediately when the hand has no legal play: %j", (overrides) => {
    const onEndTurn = vi.fn();
    render(bottomBar(makeTestBattleState(overrides), onEndTurn));
    fireEvent.click(screen.getByRole("button", { name: "End Turn" }));
    expect(onEndTurn).toHaveBeenCalledTimes(1);
  });

  it("requires fresh confirmation after leaving the button, playing a card, or starting another turn", () => {
    const onEndTurn = vi.fn();
    const state = makeTestBattleState({ hand: [card, card], mana: 2 });
    const { rerender } = render(bottomBar(state, onEndTurn));
    fireEvent.click(screen.getByRole("button", { name: "End Turn" }));
    fireEvent.blur(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "End Turn" }));
    expect(onEndTurn).not.toHaveBeenCalled();

    const afterPlay = { ...state, hand: [card], mana: 1 };
    rerender(bottomBar(afterPlay, onEndTurn));
    fireEvent.click(screen.getByRole("button", { name: "End Turn" }));
    expect(onEndTurn).not.toHaveBeenCalled();
    rerender(bottomBar({ ...afterPlay, turnPhase: "enemy" }, onEndTurn));
    fireEvent.click(screen.getByRole("button", { name: "End Turn" }));
    rerender(bottomBar({ ...state }, onEndTurn));
    fireEvent.click(screen.getByRole("button", { name: "End Turn" }));
    expect(onEndTurn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onEndTurn).toHaveBeenCalledTimes(1);
  });

  it("blocks both activations during card transfers", () => {
    const onEndTurn = vi.fn();
    render(bottomBar(makeTestBattleState({ hand: [card], mana: 1 }), onEndTurn));
    act(() => battlePresentation.setState({ cardTransferInProgress: true }));
    fireEvent.click(screen.getByRole("button", { name: "End Turn" }));
    expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
    act(() => battlePresentation.setState({ cardTransferInProgress: false }));
    fireEvent.click(screen.getByRole("button", { name: "End Turn" }));
    act(() => battlePresentation.setState({ cardTransferInProgress: true }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onEndTurn).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import "../../../helpers/mock-audio";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMysteryEventNavigation } from "@/features/alchemy/shell/use-mystery-event-navigation";
import { resetAllTestStores } from "../../../helpers/gameplay-store-test";
import { setRunProgress } from "../../../helpers/run-domain-store-test";
import { readRunSession, readActiveRun } from "@/features/alchemy/shared/stores/run-session-read-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import {
  setMysteryCardChoices,
  setMysteryPendingRemoval,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";

function renderMysteryNav() {
  const navigateTo = vi.fn((_screen: Screen, onCommit?: () => void) => onCommit?.());
  const hook = renderHook(() => useMysteryEventNavigation({ navigateTo }));
  return { hook, navigateTo };
}

beforeEach(() => {
  resetAllTestStores();
});

describe("mystery transactional guards", () => {
  it("chooseCard rejects cardId not in offered choices", () => {
    const { hook } = renderMysteryNav();
    const offered = cardLibrary.slice(0, 3);
    act(() => {
      dispatchRunSessionCommand((draft) => {
        setMysteryCardChoices(draft, offered);
      });
    });
    const beforeDeck = readActiveRun().runDeck.length;
    let result: boolean | undefined;
    act(() => {
      result = hook.result.current.handleMysteryChooseCard("non-offered-id");
    });
    expect(result).toBe(false);
    expect(readActiveRun().runDeck).toHaveLength(beforeDeck);
    expect(readRunSession().mysteryCardChoices).not.toBeNull();
    expect(readRunSession().mysteryChosenCardId).toBeNull();
  });

  it("chooseCard accepts offered card and is idempotent on duplicate", () => {
    const { hook } = renderMysteryNav();
    const offered = cardLibrary.slice(0, 3);
    const offeredId = offered[0].id;
    act(() => {
      dispatchRunSessionCommand((draft) => {
        setMysteryCardChoices(draft, offered);
      });
    });
    let first: boolean | undefined;
    act(() => {
      first = hook.result.current.handleMysteryChooseCard(offeredId);
    });
    expect(first).toBe(true);
    expect(readRunSession().mysteryChosenCardId).toBe(offeredId);
    expect(readRunSession().mysteryCardChoices).toBeNull();
    let second: boolean | undefined;
    act(() => {
      second = hook.result.current.handleMysteryChooseCard(offeredId);
    });
    expect(second).toBe(false);
  });

  it("removeCard rejects fractional, NaN, out-of-range and keeps pendingRemoval", () => {
    const { hook } = renderMysteryNav();
    setRunProgress({ runDeck: [cardLibrary[0] as BattleCard, cardLibrary[1] as BattleCard] });
    act(() => {
      dispatchRunSessionCommand((draft) => {
        setMysteryPendingRemoval(draft, true);
      });
    });
    expect(readRunSession().mysteryPendingRemoval).toBe(true);
    let result: boolean | undefined;
    act(() => {
      result = hook.result.current.handleMysteryRemoveCard(0.5 as unknown as number);
    });
    expect(result).toBe(false);
    expect(readRunSession().mysteryPendingRemoval).toBe(true);
    act(() => {
      result = hook.result.current.handleMysteryRemoveCard(NaN);
    });
    expect(result).toBe(false);
    act(() => {
      result = hook.result.current.handleMysteryRemoveCard(10);
    });
    expect(result).toBe(false);
    expect(readActiveRun().runDeck).toHaveLength(2);
  });

  it("removeCard succeeds for valid index and clears pending", () => {
    const { hook } = renderMysteryNav();
    const initialDeck = [cardLibrary[0] as BattleCard, cardLibrary[1] as BattleCard];
    setRunProgress({ runDeck: initialDeck });
    act(() => {
      dispatchRunSessionCommand((draft) => {
        setMysteryPendingRemoval(draft, true);
      });
    });
    let result: boolean | undefined;
    act(() => {
      result = hook.result.current.handleMysteryRemoveCard(0);
    });
    expect(result).toBe(true);
    expect(readActiveRun().runDeck).toHaveLength(1);
    expect(readRunSession().mysteryPendingRemoval).toBe(false);
    // Duplicate should be no-op
    act(() => {
      result = hook.result.current.handleMysteryRemoveCard(0);
    });
    expect(result).toBe(false);
  });

  it("removeCard is no-op when not pending", () => {
    const { hook } = renderMysteryNav();
    setRunProgress({ runDeck: [cardLibrary[0] as BattleCard] });
    act(() => {
      dispatchRunSessionCommand((draft) => {
        setMysteryPendingRemoval(draft, false);
      });
    });
    let result: boolean | undefined;
    act(() => {
      result = hook.result.current.handleMysteryRemoveCard(0);
    });
    expect(result).toBe(false);
  });
});

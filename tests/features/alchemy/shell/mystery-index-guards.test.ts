import "../../../helpers/mock-audio";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMysteryEventNavigation } from "@/features/alchemy/run-loop/navigation/mystery-event-navigation";
import { resetAllTestStores } from "../../../helpers/run-domain-store-test";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setMysteryCardChoices } from "@/features/alchemy/shared/stores/run-session-write-port";
import { cardLibrary } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";
import { readActivityData } from "@/lib/active-run-session";
function renderMysteryNav() {
  const navigateTo = vi.fn((_screen: Screen, onCommit?: () => void) => onCommit?.());
  const hook = renderHook(() => createMysteryEventNavigation({ navigateTo }));
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
    expect(readActivityData(readRunSession().activity, "mystery").mysteryCardChoices).not.toBeNull();
    expect(readActivityData(readRunSession().activity, "mystery").mysteryChosenCardId).toBeNull();
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
    expect(readActivityData(readRunSession().activity, "mystery").mysteryChosenCardId).toBe(offeredId);
    expect(readActivityData(readRunSession().activity, "mystery").mysteryCardChoices).toBeNull();
    let second: boolean | undefined;
    act(() => {
      second = hook.result.current.handleMysteryChooseCard(offeredId);
    });
    expect(second).toBe(false);
  });
});

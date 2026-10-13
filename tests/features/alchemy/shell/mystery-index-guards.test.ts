import "../../../helpers/mock-audio";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMysteryEventNavigation } from "@/features/alchemy/run-loop/navigation/mystery-event-navigation";
import { resetAllTestStores, setRunProgress } from "../../../helpers/run-domain-store-test";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setMysteryCardChoices, setMysteryEvent } from "@/features/alchemy/shared/stores/run-session-write-port";
import { cardLibrary } from "@/lib/game-data";
import type { Screen } from "@/lib/routing";
import { readActivityData } from "@/lib/active-run-session";
import { applyLabyrinthMysteryModifiers } from "@/lib/content-systems/labyrinth/room-rules";
import { mysteryPool } from "@/lib/mystery/pool";
import { defaultGameSession } from "@/app/application-session";

const act = (fn: () => void) => fn();
function renderMysteryNav() {
  const navigateTo = vi.fn((_screen: Screen, onCommit?: () => void) => onCommit?.());
  const nav = createMysteryEventNavigation({ navigateTo }, defaultGameSession);
  return { hook: { result: { current: nav } }, navigateTo };
}

beforeEach(() => {
  resetAllTestStores();
});

describe("mystery transactional guards", () => {
  it("reports Restful Discovery's actual healing instead of the uncapped promise", () => {
    setRunProgress({ runPlayerHealth: 29, runMaxHealth: 30 });
    const event = applyLabyrinthMysteryModifiers(
      mysteryPool.find((entry) => entry.id === "locked-treatise")!,
      ["restful-discovery"],
      30,
    );
    dispatchRunSessionCommand((draft) => acceptCommand(setMysteryEvent(draft, event)), undefined, defaultGameSession);
    const choice = readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryEvent!.choices[0]!;
    renderMysteryNav().hook.result.current.handleMysteryChoice(choice);
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(30);
    expect(
      readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenChoice!.effects,
    ).toContainEqual({
      kind: "healHealth",
      amount: 1,
    });
    expect(choice.effects).toContainEqual(expect.objectContaining({ kind: "healHealth", amount: 5 }));
  });

  it("chooseCard rejects cardId not in offered choices", () => {
    const { hook } = renderMysteryNav();
    const offered = cardLibrary.slice(0, 3);
    act(() => {
      dispatchRunSessionCommand(
        (draft) => {
          setMysteryCardChoices(draft, offered);

          return acceptCommand();
        },
        undefined,
        defaultGameSession,
      );
    });
    const beforeDeck = readActiveRun(defaultGameSession).runDeck.length;
    let result: boolean | undefined;
    act(() => {
      result = hook.result.current.handleMysteryChooseCard("non-offered-id");
    });
    expect(result).toBe(false);
    expect(readActiveRun(defaultGameSession).runDeck).toHaveLength(beforeDeck);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryCardChoices).not.toBeNull();
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenCardId).toBeNull();
  });

  it("chooseCard accepts offered card and is idempotent on duplicate", () => {
    const { hook } = renderMysteryNav();
    const offered = cardLibrary.slice(0, 3);
    const offeredId = offered[0].id;
    act(() => {
      dispatchRunSessionCommand(
        (draft) => {
          setMysteryCardChoices(draft, offered);

          return acceptCommand();
        },
        undefined,
        defaultGameSession,
      );
    });
    let first: boolean | undefined;
    act(() => {
      first = hook.result.current.handleMysteryChooseCard(offeredId);
    });
    expect(first).toBe(true);
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryChosenCardId).toBe(
      offeredId,
    );
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryCardChoices).toBeNull();
    let second: boolean | undefined;
    act(() => {
      second = hook.result.current.handleMysteryChooseCard(offeredId);
    });
    expect(second).toBe(false);
  });
});

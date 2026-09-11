import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDeckInspectionVisible, useCardInspection } from "@/app/use-card-inspection";
import { useUiStore } from "@/features/alchemy/shared/stores/ui-store";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { makeTestCard } from "../fixtures/battle";
import { resetAllTestStores } from "../helpers/gameplay-store-test";

const base = {
  screen: "battle" as const,
  screenInteractive: true,
  returnToRunScreen: null,
  isCardPlayInProgress: () => false,
  gameMenuOpen: false,
  boonInspectOpen: false,
  closeOtherOverlays: vi.fn(),
};

beforeEach(() => {
  resetAllTestStores();
  useBattlePresentationStore.getState().resetPresentation();
  dispatchRunSessionCommand((draft) => {
    draft.session.activity = { kind: "idle" };
    draft.battle.hasActiveBattle = true;
    draft.battle.battleState.enemyHealth = 30;
    draft.battle.battleState.playerHealth = 30;
    draft.battle.battleState.turnPhase = "player";
  });
});
afterEach(cleanup);

describe("run card inspection", () => {
  it("limits icon visibility to the draft, run, and its meta detours", () => {
    expect(isDeckInspectionVisible("draft-deck", false, null)).toBe(true);
    expect(isDeckInspectionVisible("rewards", true, null)).toBe(true);
    expect(isDeckInspectionVisible("armory", true, "battle")).toBe(true);
    expect(isDeckInspectionVisible("armory", true, null)).toBe(false);
    expect(isDeckInspectionVisible("armory", true, "run-victory")).toBe(false);
    expect(isDeckInspectionVisible("menu", true, "battle")).toBe(false);
    expect(isDeckInspectionVisible("character-select", true, "battle")).toBe(false);
    expect(isDeckInspectionVisible("run-victory", true, null)).toBe(false);
  });

  it("inspects independent run and battle collections without changing gameplay", () => {
    const consumed = makeTestCard({ id: "apple", uid: 1, consume: true });
    const drawn = makeTestCard({ id: "slash", uid: 2 });
    const generated = makeTestCard({ id: "block", uid: 3 });
    dispatchRunSessionCommand((draft) => {
      draft.run.activeRun.runDeck = [consumed, drawn];
      draft.battle.battleState.deck = [drawn];
      draft.battle.battleState.discard = [generated];
    });
    const before = readGameplayState();
    const { result } = renderHook(() => useCardInspection(base));
    act(() => result.current.onOpen("discard"));
    expect(result.current.selected).toBe("discard");
    expect(result.current.collections.map((collection) => collection.cards.map((card) => card.id))).toEqual([
      ["apple", "slash"],
      ["slash"],
      ["block"],
    ]);
    act(() => result.current.close());
    expect(readGameplayState()).toBe(before);
  });

  it.each(["enemy", "wish", "transition", "transfer", "dead", "card-play"])(
    "rejects inspection during %s",
    (reason) => {
      dispatchRunSessionCommand((draft) => {
        if (reason === "enemy") draft.battle.battleState.turnPhase = "enemy";
        if (reason === "wish") draft.battle.battleState.wishOptions = [makeTestCard()];
        if (reason === "transition") draft.battle.pendingBattleTransition = { kind: "continue-end-turn" };
        if (reason === "dead") {
          draft.battle.battleState.playerHealth = 0;
          draft.battle.battleState.deathsDoorActive = false;
        }
      });
      if (reason === "transfer") useBattlePresentationStore.setState({ cardTransferInProgress: true });
      const { result } = renderHook(() =>
        useCardInspection({ ...base, isCardPlayInProgress: () => reason === "card-play" }),
      );
      act(() => result.current.onOpen("deck"));
      expect(result.current.open).toBe(false);
    },
  );

  it("closes when navigating or when another overlay opens", () => {
    const { result, rerender } = renderHook((props) => useCardInspection(props), { initialProps: { ...base } });
    act(() => result.current.onOpen("deck"));
    expect(result.current.open).toBe(true);
    rerender({ ...base, gameMenuOpen: true });
    expect(result.current.open).toBe(false);
    rerender(base);
    act(() => result.current.onOpen("deck"));
    act(() =>
      dispatchRunSessionCommand((draft) => {
        draft.battle.hasActiveBattle = false;
      }),
    );
    expect(useUiStore.getState().cardInspection).toBeNull();
  });
});

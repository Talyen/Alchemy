import { readRunSession } from "@/features/alchemy/shared/stores/session/run-reads";
import {
  setRunProgressActivity,
  setShopState,
  setScreen,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { useRunScreenData } from "@/features/alchemy/shared/stores/react/use-run-screen-data";
import { teardownRun } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { emptyShopState } from "@/lib/active-run-session";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  mutateRunForTest,
  resetAllTestStores,
  setRunProgress,
  setRunSession,
} from "../../../../../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";
import { abandonCurrentRun } from "@/features/alchemy/run-loop/run/run-end-commands";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { cardById } from "@/lib/game-data";

beforeEach(() => {
  resetAllTestStores();
});

describe("screen-specific run data hooks", () => {
  it.each(["campaign", "wildwood"] as const)(
    "retains the %s draft choices while ending the run",
    (contentSystemType) => {
      const choices = [cardById.slash!];
      setRunProgress({ characterId: "wildcard", contentSystemType, runDeck: [] });
      setRunSession({
        hasActiveRun: true,
        activity: { kind: "draft-deck" },
        starterDraftChoices: contentSystemType === "campaign" ? choices : null,
        wildwoodDraft:
          contentSystemType === "wildwood"
            ? { ...createInitialWildwoodDraftState("wildcard", () => 0.5), draftChoices: choices }
            : null,
      });
      const { result } = renderHook(() => useRunScreenData("draft-deck"));
      const outgoing = result.current;
      act(() => {
        expect(abandonCurrentRun(defaultGameSession)).toBe(true);
      });
      expect(readRunSession(defaultGameSession).activity.kind).toBe("inactive");
      expect(result.current).toBe(outgoing);
      expect(result.current.starterDraftChoices ?? result.current.wildwoodDraft?.draftChoices).toEqual(choices);
    },
  );

  it.each(["game-over", "run-victory"] as const)("retains the %s summary while teardown clears the run", (screen) => {
    setRunSession({ runEndTalentXP: { physical: 25 }, runEndLabyrinthFloor: 7 });
    mutateRunForTest((draft) => setScreen(draft, screen));
    const { result } = renderHook(() => useRunScreenData("game-over"));
    const shown = result.current;
    act(() => teardownRun(defaultGameSession));
    expect(readRunSession(defaultGameSession).runEndTalentXP).toEqual({});
    expect(result.current).toBe(shown);
    expect(result.current.runEndLabyrinthFloor).toBe(7);
  });

  it("retains the selected map room while entering an encounter", () => {
    setRunSession({ activity: { kind: "labyrinth-map" }, selectedLabyrinthNodeId: "room-1" });
    const { result } = renderHook(() => useRunScreenData("labyrinth-map"));
    act(() => {
      mutateRunForTest((draft) => setShopState(draft, emptyShopState()));
      setRunSession({ selectedLabyrinthNodeId: null });
    });
    expect(readRunSession(defaultGameSession).selectedLabyrinthNodeId).toBeNull();
    expect(result.current.selectedLabyrinthNodeId).toBe("room-1");
  });
  it("preserves selective subscriptions for an active screen", () => {
    setRunSession({ activity: { kind: "shop", data: emptyShopState() } });
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useRunScreenData("shop");
    });

    act(() => {
      setRunSession({ selectedLabyrinthNodeId: "unrelated-map-preview" });
    });

    expect(renders).toBe(1);
  });
  it("holds the outgoing shelf without tracking later writes, then reads a fresh visit", () => {
    setRunProgress({ gold: 42 });
    setRunSession({ hasActiveRun: true, activity: { kind: "shop", data: emptyShopState() } });
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useRunScreenData("shop");
    });
    act(() => mutateRunForTest((draft) => setShopState(draft, { ...emptyShopState(), refreshesLeft: 0 })));
    const outgoing = result.current;
    act(() => mutateRunForTest((draft) => setRunProgressActivity(draft, "destination")));
    expect(readRunSession(defaultGameSession).activity).toMatchObject({
      kind: "destination",
      data: { destinations: [] },
    });
    expect(result.current).toBe(outgoing);
    expect(result.current.shopState.refreshesLeft).toBe(0);
    const inactiveRenders = renders;
    act(() => setRunProgress({ gold: 99 }));
    expect(result.current).toBe(outgoing);
    expect(result.current.gold).toBe(42);
    expect(renders).toBe(inactiveRenders);

    act(() => mutateRunForTest((draft) => setShopState(draft, emptyShopState())));
    expect(result.current).not.toBe(outgoing);
    expect(result.current.shopState.refreshesLeft).toBe(emptyShopState().refreshesLeft);
    expect(result.current.gold).toBe(99);
  });
});

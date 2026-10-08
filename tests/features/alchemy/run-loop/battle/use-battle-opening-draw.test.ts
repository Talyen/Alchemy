import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { createBattleCapabilities } from "@/features/alchemy/shared/stores/battle-commands";
import { createBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { useBattleOpeningDraw } from "@/features/alchemy/run-loop/battle/use-battle-opening-draw";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { battlePresentation } from "@/app/battle-presentation";
import { makeTestBattleState, makeTestCardWithId } from "../../../../fixtures/battle";
import { initializeBattleForTest } from "../../../../helpers/run-domain-store-test";
import { makeDrawSequenceDeps } from "./turn-orchestration-fixture";
import { installImmediateRafForTests } from "./battle-test-reset";

installImmediateRafForTests();

it("starts opening playback when its injected store becomes ready, even with the application store unarmed", async () => {
  const session = createGameSession();
  const presentation = createBattlePresentationStore(session);
  const state = makeTestBattleState({
    hand: Array.from({ length: 4 }, (_, uid) => makeTestCardWithId(`card-${uid}`, { uid })),
  });
  dispatchRunSessionCommand(
    (tx) => {
      initializeBattleForTest(tx, state);
      return acceptCommand();
    },
    undefined,
    session,
  );
  const drawDeps = makeDrawSequenceDeps({ animateDrawnHand: vi.fn(async () => {}) });
  const ctx = {
    battle: createBattleCapabilities(session),
    playback: { id: 3, completeAction: vi.fn(), scheduleAutoEndTurn: vi.fn() },
    presentation,
    getPresentation: presentation.getState,
    battleSceneRef: { current: document.createElement("div") },
    drawPileRef: { current: document.createElement("div") },
  };
  battlePresentation.getState().setOpeningDrawPending(false);
  const { unmount } = renderHook(() =>
    useBattleOpeningDraw({
      ctx,
      transferDeps: { getDrawSequenceDeps: () => drawDeps },
      hasActiveBattle: true,
      screen: "battle",
      playbackBound: true,
    }),
  );
  try {
    expect(drawDeps.animateDrawnHand).not.toHaveBeenCalled();
    act(() => presentation.getState().setOpeningDrawPending(true));
    await vi.waitFor(() => expect(ctx.playback.completeAction).toHaveBeenCalledWith(3));
    expect(drawDeps.animateDrawnHand).toHaveBeenCalledOnce();
    expect(ctx.playback.scheduleAutoEndTurn).toHaveBeenCalledWith(ctx.battle.read().battleState);
    expect(presentation.getState().openingDrawPending).toBe(false);
    expect(battlePresentation.getState().openingDrawPending).toBe(false);
  } finally {
    unmount();
    await session.dispose();
  }
});

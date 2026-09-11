import { beforeEach, describe, expect, it, vi } from "vitest";
import { playBattleOpeningDraw } from "@/features/alchemy/run-loop/battle/battle-init";
import { defaultBattleState } from "@/lib/battle";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { makeTestCardWithId } from "../../../../fixtures/battle";
import { makeDrawSequenceDeps } from "./turn-orchestration-fixture";
import { installImmediateRafForTests } from "./battle-test-reset";

const scheduleAutoEndTurn = vi.fn();
const initial = {
  ...defaultBattleState(),
  hand: Array.from({ length: 4 }, (_, uid) => makeTestCardWithId(`card-${uid}`, { uid })),
};
let domain = { battleState: initial };

vi.mock("@/features/alchemy/shared/stores/run-reads", () => ({ readBattle: () => domain }));

describe("opening hand playback", () => {
  installImmediateRafForTests();
  beforeEach(() => {
    domain = { battleState: initial };
    useBattlePresentationStore.getState().resetPresentation();
    useBattlePresentationStore.getState().setOpeningDrawPending(true);
    scheduleAutoEndTurn.mockClear();
  });

  it("animates the already committed hand once and enables playback only after it settles", async () => {
    let finishAnimation!: () => void;
    const drawDeps = makeDrawSequenceDeps({
      animateDrawnHand: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishAnimation = resolve;
          }),
      ),
    });
    const ctx = { battleSessionRef: { current: 3 }, scheduleAutoEndTurnRef: { current: scheduleAutoEndTurn } };
    const transfers = { getDrawSequenceDeps: () => drawDeps };
    const playback = playBattleOpeningDraw(ctx, transfers);
    await vi.waitFor(() => expect(drawDeps.animateDrawnHand).toHaveBeenCalledOnce());
    expect(useBattlePresentationStore.getState().openingDrawPending).toBe(false);
    expect(await playBattleOpeningDraw(ctx, transfers)).toBe(false);
    expect(scheduleAutoEndTurn).not.toHaveBeenCalled();
    expect(domain.battleState).toBe(initial);
    domain = { battleState: { ...initial, hand: initial.hand.slice(1), mana: 2 } };
    finishAnimation();
    await playback;
    expect(scheduleAutoEndTurn).toHaveBeenCalledWith(domain.battleState);
  });
});

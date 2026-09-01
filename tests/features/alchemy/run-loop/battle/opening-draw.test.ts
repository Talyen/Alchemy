import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBattleOpeningDraw } from "@/features/alchemy/run-loop/battle/opening-draw";
import { defaultBattleState } from "@/lib/battle";
import { makeTestCardWithId } from "../../../../fixtures/battle";
import { makeDrawSequenceDeps, makePresentationPort } from "./turn-orchestration-fixture";
import { installImmediateRafForTests } from "./battle-test-reset";

const commitBattleTransition = vi.fn();
const presentation = makePresentationPort();
const scheduleAutoEndTurn = vi.fn();
const resultState = {
  ...defaultBattleState(),
  hand: Array.from({ length: 4 }, (_, uid) => makeTestCardWithId(`card-${uid}`, { uid })),
};
let domain: {
  battleState: ReturnType<typeof defaultBattleState>;
  pendingBattleTransition: { kind: "opening-draw"; resultState: typeof resultState } | null;
} = {
  battleState: defaultBattleState(),
  pendingBattleTransition: { kind: "opening-draw" as const, resultState },
};

vi.mock("@/features/alchemy/shared/stores/run-reads", () => ({
  readBattle: () => domain,
}));

vi.mock("@/features/alchemy/shared/stores/run-session-command", () => ({
  dispatchRunSessionCommand: (execute: (draft: unknown) => unknown) => execute({}),
}));

vi.mock("@/features/alchemy/shared/stores/run-session-write-port", () => ({
  commitBattleTransition: (_draft: unknown, ...args: unknown[]) => commitBattleTransition(...args),
}));

describe("createBattleOpeningDraw", () => {
  installImmediateRafForTests();

  beforeEach(() => {
    domain = {
      battleState: defaultBattleState(),
      pendingBattleTransition: { kind: "opening-draw", resultState },
    };
    commitBattleTransition.mockClear();
    scheduleAutoEndTurn.mockClear();
  });

  it("commits and animates the pending opening hand before enabling playback", async () => {
    const drawDeps = makeDrawSequenceDeps();
    const openingDraw = createBattleOpeningDraw(
      {
        battleSessionRef: { current: 3 },
        scheduleAutoEndTurnRef: { current: scheduleAutoEndTurn },
        getPresentation: () => presentation,
      } as never,
      { getDrawSequenceDeps: () => drawDeps } as never,
    );

    await openingDraw.playOpeningDraw();

    expect(commitBattleTransition).toHaveBeenCalledWith(resultState, null);
    expect(drawDeps.animateDrawnHand).toHaveBeenCalledWith(resultState.hand, resultState.hand, 3);
    expect(drawDeps.setTransferInProgress).toHaveBeenCalledWith(true);
    expect(drawDeps.setTransferInProgress).toHaveBeenLastCalledWith(false);
    expect(scheduleAutoEndTurn).toHaveBeenCalledWith(resultState);
  });

  it("finishes playback after the committed transition clears the pending draw", async () => {
    let finishAnimation: (() => void) | undefined;
    const drawDeps = makeDrawSequenceDeps({
      animateDrawnHand: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishAnimation = resolve;
          }),
      ),
    });
    commitBattleTransition.mockImplementationOnce(() => {
      domain = { ...domain, pendingBattleTransition: null };
    });
    const openingDraw = createBattleOpeningDraw(
      {
        battleSessionRef: { current: 3 },
        scheduleAutoEndTurnRef: { current: scheduleAutoEndTurn },
        getPresentation: () => presentation,
      } as never,
      { getDrawSequenceDeps: () => drawDeps } as never,
    );

    const playback = openingDraw.playOpeningDraw();

    await vi.waitFor(() => expect(drawDeps.animateDrawnHand).toHaveBeenCalledOnce());
    expect(domain.pendingBattleTransition).toBeNull();
    expect(scheduleAutoEndTurn).not.toHaveBeenCalled();

    finishAnimation?.();
    await playback;

    expect(scheduleAutoEndTurn).toHaveBeenCalledWith(resultState);
  });
});

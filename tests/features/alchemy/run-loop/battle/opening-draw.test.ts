import { beforeEach, describe, expect, it, vi } from "vitest";
import { playBattleOpeningDraw } from "@/features/alchemy/run-loop/battle/battle-init";
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

describe("playBattleOpeningDraw", () => {
  installImmediateRafForTests();

  beforeEach(() => {
    domain = {
      battleState: defaultBattleState(),
      pendingBattleTransition: { kind: "opening-draw", resultState },
    };
    commitBattleTransition.mockReset();
    commitBattleTransition.mockImplementation(() => {
      domain = { battleState: resultState, pendingBattleTransition: null };
    });
    scheduleAutoEndTurn.mockClear();
  });

  it("commits and animates the pending opening hand before enabling playback", async () => {
    const drawDeps = makeDrawSequenceDeps();
    const ctx = {
      battleSessionRef: { current: 3 },
      scheduleAutoEndTurnRef: { current: scheduleAutoEndTurn },
      getPresentation: () => presentation,
    } as never;
    const transferDeps = { getDrawSequenceDeps: () => drawDeps } as never;

    await playBattleOpeningDraw(ctx, transferDeps);

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
      domain = { battleState: resultState, pendingBattleTransition: null };
    });
    const ctx = {
      battleSessionRef: { current: 3 },
      scheduleAutoEndTurnRef: { current: scheduleAutoEndTurn },
      getPresentation: () => presentation,
    } as never;
    const transferDeps = { getDrawSequenceDeps: () => drawDeps } as never;

    const playback = playBattleOpeningDraw(ctx, transferDeps);

    await vi.waitFor(() => expect(drawDeps.animateDrawnHand).toHaveBeenCalledOnce());
    expect(domain.pendingBattleTransition).toBeNull();
    expect(scheduleAutoEndTurn).not.toHaveBeenCalled();

    domain = { ...domain, battleState: { ...resultState, hand: resultState.hand.slice(1), mana: 2 } };
    finishAnimation?.();
    await playback;

    expect(scheduleAutoEndTurn).toHaveBeenCalledWith(domain.battleState);
  });
});

import "../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRunFlow } from "@/features/alchemy/run-loop/run/run-flow";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../helpers/run-domain-store-test";
import { makeFlowHandlerDeps } from "../../../helpers/run-flow-handler-deps";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { createWildwoodGauntletFlow } from "@/features/alchemy/run-loop/run/wildwood-gauntlet-flow";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { cardById } from "@/lib/game-data";
describe("Wildwood reward selection", () => {
  beforeEach(() => {
    resetRunDomainStore();
  });

  it("rejects an invalid reward without changing the Wildwood draft", () => {
    const wildwoodDraft = {
      ...createInitialWildwoodDraftState("knight", () => 0.5),
      phase: "reward" as const,
    };
    setRunProgress({ contentSystemType: CONTENT_SYSTEMS.WILDWOOD });
    setRunSession({
      activity: { kind: "rewards" },
      wildwoodDraft,
      rewardState: createEmptyRewardState(),
    });

    createRunFlow(makeFlowHandlerDeps()).claimRewardChoice("slash");

    expect(readRunSession().rewardState.selectedId).toBeNull();
    expect(readRunSession().wildwoodDraft).toEqual(wildwoodDraft);
  });
  it("commits removal and the next boss once without waiting for a rendered screen", () => {
    setRunProgress({
      contentSystemType: CONTENT_SYSTEMS.WILDWOOD,
      runDeck: Array.from({ length: 9 }, (_, uid) => ({ ...cardById["slash"]!, uid })),
    });
    setRunSession({
      hasActiveRun: true,
      activity: { kind: "wildwood-removal" },
      wildwoodDraft: { ...createInitialWildwoodDraftState("knight", () => 0.5), phase: "removal" },
    });
    const startBoss = vi.fn(() => true);
    const flow = createWildwoodGauntletFlow({
      navigateTo: vi.fn(),
      onStartBossById: startBoss,
      setHasActiveBattle: vi.fn(),
      clearCardHover: vi.fn(),
    });
    flow.handleWildwoodRemoveCard(0);
    expect(readActiveRun().runDeck.map((card) => card.uid)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(readRunSession().wildwoodDraft?.phase).toBe("battle");
    const snapshot = snapshotRun();
    flow.handleWildwoodRemoveCard(0);
    expect(startBoss).toHaveBeenCalledOnce();
    expect(readActiveRun().rng).toEqual(snapshot.rng);
    restoreRun(snapshot, {}, {});
    expect(readRunSession().wildwoodDraft).toEqual(snapshot.wildwoodDraft);
    expect(readRunSession().activity.kind).toBe("battle");
    expect(readActiveRun().runDeck).toEqual(snapshot.runDeck);
  });
});

import "../../../helpers/mock-audio";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRunFlow } from "@/features/alchemy/run-loop/run/run-flow";
import { createEmptyRewardState } from "@/lib/active-run-session";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { readActiveRun, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../helpers/run-domain-store-test";
import { makeFlowHandlerDeps } from "../../../helpers/run-flow-handler-deps";
import { CONTENT_SYSTEMS } from "@/lib/content-systems/types";
import { ROUTE_SCREENS } from "@/lib/routing";
import { createBattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import { createWildwoodGauntletFlow } from "@/features/alchemy/run-loop/run/wildwood-gauntlet-flow";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { prepareWildwoodRemoval } from "@/features/alchemy/run-loop/run/wildwood-commands";
import { cardById } from "@/lib/game-data";
import { defaultGameSession } from "@/app/application-session";
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

    createRunFlow(makeFlowHandlerDeps(), defaultGameSession).claimRewardChoice("slash");

    expect(readRunSession(defaultGameSession).rewardFlow.state.selectedId).toBeNull();
    expect(readRunSession(defaultGameSession).wildwoodDraft).toEqual(wildwoodDraft);
  });
  it("makes Wildwood removal resumable before its screen is shown", () => {
    setRunProgress({
      contentSystemType: CONTENT_SYSTEMS.WILDWOOD,
      runDeck: Array.from({ length: 9 }, (_, uid) => ({ ...cardById["slash"]!, uid })),
    });
    setRunSession({
      activity: { kind: "rewards" },
      wildwoodDraft: { ...createInitialWildwoodDraftState("knight", () => 0.5), phase: "reward" },
    });
    prepareWildwoodRemoval(defaultGameSession);
    expect(readRunSession(defaultGameSession).activity.kind).toBe("wildwood-removal");
    const save = snapshotRun(undefined, defaultGameSession);
    expect(save.currentScreen).toBe("wildwood-removal");
    restoreRun(save, {}, {}, defaultGameSession);
    expect(readRunSession(defaultGameSession).activity.kind).toBe("wildwood-removal");
    expect(readRunSession(defaultGameSession).wildwoodDraft?.phase).toBe("removal");
    expect(readActiveRun(defaultGameSession).rng).toEqual(save.rng);
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
    const startBoss = vi.fn(createBattleStartCommands(() => {}, defaultGameSession).startBossById);
    const flow = createWildwoodGauntletFlow(
      {
        navigateTo: vi.fn(),
        resumeTo: vi.fn(),
        startBossById: startBoss,
        clearCardHover: vi.fn(),
      },
      defaultGameSession,
    );
    flow.handleWildwoodRemoveCard(0);
    expect(readActiveRun(defaultGameSession).runDeck.map((card) => card.uid)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(readRunSession(defaultGameSession).wildwoodDraft?.phase).toBe("battle");
    const snapshot = snapshotRun(undefined, defaultGameSession);
    flow.handleWildwoodRemoveCard(0);
    expect(startBoss).toHaveBeenCalledOnce();
    expect(readActiveRun(defaultGameSession).rng).toEqual(snapshot.rng);
    restoreRun(snapshot, {}, {}, defaultGameSession);
    expect(readRunSession(defaultGameSession).wildwoodDraft).toEqual(snapshot.wildwoodDraft);
    expect(readRunSession(defaultGameSession).activity.kind).toBe("battle");
    expect(readActiveRun(defaultGameSession).runDeck).toEqual(snapshot.runDeck);
  });

  it("uses the resume route when recreating a pending Wildwood battle", () => {
    setRunSession({
      hasActiveRun: true,
      wildwoodDraft: {
        ...createInitialWildwoodDraftState("knight", () => 0.5),
        phase: "battle",
        currentBossId: "forge-golem",
        currentCombatTraitIds: ["tempered"],
      },
    });
    const navigateTo = vi.fn();
    const resumeTo = vi.fn();
    const startBossById = vi.fn(() => true);
    const flow = createWildwoodGauntletFlow(
      { navigateTo, resumeTo, startBossById, clearCardHover: vi.fn() },
      defaultGameSession,
    );

    flow.resumeWildwoodRun();

    expect(startBossById).toHaveBeenCalledWith({ bossId: "forge-golem", wildwoodModifierId: "tempered" });
    expect(resumeTo).toHaveBeenCalledExactlyOnceWith(ROUTE_SCREENS.BATTLE);
    expect(navigateTo).not.toHaveBeenCalled();
  });
});

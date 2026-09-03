import { beforeEach, describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { createRunRngState } from "@/lib/rng";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { initializeActiveBattle } from "@/features/alchemy/shared/stores/run-session-write-port";
import { resumePendingBattleTransition } from "@/features/alchemy/run-loop/battle/resume-transition";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { makeTestCardWithId } from "../../../../fixtures/battle";
import { resetRunDomainStore } from "../../../../helpers/gameplay-store-test";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";
import { makeBattleTurnSession, makeTurnOrchestration } from "./turn-orchestration-fixture";

beforeEach(() => {
  resetRunDomainStore();
});

describe("legacy enemy-phase resume RNG", () => {
  it("recovers a playable hand from the world stream without drawing the resting rng", () => {
    setRunProgress({ rng: createRunRngState(() => 42 / 0x1_0000_0000), initialized: true });
    const worldBefore = readGameplayState().run.activeRun.rng.counters.world;
    const discard = [1, 2, 3, 4].map((uid) => makeTestCardWithId("slash", { uid }));
    const enemyPhase = {
      ...defaultBattleState(),
      turnPhase: "enemy" as const,
      hand: [],
      deck: [],
      discard,
    };

    dispatchRunSessionCommand((draft) => initializeActiveBattle(draft, enemyPhase, { kind: "legacy-enemy-turn" }));

    expect(() => readGameplayState().battle.battleState.rng()).toThrow(/withDraftWorldBattleRng/);

    const battleSession = makeBattleTurnSession();
    resumePendingBattleTransition(1, battleSession, makeTurnOrchestration(), () => false);

    const recovered = readGameplayState().battle.battleState;
    expect(recovered.turnPhase).toBe("player");
    expect(recovered.hand.length).toBeGreaterThan(0);
    expect(readGameplayState().run.activeRun.rng.counters.world).toBeGreaterThan(worldBefore);
    expect(readGameplayState().battle.pendingBattleTransition).toBeNull();
    expect(battleSession.checkBattleEnd).toHaveBeenCalledOnce();
  });
});

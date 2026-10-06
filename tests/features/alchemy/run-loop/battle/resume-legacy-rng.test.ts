import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultBattleState } from "@/lib/battle";
import { createRunRngState } from "@/lib/rng";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { restoreActiveBattle as initializeActiveBattle } from "@/features/alchemy/shared/stores/battle-restore";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { makeTestCardWithId } from "../../../../fixtures/battle";
import { resetRunDomainStore } from "../../../../helpers/run-domain-store-test";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  resetRunDomainStore();
});

describe("continue-end-turn resume RNG", () => {
  it("recovers a playable hand from the world stream without drawing the resting rng", () => {
    setRunProgress({ rng: createRunRngState(() => 42 / 0x1_0000_0000), initialized: true });
    const worldBefore = readGameplayState(defaultGameSession).run.activeRun.rng.counters.world;
    const discard = [1, 2, 3, 4].map((uid) => makeTestCardWithId("slash", { uid }));
    const enemyPhase = {
      ...defaultBattleState(),
      turnPhase: "enemy" as const,
      hand: [],
      deck: [],
      discard,
    };

    dispatchGameplayCommand(
      (draft) => acceptCommand(initializeActiveBattle(draft, enemyPhase, { kind: "continue-end-turn" })),
      undefined,
      defaultGameSession,
    );

    expect(readBattle(defaultGameSession).battleState).not.toHaveProperty("rng");

    const recovered = readBattle(defaultGameSession).battleState;
    expect(recovered.turnPhase).toBe("player");
    expect(recovered.hand.length).toBeGreaterThan(0);
    expect(readGameplayState(defaultGameSession).run.activeRun.rng.counters.world).toBeGreaterThan(worldBefore);
    expect(readBattle(defaultGameSession)).not.toHaveProperty("pendingBattleTransition");
  });
});

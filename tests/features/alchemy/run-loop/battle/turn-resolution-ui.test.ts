import "../../../../helpers/mock-audio";

import { initializeBattleForTest as initializeActiveBattle } from "../../../../helpers/run-domain-store-test";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { beforeEach, describe, expect, it } from "vitest";
import { resolveBattleTurn } from "@/lib/battle";
import { companionLibrary } from "@/lib/game-data";
import { commitEndTurn } from "@/features/alchemy/run-loop/battle/battle-session";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";

import { resetRunDomainStore } from "../../../../helpers/run-domain-store-test";
import { patchBattleState, slashDeck, seededRng } from "../../../../fixtures/battle";
import { createBattleCapabilities } from "@/features/alchemy/shared/stores/battle-commands";
import { defaultGameSession } from "@/app/application-session";

beforeEach(resetRunDomainStore);

describe("resolved turns", () => {
  it("resolves a skipped enemy turn and the Companion before returning serializable playback", () => {
    const before = patchBattleState({
      playerHealth: 1000,
      playerMaxHealth: 1000,
      enemyHealth: 1000,
      enemyMaxHealth: 1000,
      deck: slashDeck(20),
      enemyCC: { stunSkipTurns: 1 },
      activeCompanion: companionLibrary.wolf,
    });
    const first = resolveBattleTurn(before, { rng: seededRng(24) });
    expect(first.state.turnPhase).toBe("player");
    expect(first.frames[0]?.turn.kind).toBe("skipped");
    expect(first.frames.at(-1)?.companion?.id).toBe("wolf");
    expect(first.frames.slice(0, -1).every((frame) => frame.companion === null)).toBe(true);
    expect(structuredClone(first)).toEqual(first);
    expect(resolveBattleTurn(before, { rng: seededRng(24) })).toEqual(first);
    expect(before.turn).toBe(1);
  });

  it("does not run the Companion after fatal enemy damage", () => {
    const before = patchBattleState({
      playerHealth: 1,
      deathsDoorUsed: true,
      activeCompanion: companionLibrary.wolf,
      enemyHealth: 1000,
      enemyMaxHealth: 1000,
      currentEnemy: { abilityIds: ["slash", "stab", "bash"] },
    });
    const result = resolveBattleTurn(before, { rng: () => 0.99 });
    expect(result.state.playerHealth).toBe(0);
    expect(result.frames.every((frame) => frame.companion === null)).toBe(true);
  });

  it("commits a Haste turn without leaving a logical continuation for its draw animation", () => {
    dispatchGameplayCommand(
      (draft) =>
        acceptCommand(
          initializeActiveBattle(draft, patchBattleState({ playerStatuses: { haste: 1 }, deck: slashDeck(8) })),
        ),
      undefined,
      defaultGameSession,
    );
    const result = commitEndTurn(createBattleCapabilities(defaultGameSession));
    if (!result) throw new Error("Expected a committed turn");
    expect(result.frames[0]?.turn.kind).toBe("haste");
    expect(readBattle(defaultGameSession)).not.toHaveProperty("pendingBattleTransition");
    expect(readBattle(defaultGameSession).battleState).toEqual(result.state);
  });
});

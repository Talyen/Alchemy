import "../../../../helpers/mock-audio";
import "../../../../helpers/mock-flush-save";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { endPlayerTurn } from "@/lib/battle";
import { toActiveRunData } from "@/lib/active-run-session";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { ActiveRunDataSchema } from "@/lib/validation/save-schemas/active-run";
import { getDifficultyXPMultiplier } from "@/lib/game-data";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { initializeActiveBattle, finalizeRunXP } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActiveRun, readBattle, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { snapshotRun, restoreRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { persistEnemyTurnTransition } from "@/features/alchemy/run-loop/battle/enemy-phase";
import { resumePendingBattleTransition } from "@/features/alchemy/run-loop/battle/resume-transition";
import { incomingPhysical } from "../../../../fixtures/battle";
import { resetRunDomainStore, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { makeBattleTurnSession, makeTurnOrchestration } from "./turn-orchestration-fixture";

beforeEach(() => {
  resetRunDomainStore();
  setRunProgress({ characterId: "knight", initialized: true });
  setRunSession({ hasActiveRun: true });
});

describe("Dodge XP commits", () => {
  it("awards each packet once before presentation and does not repeat it on save/resume", () => {
    const state = incomingPhysical({
      rng: () => 0,
      playerDodgeCount: 4,
      enemyAttackEffects: [
        { kind: "damage", damageType: "physical", amount: 1 },
        { kind: "damage", damageType: "physical", amount: 1 },
      ],
    });
    dispatchRunSessionCommand((draft) => initializeActiveBattle(draft, state));
    const result = endPlayerTurn(state);
    if (result.kind === "haste") throw new Error("Expected an enemy turn");
    dispatchRunSessionCommand((draft) => persistEnemyTurnTransition(draft, result, state));
    expect(readActiveRun().runTalentXP.dodge).toBe(2);
    expect(readBattle().battleState.playerDodgeCount).toBe(4);
    expect(readBattle().pendingBattleTransition?.kind).toBe("enemy-turn");

    const save = ActiveRunDataSchema.parse(JSON.parse(JSON.stringify(snapshotRun("battle"))));
    resetRunDomainStore();
    restoreRun(toActiveRunData(save), {}, {});
    expect(readActiveRun().runTalentXP.dodge).toBe(2);
    const resolveEndTurn = vi.fn(() => false);
    resumePendingBattleTransition(1, makeBattleTurnSession(), makeTurnOrchestration(), resolveEndTurn);
    expect(readBattle().battleState.playerDodgeCount).toBe(6);
    expect(readActiveRun().runTalentXP.dodge).toBe(2);
    resumePendingBattleTransition(1, makeBattleTurnSession(), makeTurnOrchestration(), resolveEndTurn);
    expect(readActiveRun().runTalentXP.dodge).toBe(2);
    expect(resolveEndTurn).not.toHaveBeenCalled();

    const multiplier = getDifficultyXPMultiplier(readActiveRun().selectedDifficulty);
    dispatchRunSessionCommand((draft) => finalizeRunXP(draft));
    expect(readRunProfile().talentXP.dodge).toBe(Math.round(2 * multiplier));
    expect(readActiveRun().runTalentXP).toEqual({});
  });

  it("awards a Dodge whose Riposte ends combat", () => {
    const state = incomingPhysical({
      rng: () => 0,
      enemyHealth: 1,
      talentEffects: { physicalOnDodgeEqualToAttack: true },
    });
    const result = endPlayerTurn(state);
    if (result.kind === "haste") throw new Error("Expected an enemy turn");
    expect(result.state.enemyHealth).toBe(0);
    dispatchRunSessionCommand((draft) => persistEnemyTurnTransition(draft, result, state));
    expect(readActiveRun().runTalentXP.dodge).toBe(1);
    expect(readBattle().pendingBattleTransition).toBeNull();
  });

  it("rolls XP back together with a failed battle command", () => {
    const state = incomingPhysical({ rng: () => 0 });
    const result = endPlayerTurn(state);
    if (result.kind === "haste") throw new Error("Expected an enemy turn");
    expect(() =>
      dispatchRunSessionCommand((draft) => {
        persistEnemyTurnTransition(draft, result, state);
        throw new Error("abort");
      }),
    ).toThrow("abort");
    expect(readActiveRun().runTalentXP.dodge).toBeUndefined();
  });
});

describe("Dodge battle save defaults", () => {
  it("backfills old saves and retains valid new counters without losing existing effects", () => {
    const state = incomingPhysical({ playerDodgeCount: 7, dodgeChanceFromDamage: 25, gearEffects: { dodgeChance: 3 } });
    const wire = JSON.parse(JSON.stringify(state));
    const restored = PersistedBattleStateSchema.parse(wire);
    expect(restored).toMatchObject({ playerDodgeCount: 7, dodgeChanceFromDamage: 25, gearEffects: { dodgeChance: 3 } });
    delete wire.playerDodgeCount;
    delete wire.dodgeChanceFromDamage;
    delete wire.talentEffects.dodgeChance;
    const legacy = PersistedBattleStateSchema.parse(wire);
    expect(legacy).toMatchObject({ playerDodgeCount: 0, dodgeChanceFromDamage: 0, talentEffects: { dodgeChance: 0 } });
    expect(legacy.gearEffects.dodgeChance).toBe(3);
  });
});

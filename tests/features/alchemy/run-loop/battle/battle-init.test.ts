import { describe, expect, it, beforeEach, vi } from "vitest";
import { createBattleInit } from "@/features/alchemy/run-loop/battle/battle-init";
import * as battleFeedback from "@/features/alchemy/run-loop/battle/battle-feedback";
import * as controllerUtils from "@/features/alchemy/run-loop/battle/controller-utils";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { computeTalentEffects } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { enemyBestiary } from "@/lib/game-data";
import { makeRunController, makeTalentController } from "../../../../helpers/run-controller";
import { resetRunBattleSlice, resetRunProgressSlice, setRunProgress } from "../../../../helpers/run-domain-store-test";
import { readActiveRun, readBattle } from "@/features/alchemy/shared/stores/run-session-read-port";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import type { HomesteadEffectManifest } from "@/lib/homestead/types";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { createRunRngState } from "@/lib/run-rng";

beforeEach(() => {
  resetRunBattleSlice();
  resetRunProgressSlice();
});

describe("createBattleInit", () => {
  const resetBattleSession = vi.fn();

  function makeInit(homesteadEffects: HomesteadEffectManifest = defaultHomesteadEffects) {
    const ctx = {
      run: makeRunController(),
      talents: makeTalentController(),
      homesteadEffects,
      getPresentation: () => useBattlePresentationStore.getState(),
    } as unknown as BattleControllerContext;

    const session = {
      resetBattleSession,
    } as unknown as ReturnType<typeof createBattleSession>;

    return createBattleInit(ctx, session);
  }

  it("merges talent and homestead manifests into battle state", () => {
    setRunProgress({ roomsEncountered: 0, runPlayerHealth: 30, runMaxHealth: 30 });
    const testEffects = { ...defaultHomesteadEffects, flatPhysicalDamage: 2 };

    makeInit(testEffects).startBattle(readActiveRun().runDeck, 0, "normal");

    const battle = readBattle().battleState;
    const expected = mergeIntoManifest(computeTalentEffects({}), testEffects);
    expect(battle.talentEffects.flatPhysicalDamage).toBe(expected.flatPhysicalDamage);
    expect(battle.currentEnemy.enemyType).toBe("normal");
    // createBattleInit must wire a resting rng callback (draws happen via withDraftWorldBattleRng).
    expect(typeof battle.rng).toBe("function");
    expect(() => battle.rng()).toThrow(/withDraftWorldBattleRng/);
  });

  it("beginBattle increments roomsEncountered and sets hasActiveBattle", () => {
    setRunProgress({ roomsEncountered: 2, runPlayerHealth: 25, runMaxHealth: 30 });

    makeInit().startBattle(readActiveRun().runDeck, 10, "normal");

    const enemyId = readBattle().battleState.currentEnemy.id;
    expect(readActiveRun().roomsEncountered).toBe(3);
    expect(readBattle().hasActiveBattle).toBe(true);
    expect(readBattle().pendingTransitionResumeRequired).toBe(false);
    expect(readBattle().battleState.hand).toEqual([]);
    expect(readBattle().pendingBattleTransition).toEqual(
      expect.objectContaining({
        kind: "opening-draw",
        resultState: expect.objectContaining({ hand: expect.any(Array) }),
      }),
    );
    const pending = readBattle().pendingBattleTransition;
    expect(pending?.kind === "opening-draw" ? pending.resultState.hand.length : 0).toBeGreaterThan(0);
    expect(useBattlePresentationStore.getState().cardTransferInProgress).toBe(true);
    expect(readActiveRun().encounteredRunEnemyIds).toContain(enemyId);
    expect(resetBattleSession).toHaveBeenCalled();
  });

  it("appendUnique avoids duplicate encountered enemy ids", () => {
    const skeleton = enemyBestiary.find((e) => e.id === "skeleton")!;
    setRunProgress({
      encounteredRunEnemyIds: [skeleton.id],
      roomsEncountered: 1,
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });

    makeInit().startBattle(readActiveRun().runDeck, 0, "normal");

    const ids = readActiveRun().encounteredRunEnemyIds;
    expect(ids.filter((id) => id === skeleton.id)).toHaveLength(1);
  });

  it("appends the persisted Wildwood combat trait to a boss encounter", () => {
    makeInit().startBossById("forge-golem", undefined, "tempered");

    expect(readBattle().battleState.currentEnemy.traits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "tempered",
          description: "Gains 1 Forge each turn",
        }),
      ]),
    );
  });

  it("reads live run state when a battle starts inside another command", () => {
    const templateCard = readActiveRun().runDeck[0]!;
    setRunProgress({
      runDeck: [{ ...templateCard, id: "stale-card" }],
      gold: 3,
      roomsEncountered: 1,
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });
    const init = makeInit();
    const freshCard = { ...templateCard, id: "fresh-card" };

    setRunProgress({ runDeck: [freshCard], gold: 27, roomsEncountered: 4 });
    init.startBossById("forge-golem");

    const battle = readBattle().battleState;
    expect([...battle.hand, ...battle.deck, ...battle.discard, ...battle.exhausted].map((card) => card.id)).toEqual([
      "fresh-card",
    ]);
    expect(battle.gold).toBe(27);
    expect(readActiveRun().roomsEncountered).toBe(5);
  });

  it("applies companion turn-start effects when a battle starts with a companion", () => {
    setRunProgress({
      roomsEncountered: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      rng: createRunRngState(() => 42 / 0x1_0000_0000),
    });
    makeInit().startBattle(readActiveRun().runDeck, 0, "normal", [{ kind: "start-companion" }]);

    const battle = readBattle().battleState;
    expect(battle.activeCompanion?.id).toBe("wolf");
    expect(battle.enemyHealth).toBeLessThan(battle.enemyMaxHealth);
  });

  it("plays combat-text sounds and portrait feedback for companion damage at battle start", () => {
    const sounds = vi.spyOn(controllerUtils, "playCombatTextSounds");
    const feedback = vi.spyOn(battleFeedback, "applyCombatTextShakeFeedback");
    setRunProgress({
      roomsEncountered: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      rng: createRunRngState(() => 42 / 0x1_0000_0000),
    });
    makeInit().startBattle(readActiveRun().runDeck, 0, "normal", [{ kind: "start-companion" }]);

    expect(sounds).toHaveBeenCalled();
    expect(feedback).toHaveBeenCalled();
    const texts = sounds.mock.calls[0]?.[0] ?? [];
    expect(texts.some((ct) => ct.kind === "damage" && ct.target === "enemy")).toBe(true);
  });
});

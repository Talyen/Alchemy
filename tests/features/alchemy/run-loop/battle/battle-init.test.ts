import { PlaybackLifetime } from "@/features/alchemy/run-loop/battle/playback-lifetime";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { createBattleInit } from "@/features/alchemy/run-loop/battle/battle-init";
import * as controllerUtils from "@/features/alchemy/run-loop/battle/controller-utils";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { computeTalentEffects } from "@/lib/game-data";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { enemyBestiary } from "@/lib/game-data";
import { resetRunDomainStore, setRunSession, setRunProgress } from "../../../../helpers/run-domain-store-test";
import { readActiveRun, readBattle, readRunRevision } from "@/features/alchemy/shared/stores/run-reads";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import type { BattleControllerContext } from "@/features/alchemy/run-loop/battle/battle-context";
import type { createBattleSession } from "@/features/alchemy/run-loop/battle/battle-session";
import { createRunRngState } from "@/lib/rng";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { createBattleCapabilities } from "@/features/alchemy/shared/stores/battle-commands";
import { defaultGameSession } from "@/app/application-session";

beforeEach(() => {
  resetRunDomainStore();
  setRunSession({ hasActiveRun: true });
});

describe("createBattleInit", () => {
  const resetBattleSession = vi.fn();
  const prepareBattleSessionForStart = vi.fn();

  function makeInit() {
    const ctx = {
      battle: createBattleCapabilities(defaultGameSession),
      playback: new PlaybackLifetime(),
      getPresentation: () => useBattlePresentationStore.getState(),
    } as unknown as BattleControllerContext;

    const session = {
      resetBattleSession,
      prepareBattleSessionForStart,
    } as unknown as ReturnType<typeof createBattleSession>;

    return createBattleInit(ctx, session);
  }

  it("derives current talent and homestead manifests from the battle-start draft", () => {
    setRunProgress({ roomsEncountered: 0, runPlayerHealth: 30, runMaxHealth: 30 });
    const testEffects = { ...defaultHomesteadEffects, flatPhysicalDamage: 2 };
    const init = makeInit();
    dispatchGameplayCommand(
      (draft) => {
        draft.runProfile.effects = testEffects;

        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );

    init.startBattle({ enemyType: "normal" });

    const battle = readBattle(defaultGameSession).battleState;
    const expected = mergeIntoManifest(computeTalentEffects({}), testEffects);
    expect(battle.talentEffects.flatPhysicalDamage).toBe(expected.flatPhysicalDamage);
    expect(battle.currentEnemy.enemyType).toBe("normal");

    expect(battle).not.toHaveProperty("rng");
  });

  it("beginBattle increments roomsEncountered and sets hasActiveBattle", () => {
    setRunProgress({ roomsEncountered: 2, runPlayerHealth: 25, runMaxHealth: 30 });

    makeInit().startBattle({ enemyType: "normal" });

    const enemyId = readBattle(defaultGameSession).battleState.currentEnemy.id;
    expect(readActiveRun(defaultGameSession).roomsEncountered).toBe(3);
    expect(readBattle(defaultGameSession).hasActiveBattle).toBe(true);
    expect(readBattle(defaultGameSession)).not.toHaveProperty("pendingTransitionResumeRequired");
    expect(readBattle(defaultGameSession).battleState.hand.length).toBeGreaterThan(0);
    expect(readBattle(defaultGameSession)).not.toHaveProperty("pendingBattleTransition");
    expect(useBattlePresentationStore.getState().openingDrawPending).toBe(true);
    expect(useBattlePresentationStore.getState().cardTransferInProgress).toBe(true);
    expect(readActiveRun(defaultGameSession).encounteredRunEnemyIds).toContain(enemyId);
    expect(prepareBattleSessionForStart).toHaveBeenCalled();
  });

  it("uses the live purse while honoring explicit enemy and empty difficulty overrides", () => {
    setRunProgress({ gold: 27, selectedDifficulty: "difficulty-3" });
    makeInit().startBattle({
      enemyType: "normal",
      modifiers: [],
      enemyId: "skeleton",
    });
    const battle = readBattle(defaultGameSession).battleState;
    expect(battle.currentEnemy.id).toBe("skeleton");
    expect(battle.gold).toBe(27);
    expect(battle.difficultyModifiers).toEqual([]);
  });

  it.each(["forge-golem", "skeleton", "unknown-enemy"])("starts a boss with the optional enemy %s", (enemyId) => {
    makeInit().startBossBattle({ enemyId });
    const battle = readBattle(defaultGameSession).battleState;
    expect(battle.currentEnemy.enemyType).toBe("boss");
    if (enemyId === "forge-golem") expect(battle.currentEnemy.id).toBe(enemyId);
  });

  it("rejects an unknown explicit boss without committing or starting presentation", () => {
    const before = readBattle(defaultGameSession);
    const run = readActiveRun(defaultGameSession);
    const revision = readRunRevision(defaultGameSession);
    const presentationCalls = prepareBattleSessionForStart.mock.calls.length;
    expect(makeInit().startBossById({ bossId: "unknown-boss" })).toBe(false);
    expect(readBattle(defaultGameSession)).toEqual(before);
    expect(readActiveRun(defaultGameSession)).toEqual(run);
    expect(readRunRevision(defaultGameSession)).toBe(revision);
    expect(prepareBattleSessionForStart).toHaveBeenCalledTimes(presentationCalls);
  });

  it("appendUnique avoids duplicate encountered enemy ids", () => {
    const skeleton = enemyBestiary.find((e) => e.id === "skeleton")!;
    setRunProgress({
      encounteredRunEnemyIds: [skeleton.id],
      roomsEncountered: 1,
      runPlayerHealth: 30,
      runMaxHealth: 30,
    });

    makeInit().startBattle({ enemyType: "normal" });

    const ids = readActiveRun(defaultGameSession).encounteredRunEnemyIds;
    expect(ids.filter((id) => id === skeleton.id)).toHaveLength(1);
  });

  it("appends the persisted Wildwood combat trait to a boss encounter", () => {
    makeInit().startBossById({ bossId: "forge-golem", wildwoodModifierId: "tempered" });

    expect(readBattle(defaultGameSession).battleState.currentEnemy.traits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "tempered",
          description: "Enemy gains 1 Forge each turn",
        }),
      ]),
    );
  });

  it.each(["normal", "boss"] as const)("reads live run state when starting a %s battle", (kind) => {
    const templateCard = readActiveRun(defaultGameSession).runDeck[0]!;
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
    if (kind === "boss") init.startBossById({ bossId: "forge-golem" });
    else init.startBattle({ enemyId: "skeleton" });

    const battle = readBattle(defaultGameSession).battleState;
    expect([...battle.hand, ...battle.deck, ...battle.discard, ...battle.exhausted].map((card) => card.id)).toEqual([
      "fresh-card",
    ]);
    expect(battle.gold).toBe(27);
    expect(readActiveRun(defaultGameSession).roomsEncountered).toBe(5);
  });

  it("applies companion turn-start effects when a battle starts with a companion", () => {
    setRunProgress({
      roomsEncountered: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      rng: createRunRngState(() => 42 / 0x1_0000_0000),
    });
    makeInit().startBattle({
      enemyType: "normal",
      modifiers: [{ kind: "start-companion" }],
    });

    const battle = readBattle(defaultGameSession).battleState;
    expect(battle.activeCompanion?.id).toBe("wolf");
    expect(battle.enemyHealth).toBeLessThan(battle.enemyMaxHealth);
  });

  it("plays combat-text sounds and portrait feedback for companion damage at battle start", () => {
    const feedback = vi.spyOn(controllerUtils, "presentCombatTexts");
    setRunProgress({
      roomsEncountered: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      rng: createRunRngState(() => 42 / 0x1_0000_0000),
    });
    makeInit().startBattle({
      enemyType: "normal",
      modifiers: [{ kind: "start-companion" }],
    });

    expect(feedback).toHaveBeenCalled();
    expect(feedback.mock.calls[0]?.[2]).toBe("efx-int-mutt-growl-42-b-ef1caab1-0-2443.ogg");
    const texts = feedback.mock.calls[0]?.[1] ?? [];
    expect(texts.some((ct) => ct.kind === "damage" && ct.target === "enemy")).toBe(true);
  });
});

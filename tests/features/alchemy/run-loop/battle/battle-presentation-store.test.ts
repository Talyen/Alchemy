import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { COMBAT_TEXT_LANE_DELAY_MS, COMBAT_TEXT_LIFETIME_MS, SHAKE_DURATION } from "@/lib/game-constants";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { clearBattlePresentationUi, teardownRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { clearCombatPresentation } from "@/features/alchemy/run-loop/run/run-flow-session-helpers";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { getBattleStoreView, getNavigationStoreView } from "../../../../helpers/run-domain-store-test";

describe("battle-presentation-store", () => {
  beforeEach(resetBattlePresentationAndRun);
  afterEach(() => {
    useBattlePresentationStore.getState().resetPresentation();
    vi.useRealTimers();
  });

  it("initializes with empty presentation state", () => {
    const s = useBattlePresentationStore.getState();
    expect(s.cardGhosts).toEqual([]);
    expect(s.floatingCombatTexts).toEqual([]);
    expect(s.enemyShaking).toBe(false);
    expect(s.playerShaking).toBe(false);
    expect(s.companionShaking).toBe(false);
    expect(s.playerAttackToken).toBe(0);
    expect(s.enemyAttackToken).toBe(0);
    expect(s.playerCastToken).toBe(0);
    expect(s.enemyCastToken).toBe(0);
  });

  it("telegraphs cast motion and resets on resetPresentation", () => {
    useBattlePresentationStore.getState().telegraphCast("player");
    expect(useBattlePresentationStore.getState().playerCastToken).toBe(1);
    expect(useBattlePresentationStore.getState().enemyCastToken).toBe(0);

    useBattlePresentationStore.getState().telegraphCast("enemy");
    expect(useBattlePresentationStore.getState().enemyCastToken).toBe(1);

    useBattlePresentationStore.getState().resetPresentation();
    expect(useBattlePresentationStore.getState().playerCastToken).toBe(0);
    expect(useBattlePresentationStore.getState().enemyCastToken).toBe(0);
  });

  it("telegraphAttack maps companion to the player lunge token", () => {
    useBattlePresentationStore.getState().telegraphAttack("companion");
    expect(useBattlePresentationStore.getState().playerAttackToken).toBe(1);

    useBattlePresentationStore.getState().telegraphAttack("player");
    expect(useBattlePresentationStore.getState().playerAttackToken).toBe(2);
    expect(useBattlePresentationStore.getState().enemyAttackToken).toBe(0);

    useBattlePresentationStore.getState().telegraphAttack("enemy");
    expect(useBattlePresentationStore.getState().enemyAttackToken).toBe(1);
  });

  it("spawnCardGhost and removeCardGhost round-trip", () => {
    useBattlePresentationStore.getState().spawnCardGhost({
      art: "test.webp",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 0,
      delay: 0,
      variant: "activate",
    });
    const id = useBattlePresentationStore.getState().cardGhosts[0]!.id;
    useBattlePresentationStore.getState().removeCardGhost(id);
    expect(useBattlePresentationStore.getState().cardGhosts).toHaveLength(0);
  });

  it("shakeEnemy sets and clears enemyShaking", async () => {
    vi.useFakeTimers();
    useBattlePresentationStore.getState().shakeEnemy();
    expect(useBattlePresentationStore.getState().enemyShaking).toBe(true);
    await vi.advanceTimersByTimeAsync(SHAKE_DURATION);
    expect(useBattlePresentationStore.getState().enemyShaking).toBe(false);
    vi.useRealTimers();
  });

  it("restarts a shake timer so an older hit cannot clear a newer shake", async () => {
    vi.useFakeTimers();
    useBattlePresentationStore.getState().shakeEnemy();
    await vi.advanceTimersByTimeAsync(SHAKE_DURATION - 100);
    useBattlePresentationStore.getState().shakeEnemy();
    await vi.advanceTimersByTimeAsync(150);
    expect(useBattlePresentationStore.getState().enemyShaking).toBe(true);
    await vi.advanceTimersByTimeAsync(SHAKE_DURATION - 149);
    expect(useBattlePresentationStore.getState().enemyShaking).toBe(false);
    vi.useRealTimers();
  });

  it("telegraphAttack bumps the acting combatant's token and maps companion onto player", () => {
    useBattlePresentationStore.getState().telegraphAttack("player");
    useBattlePresentationStore.getState().telegraphAttack("enemy");
    useBattlePresentationStore.getState().telegraphAttack("companion");
    useBattlePresentationStore.getState().telegraphAttack("player");
    const s = useBattlePresentationStore.getState();
    expect(s.playerAttackToken).toBe(3);
    expect(s.enemyAttackToken).toBe(1);
  });

  it("resetPresentation clears VFX state", () => {
    useBattlePresentationStore.getState().hurtPlayer();
    useBattlePresentationStore.getState().telegraphAttack("player");
    useBattlePresentationStore.getState().spawnCardGhost({
      art: "test.webp",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 0,
      delay: 0,
      variant: "activate",
    });
    useBattlePresentationStore.getState().resetPresentation();
    const s = useBattlePresentationStore.getState();
    expect(s.playerHurtFlashToken).toBe(0);
    expect(s.playerAttackToken).toBe(0);
    expect(s.cardGhosts).toEqual([]);
  });

  it("teardownRun clears card ghosts via the presentation bridge", () => {
    useBattlePresentationStore.getState().spawnCardGhost({
      art: "test.webp",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 0,
      delay: 0,
      variant: "activate",
    });
    expect(useBattlePresentationStore.getState().cardGhosts).toHaveLength(1);
    teardownRun();
    expect(useBattlePresentationStore.getState().cardGhosts).toEqual([]);
  });

  it.each([clearBattlePresentationUi, clearCombatPresentation])("%s resets full presentation VFX", (clear) => {
    useBattlePresentationStore.getState().hurtPlayer();
    useBattlePresentationStore.getState().shakeEnemy();
    useBattlePresentationStore.getState().telegraphAttack("enemy");
    useBattlePresentationStore.getState().spawnCardGhost({
      art: "test.webp",
      rect: { x: 0, y: 0, width: 10, height: 10 },
      rotation: 0,
      delay: 0,
      variant: "activate",
    });
    clear();
    const s = useBattlePresentationStore.getState();
    expect(s.cardGhosts).toEqual([]);
    expect(s.playerHurtFlashToken).toBe(0);
    expect(s.enemyShaking).toBe(false);
    expect(s.playerAttackToken).toBe(0);
    expect(s.enemyAttackToken).toBe(0);
    expect(s.floatingCombatTexts).toEqual([]);
  });

  it("clearFloatingCombatTexts invalidates pending showCombatTexts timers", async () => {
    vi.useFakeTimers();
    getBattleStoreView().setHasActiveBattle(true);
    getNavigationStoreView().setScreen(ROUTE_SCREENS.BATTLE);

    useBattlePresentationStore
      .getState()
      .showCombatTexts([{ target: "enemy", kind: "damage", stat: "health", amount: 5 }]);
    useBattlePresentationStore.getState().clearFloatingCombatTexts();
    await vi.advanceTimersByTimeAsync(COMBAT_TEXT_LIFETIME_MS);
    expect(useBattlePresentationStore.getState().floatingCombatTexts).toEqual([]);
    vi.useRealTimers();
  });

  it("showCombatTexts does not add entries when not on battle screen", async () => {
    vi.useFakeTimers();
    getBattleStoreView().setHasActiveBattle(true);
    getNavigationStoreView().setScreen(ROUTE_SCREENS.COLLECTION);

    useBattlePresentationStore
      .getState()
      .showCombatTexts([{ target: "enemy", kind: "damage", stat: "health", amount: 5 }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(useBattlePresentationStore.getState().floatingCombatTexts).toEqual([]);
    vi.useRealTimers();
  });

  it("batches same-lane combat texts into one store write", async () => {
    vi.useFakeTimers();
    getBattleStoreView().setHasActiveBattle(true);
    getNavigationStoreView().setScreen(ROUTE_SCREENS.BATTLE);
    const writes: number[] = [];
    const unsubscribe = useBattlePresentationStore.subscribe((state, prev) => {
      if (state.floatingCombatTexts !== prev.floatingCombatTexts) {
        writes.push(state.floatingCombatTexts.length);
      }
    });

    useBattlePresentationStore.getState().showCombatTexts([
      { target: "enemy", kind: "damage", stat: "health", amount: 5 },
      { target: "player", kind: "heal", stat: "health", amount: 2 },
    ]);
    await vi.advanceTimersByTimeAsync(0);
    unsubscribe();
    expect(useBattlePresentationStore.getState().floatingCombatTexts).toHaveLength(2);
    expect(writes.filter((count) => count > 0)).toEqual([2]);
    vi.useRealTimers();
  });

  it("caps visible combat texts per rail", async () => {
    vi.useFakeTimers();
    getBattleStoreView().setHasActiveBattle(true);
    getNavigationStoreView().setScreen(ROUTE_SCREENS.BATTLE);

    useBattlePresentationStore.getState().showCombatTexts([
      { target: "enemy", kind: "damage", stat: "health", amount: 1 },
      { target: "enemy", kind: "damage", stat: "health", amount: 2 },
      { target: "enemy", kind: "damage", stat: "health", amount: 3 },
      { target: "enemy", kind: "damage", stat: "health", amount: 4 },
    ]);
    await vi.advanceTimersByTimeAsync(3 * COMBAT_TEXT_LANE_DELAY_MS + 1);
    const enemyTexts = useBattlePresentationStore
      .getState()
      .floatingCombatTexts.filter((text) => text.target === "enemy");
    expect(enemyTexts).toHaveLength(3);
    expect(enemyTexts.map((text) => ("amount" in text ? text.amount : undefined))).toEqual([2, 3, 4]);
    vi.useRealTimers();
  });
});

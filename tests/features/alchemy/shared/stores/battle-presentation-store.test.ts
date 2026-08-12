import { describe, expect, it, vi, beforeEach } from "vitest";
import { ROUTE_SCREENS } from "@/lib/routing";
import { SHAKE_DURATION } from "@/lib/game-constants";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { teardownRun } from "@/features/alchemy/shared/stores/run-transitions";
import {
  getBattleStoreView,
  getNavigationStoreView,
  resetRunBattleSlice,
} from "../../../../helpers/run-domain-store-test";

function freshStore() {
  useBattlePresentationStore.setState(useBattlePresentationStore.getInitialState());
  resetRunBattleSlice();
}

describe("battle-presentation-store", () => {
  beforeEach(freshStore);

  it("initializes with empty presentation state", () => {
    const s = useBattlePresentationStore.getState();
    expect(s.cardGhosts).toEqual([]);
    expect(s.floatingCombatTexts).toEqual([]);
    expect(s.enemyShaking).toBe(false);
    expect(s.playerShaking).toBe(false);
    expect(s.companionShaking).toBe(false);
    expect(s.revealedCardKeys.size).toBe(0);
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
    await vi.advanceTimersByTimeAsync(500);
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

  it("resetPresentation clears VFX state", () => {
    useBattlePresentationStore.getState().hurtPlayer();
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

  it("clearFloatingCombatTexts invalidates pending showCombatTexts timers", async () => {
    vi.useFakeTimers();
    getBattleStoreView().setHasActiveBattle(true);
    getNavigationStoreView().setScreen(ROUTE_SCREENS.BATTLE);

    useBattlePresentationStore
      .getState()
      .showCombatTexts([{ target: "enemy", kind: "damage", stat: "health", amount: 5 }]);
    useBattlePresentationStore.getState().clearFloatingCombatTexts();
    await vi.advanceTimersByTimeAsync(4000);
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
    await vi.advanceTimersByTimeAsync(400);
    const enemyTexts = useBattlePresentationStore
      .getState()
      .floatingCombatTexts.filter((text) => text.target === "enemy");
    expect(enemyTexts).toHaveLength(3);
    expect(enemyTexts.map((text) => ("amount" in text ? text.amount : undefined))).toEqual([2, 3, 4]);
    vi.useRealTimers();
  });
});

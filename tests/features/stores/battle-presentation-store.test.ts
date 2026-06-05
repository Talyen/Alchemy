import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useBattlePresentationStore } from "@/features/alchemy/shared/stores/battle-presentation-store";

function freshStore() {
  useBattlePresentationStore.setState(useBattlePresentationStore.getInitialState());
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
});

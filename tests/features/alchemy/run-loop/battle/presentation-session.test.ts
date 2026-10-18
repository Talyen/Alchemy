import { afterEach, expect, it, vi } from "vitest";
import { bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";
import { makeTestCard } from "../../../../fixtures/cards";
import type { CardTransfer } from "@/features/alchemy/shared/types";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { createBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { clearBattlePresentationUi, teardownRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setScreen } from "@/features/alchemy/shared/stores/run-session-write-port";
import { defaultBattleState } from "@/lib/battle";
import { COMBAT_TEXT_LIFETIME_MS, SHAKE_DURATION_MS } from "@/lib/game-constants";
import { initializeBattleForTest } from "../../../../helpers/run-domain-store-test";

afterEach(() => vi.useRealTimers());

it("binds visibility, clearing, teardown and timer disposal to the owning session", async () => {
  vi.useFakeTimers();
  await using firstSession = createGameSession();
  await using secondSession = createGameSession();
  const first = createBattlePresentationStore(firstSession);
  const second = createBattlePresentationStore(secondSession);
  const events = [{ target: "enemy", kind: "damage", stat: "physical", amount: 5 }] as const;

  dispatchRunSessionCommand(
    (tx) => {
      initializeBattleForTest(tx, defaultBattleState());
      setScreen(tx, "battle");
      return acceptCommand();
    },
    undefined,
    firstSession,
  );
  first.getState().showCombatTexts([...events]);
  second.getState().showCombatTexts([...events]);
  expect(first.getState().floatingCombatBursts).toHaveLength(1);
  expect(second.getState().floatingCombatBursts).toEqual([]);
  second.getState().setHiddenHandCardKeys(() => ["second-card"]);
  clearBattlePresentationUi(firstSession);
  expect(first.getState().floatingCombatBursts).toEqual([]);
  expect(second.getState().hiddenHandCardKeys).toEqual(["second-card"]);
  first.getState().setDisplayedBattle(defaultBattleState());
  teardownRun(firstSession);
  expect(first.getState().displayedBattle).toBeNull();
  expect(second.getState().hiddenHandCardKeys).toEqual(["second-card"]);
  second.getState().shakeEnemy();
  const changed = vi.fn();
  const unsubscribe = second.subscribe(changed);
  await secondSession.dispose();
  expect(changed).not.toHaveBeenCalled();
  expect(() => second.getState()).toThrow(/disposed/);
  changed.mockClear();
  await vi.advanceTimersByTimeAsync(COMBAT_TEXT_LIFETIME_MS + SHAKE_DURATION_MS);
  expect(changed).not.toHaveBeenCalled();
  unsubscribe();
});

it("revokes actions borrowed from reads and subscriber snapshots when their session closes", async () => {
  vi.useFakeTimers();
  const session = createGameSession();
  const store = createBattlePresentationStore(session);
  const borrowed = store.getState();
  let observed = borrowed;
  store.subscribe((state) => {
    observed = state;
  });
  borrowed.setCardTransferInProgress(true);
  await session.dispose();
  expect(() => borrowed.shakeEnemy()).toThrow(/disposed/);
  expect(() => observed.setCardTransferInProgress(true)).toThrow(/disposed/);
  expect(vi.getTimerCount()).toBe(0);
});

it("owns incoming playback data and publishes immutable snapshots before notifying observers", async () => {
  await using session = createGameSession();
  const store = createBattlePresentationStore(session);

  const snapshot = defaultBattleState();
  const rect = { x: 0, y: 0, width: 10, height: 10 };
  store.getState().setDisplayedBattle(snapshot);
  store.getState().spawnCardGhost({ art: "test.webp", rect, rotation: 0, delay: 0, variant: "activate" });
  const published = store.getState();
  snapshot.enemyHealth = 999;
  rect.x = 999;
  expect(published.displayedBattle?.enemyHealth).not.toBe(999);
  expect(published.cardGhosts[0]!.rect.x).toBe(0);
  expect(Reflect.set(published, "cardTransferInProgress", true)).toBe(false);
  expect(Reflect.set(published.cardGhosts[0]!.rect, "x", 999)).toBe(false);
  expect(store).not.toHaveProperty("setState");
  let frozen = false;
  store.subscribe((state) => {
    frozen = Object.isFrozen(state) && Object.isFrozen(state.cardGhosts);
  });
  published.clearCardGhosts();
  expect(frozen).toBe(true);
  expect(published.cardGhosts).toHaveLength(1);
});

it("keeps extracted presentation actions owned by their originating session", async () => {
  await using a = createGameSession();
  await using b = createGameSession();

  const foreign = createBattlePresentationStore(a).getState().setCardTransferInProgress;
  expect(() => bindSessionCapabilities(b, { transfer: foreign })).toThrow(/different game sessions/);
});

it("owns transfer inputs and updater results without allowing prior state to be edited", async () => {
  await using session = createGameSession();
  const store = createBattlePresentationStore(session);
  const transfer: CardTransfer = {
    kind: "draw",
    id: "transfer-1",
    card: makeTestCard(),
    handCardKey: "card-1",
    from: { x: 0, y: 0, width: 10, height: 10 },
    to: { x: 20, y: 0, width: 10, height: 10 },
    fromScale: 1,
    toScale: 1,
    fromRotation: 0,
    toRotation: 0,
    duration: 100,
    rotateY: [180, 0],
  };

  const transfers = [transfer];
  store.getState().setCardTransfers(transfers);
  transfer.from.x = 999;
  transfers.length = 0;
  const before = store.getState();
  expect(before.cardTransfers[0]!.from.x).toBe(0);
  expect(() =>
    store.getState().setCardTransfers((prior) => {
      prior.length = 0;
      return prior;
    }),
  ).toThrow();
  expect(store.getState()).toBe(before);
  const replacement = [{ ...transfer, id: "transfer-2" }];
  store.getState().setCardTransfers(() => replacement);
  replacement[0]!.to.x = 999;
  expect(store.getState().cardTransfers[0]!.to.x).toBe(20);
  expect(Object.isFrozen(transfer.to)).toBe(false);
});

it("delivers reentrant presentation changes in order even when an observer fails", async () => {
  await using session = createGameSession();
  const store = createBattlePresentationStore(session);
  const observed: boolean[] = [];

  store.subscribe((state) => {
    if (state.cardTransferInProgress) {
      state.setCardTransferInProgress(false);
      throw new Error("presentation observer failed");
    }
  });
  store.subscribe((state) => observed.push(state.cardTransferInProgress));
  store.getState().setCardTransferInProgress(true);
  expect(observed).toEqual([true, false]);
  expect(store.getState().cardTransferInProgress).toBe(false);
});

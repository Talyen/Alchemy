import { registerSessionCleanup } from "@/features/alchemy/shared/stores/session-capabilities";
import { createAlchemyAutosaveLifecycle } from "@/app/autosave-lifecycle";
import { snapshotCareer, stateDigest } from "@/app/playthrough/career-persistence";
import { createPlaythroughController } from "@/app/playthrough/controller";
import { cardSlotKeyOf } from "@/features/alchemy/run-loop/shop/shop-commands-core";
import { PLAYABLE_HAND_OPTIONS } from "@/features/alchemy/shared/config/battle-input";
import { createDefaultSaveData, loadAlchemySaveState } from "@/features/alchemy/shared/storage";
import { commitCardPlay, commitEndTurn } from "@/features/alchemy/shared/stores/battle-commands";
import { createGameSession, type GameSession, type SessionClock } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { onRunTeardown, teardownRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  readActiveRun,
  readBattle,
  readRunProfile,
  readRunRevision,
  readRunSession,
} from "@/features/alchemy/shared/stores/run-reads";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  rejectCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import { addGold, createDraftRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import { canPlayCard } from "@/lib/battle";
import { SAVE_KEY } from "@/lib/game-constants";
import { createScreenNavigation } from "@/features/alchemy/shell/screen-navigation";
import { showRunScreen } from "@/features/alchemy/shared/stores/navigation-commands";
import { readActiveRunScreen } from "@/features/alchemy/shared/stores/run-reads";
import type { SaveBackend } from "@/lib/platform-save-backend";
import { describe, expect, it, vi } from "vitest";

function memoryBackend() {
  const bytes = new Map<string, string>();
  let pending: (() => void) | undefined;
  let delayNext = false;
  const backend: SaveBackend = {
    readCandidates: async (key) => ({ ok: true, candidates: bytes.has(key) ? [bytes.get(key)!] : [] }),
    write: async (key, value) => {
      if (delayNext) {
        delayNext = false;
        await new Promise<void>((resolve) => {
          pending = resolve;
        });
      }
      bytes.set(key, value);
      return { ok: true };
    },
    writeSync: (key, value) => {
      bytes.set(key, value);
      return { ok: true };
    },
    clear: async () => {
      bytes.clear();
      return { ok: true };
    },
  };
  return {
    backend,
    bytes,
    delay() {
      delayNext = true;
    },
    release() {
      pending?.();
    },
  };
}

function controlledClock(now: number): SessionClock {
  let id = 0;
  return { now: () => now, setTimeout: () => ++id, clearTimeout: () => {} };
}

function start(seed: number, gold: number, backend?: SaveBackend) {
  const initialSave = createDefaultSaveData();
  initialSave.gold = gold;
  initialSave.musicVolume = seed;
  let id = 0;
  const session = createGameSession({
    initialSave,
    ...(backend ? { saveBackend: backend } : {}),
    runtimeInputs: {
      generateRunSeed: () => seed,
      createInstanceId: () => `session-${seed}-gear-${++id}`,
      clock: controlledClock(seed),
    },
  });
  const controller = createPlaythroughController(session);
  controller.flow.goToScreen("game-mode-select");
  controller.flow.beginCampaign();
  controller.flow.handleCharacterSelect("knight");
  return { session, controller };
}

function playReadyCard(session: GameSession) {
  const battle = readBattle(session).battleState;
  const index = battle.hand.findIndex((card, slot) => canPlayCard(battle, card, slot, PLAYABLE_HAND_OPTIONS));
  expect(index).toBeGreaterThanOrEqual(0);
  expect(commitCardPlay(index, battle.hand[index]!.id, session)).not.toBeNull();
}

describe("independent game sessions", () => {
  it("cancels only the owning session's deferred navigation using its injected clock", async () => {
    const create = (failCleanup = false) => {
      let id = 0;
      const callbacks = new Map<number, () => void>();
      const session = createGameSession({
        runtimeInputs: {
          clock: {
            now: () => 1,
            setTimeout: (callback) => {
              callbacks.set(++id, callback);
              return id;
            },
            clearTimeout: (timer) => {
              callbacks.delete(Number(timer));
            },
          },
        },
      });
      if (failCleanup)
        registerSessionCleanup(session, () => {
          throw new Error("Controlled cleanup failure");
        });
      const navigation = createScreenNavigation(
        {
          readScreen: () => readActiveRunScreen(session),
          showScreen: (screen) => showRunScreen(screen, session),
        },
        session,
      );
      return { session, navigation, callbacks };
    };
    const a = create(true);
    const b = create();
    try {
      a.navigation.navigateTo("game-mode-select");
      b.navigation.navigateTo("game-mode-select");
      expect(a.callbacks.size).toBe(1);
      expect(b.callbacks.size).toBe(1);
      await expect(a.session.dispose()).rejects.toThrow("Game session cleanup failed");
      expect(a.callbacks.size).toBe(0);
      expect(b.callbacks.size).toBe(1);
      for (const callback of b.callbacks.values()) callback();
      expect(readActiveRunScreen(b.session)).toBe("game-mode-select");
    } finally {
      await Promise.all([a.session.dispose().catch(() => {}), b.session.dispose()]);
    }
  });
  it("interleaves production combat, purchases and gear generation without changing another career or the application", async () => {
    const application = readGameplayState();
    const a = start(7, 1000);
    const b = start(19, 2000);
    const bCommits = vi.fn();
    subscribeRunSessionCommits(bCommits, b.session);
    try {
      expect(snapshotCareer(a.session).musicVolume).toBe(7);
      expect(snapshotCareer(b.session).musicVolume).toBe(19);
      expect(readActiveRun(a.session).rng.seed).toBe(7);
      expect(readActiveRun(b.session).rng.seed).toBe(19);
      const beforeB = stateDigest(b.session);
      playReadyCard(a.session);
      const shop = a.controller.shop().merchant;
      shop.initialize();
      const visit = readRunSession(a.session).activity;
      if (visit.kind !== "shop") throw new Error("Card Shop did not initialize");
      const card = visit.data.cards[0]!;
      const key = cardSlotKeyOf(card, 0);
      const price = shop.getCardBuyPrice(card);
      const gold = readRunProfile(a.session).gold;
      const deckSize = readActiveRun(a.session).runDeck.length;
      expect(shop.buyCard(card, key)).toBe(true);
      expect(readRunProfile(a.session).gold).toBe(gold - price);
      expect(readActiveRun(a.session).runDeck).toHaveLength(deckSize + 1);
      expect(shop.buyCard(card, key)).toBe(false);
      expect(stateDigest(b.session)).toBe(beforeB);
      expect(bCommits).not.toHaveBeenCalled();

      const beforeA = stateDigest(a.session);
      playReadyCard(b.session);
      commitEndTurn(b.session);
      expect(stateDigest(a.session)).toBe(beforeA);
      expect(bCommits).toHaveBeenCalled();

      for (const career of [a, b]) {
        career.controller.shop().equipment.initialize();
        const equipment = readRunSession(career.session).activity;
        if (equipment.kind !== "equipment-shop") throw new Error("Equipment Shop did not initialize");
        expect(equipment.data.gear.length).toBeGreaterThan(0);
        expect(
          equipment.data.gear.every((item) =>
            item.instanceId.startsWith(`session-${readActiveRun(career.session).rng.seed}-gear-`),
          ),
        ).toBe(true);
      }
      expect(readGameplayState()).toBe(application);
    } finally {
      await Promise.all([a.session.dispose(), b.session.dispose()]);
    }
  });

  it("rolls back rejected state and RNG within one instance and keeps nested-command guards instance-local", async () => {
    const a = start(3, 1000);
    const b = start(4, 2000);
    try {
      const beforeA = stateDigest(a.session);
      const revision = readRunRevision(a.session);
      dispatchRunSessionCommand(
        (draft) => {
          addGold(draft, 50);
          createDraftRunRandomSource(draft, "world")();
          dispatchRunSessionCommand((other) => acceptCommand(addGold(other, 9)), undefined, b.session);
          return rejectCommand("Controlled rejection", false);
        },
        undefined,
        a.session,
      );
      expect(stateDigest(a.session)).toBe(beforeA);
      expect(readRunRevision(a.session)).toBe(revision);
      expect(readRunProfile(b.session).gold).toBe(2009);
      expect(() =>
        dispatchRunSessionCommand(
          () => {
            dispatchRunSessionCommand(() => acceptCommand(), undefined, a.session);
            return acceptCommand();
          },
          undefined,
          a.session,
        ),
      ).toThrow(/nested command/);
      expect(stateDigest(a.session)).toBe(beforeA);
    } finally {
      await Promise.all([a.session.dispose(), b.session.dispose()]);
    }
  });

  it("keeps delayed saves, resume and disposal local while another session continues saving", async () => {
    const transportA = memoryBackend();
    const transportB = memoryBackend();
    const a = start(11, 1000, transportA.backend);
    const b = start(12, 2000, transportB.backend);
    const autosaveA = createAlchemyAutosaveLifecycle(() => true, undefined, a.session);
    const autosaveB = createAlchemyAutosaveLifecycle(() => true, undefined, b.session);
    try {
      transportA.delay();
      dispatchRunSessionCommand((draft) => acceptCommand(addGold(draft, 17)), undefined, a.session);
      const snapshotA = snapshotCareer(a.session);
      autosaveA.flush();
      await Promise.resolve();
      const disposalA = a.session.dispose();
      dispatchRunSessionCommand((draft) => acceptCommand(addGold(draft, 23)), undefined, b.session);
      await autosaveB.drain();
      expect(JSON.parse(transportB.bytes.get(SAVE_KEY)!).gold).toBe(2023);
      expect(JSON.parse(transportB.bytes.get(SAVE_KEY)!).lastSavedAt).toBe(12);
      transportA.release();
      await disposalA;
      expect(JSON.parse(transportA.bytes.get(SAVE_KEY)!).gold).toBe(snapshotA.gold);
      expect(JSON.parse(transportA.bytes.get(SAVE_KEY)!).lastSavedAt).toBe(11);
      expect(() => commitEndTurn(a.session)).toThrow(/disposed/);

      const loaded = await loadAlchemySaveState(b.session);
      expect(loaded.status.kind).toBe("ok");
      const resumed = createGameSession({ initialSave: loaded.data });
      try {
        expect(snapshotCareer(resumed)).toEqual(snapshotCareer(b.session));
      } finally {
        await resumed.dispose();
      }
    } finally {
      transportA.release();
      autosaveB.dispose(false);
      await Promise.all([a.session.dispose(), b.session.dispose()]);
    }
  });

  it("tears down and removes subscriptions for only the owning session", async () => {
    const a = start(21, 1000);
    const b = start(22, 2000);
    const aTeardown = vi.fn();
    const bTeardown = vi.fn();
    onRunTeardown(aTeardown, a.session);
    onRunTeardown(bTeardown, b.session);
    try {
      const beforeB = stateDigest(b.session);
      teardownRun(a.session);
      expect(aTeardown).toHaveBeenCalledOnce();
      expect(bTeardown).not.toHaveBeenCalled();
      expect(stateDigest(b.session)).toBe(beforeB);
      await a.session.dispose();
      teardownRun(b.session);
      expect(bTeardown).toHaveBeenCalledOnce();
      expect(aTeardown).toHaveBeenCalledOnce();
    } finally {
      await Promise.all([a.session.dispose(), b.session.dispose()]);
    }
  });
});

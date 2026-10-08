import "../../../../helpers/mock-audio";
import { afterEach, expect, it, vi } from "vitest";
import { enterRunRoom } from "@/features/alchemy/run-loop/run/room-entry-commands";
import * as shopInitialization from "@/features/alchemy/run-loop/shop/shop-initialization";
import { createGameSession, type GameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readBattle, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import { createEmptyRewardState, parseActiveRun } from "@/lib/active-run-session";
import * as battleEngine from "@/lib/battle";
import { getStartingDeck } from "@/lib/game-data";
import { DESTINATIONS, type Destination } from "@/lib/routing";
import type { LabyrinthNodeType } from "@/lib/content-systems/types";
import { gridLabyrinthMapFixture } from "../../../../fixtures/labyrinth-map";

const sessions: GameSession[] = [];
const nodeId = "labyrinth-floor-1-n0";
const cases = [
  [DESTINATIONS.NORMAL_COMBAT, "combat", "battle"],
  [DESTINATIONS.ELITE_COMBAT, "elite", "battle"],
  [DESTINATIONS.BOSS_COMBAT, "boss", "battle"],
  [DESTINATIONS.CAMPFIRE, "rest", "campfire"],
  [DESTINATIONS.TRANSMUTATION, "transmutation", "transmutation"],
  [DESTINATIONS.CARD_SHOP, "shop", "shop"],
  [DESTINATIONS.ALCHEMIST_SHOP, "alchemist", "alchemist"],
  [DESTINATIONS.TRINKET_SHOP, "trinket-shop", "trinket-shop"],
  [DESTINATIONS.GEAR_SHOP, "equipment-shop", "equipment-shop"],
  [DESTINATIONS.MYSTERY, "mystery", "mystery"],
  [DESTINATIONS.CORRUPTION, "corruption", "corruption"],
] as const;

function session(mode: "campaign" | "labyrinth", destination: Destination, nodeType: LabyrinthNodeType = "combat") {
  let instance = 0;
  const game = createGameSession({
    runtimeInputs: { generateRunSeed: () => 42, createInstanceId: () => `room-gear-${++instance}` },
  });
  sessions.push(game);
  dispatchGameplayCommand(
    (draft) => {
      draft.run.activeRun.contentSystemType = mode;
      draft.run.activeRun.runDeck = getStartingDeck("knight");
      draft.session.activity = { kind: mode === "campaign" ? "destination" : "labyrinth-map" };
      draft.session.rewardFlow.state = { ...createEmptyRewardState(), destinations: [destination] };
      if (mode === "labyrinth") {
        const map = gridLabyrinthMapFixture();
        const node =
          nodeType === "boss" ? Object.values(map.nodes).find((node) => node.type === "boss")! : map.nodes[nodeId]!;
        if (nodeType === "boss") {
          for (const other of Object.values(map.nodes)) if (other.id !== node.id) other.cleared = true;
        }
        node.type = nodeType;
        node.enemyId = nodeType === "boss" ? "forge-golem" : "goblin";
        node.modifiers = ["tempered"];
        node.rewardModifiers = ["generous"];
        draft.session.labyrinthMap = map;
        draft.session.selectedLabyrinthNodeId = node.id;
        draft.session.activeLabyrinthModifiers = ["winterborn"];
      }
      return acceptCommand();
    },
    undefined,
    game,
  );
  return game;
}

function enter(mode: "campaign" | "labyrinth", destination: Destination, game: GameSession) {
  return enterRunRoom(mode === "campaign" ? { kind: mode, destination } : { kind: mode }, game);
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(sessions.splice(0).map((game) => game.dispose()));
});

it.each(["campaign", "labyrinth"] as const)(
  "publishes complete %s rooms once and round-trips every activity through the existing save codec",
  (mode) => {
    for (const [destination, nodeType, screen] of cases) {
      const game = session(mode, destination, nodeType);
      const before = readGameplayState(game);
      const observe = vi.fn(() => snapshotRun(game));
      const unsubscribe = subscribeRunSessionCommits(observe, game);
      const result = enter(mode, destination, game);
      expect(result?.screen, destination).toBe(screen);
      const committed = readGameplayState(game);
      expect(committed.revision, destination).toBe(before.revision + 1);
      expect(observe, destination).toHaveBeenCalledOnce();
      expect(committed.run.activeRun.runHistory, destination).toEqual([
        expect.objectContaining({ destination, completed: false }),
      ]);
      if (mode === "campaign") {
        expect(committed.run.activeRun.destinationIndexInAct, destination).toBe(1);
        expect(committed.run.activeRun.completedDestinations, destination).toEqual([destination]);
        expect(committed.session.rewardFlow.state.destinations, destination).toEqual([]);
        expect(committed.session.rewardFlow.claim, destination).toEqual({ kind: "idle" });
      } else {
        expect(committed.session.activeLabyrinthPendingNode, destination).toBe(before.session.selectedLabyrinthNodeId);
        expect(committed.session.activeLabyrinthModifiers, destination).toEqual(
          screen === "battle" ? ["tempered"] : [],
        );
        expect(committed.session.activeLabyrinthRewardModifiers, destination).toEqual(["generous"]);
        if (screen === "battle")
          expect(readBattle(game).battleState.currentEnemy.traits.map((trait) => trait.id)).toContain("tempered");
      }
      expect(enter(mode, destination, game), destination).toBeNull();
      expect(readGameplayState(game), destination).toBe(committed);
      expect(observe, destination).toHaveBeenCalledOnce();
      unsubscribe();
      const saved = parseActiveRun(JSON.parse(JSON.stringify(snapshotRun(game))))!;
      expect(saved, destination).not.toBeNull();
      expect(saved.activity.kind, destination).toBe(screen);
      const restored = createGameSession();
      sessions.push(restored);
      restoreRun(saved, {}, {}, restored);
      expect(readRunSession(restored).activity, destination).toEqual(committed.session.activity);
      expect(parseActiveRun(JSON.parse(JSON.stringify(snapshotRun(restored)))), destination).toEqual(saved);
    }
  },
);

it.each(["campaign", "labyrinth"] as const)(
  "rolls back all %s room state and seeded draws after initialized shop data fails",
  (mode) => {
    const game = session(mode, DESTINATIONS.GEAR_SHOP, "equipment-shop");
    const before = readGameplayState(game);
    const committed = vi.fn();
    const unsubscribe = subscribeRunSessionCommits(committed, game);
    const initialize = shopInitialization.initializeShopVisit;
    vi.spyOn(shopInitialization, "initializeShopVisit").mockImplementation((draft, ...args) => {
      initialize(draft, ...args);
      expect(draft.session.activity.kind).toBe("equipment-shop");
      expect(draft.run.activeRun.rng.counters.shops).toBeGreaterThan(before.run.activeRun.rng.counters.shops);
      throw new Error("Shelf preparation failed");
    });
    expect(() => enter(mode, DESTINATIONS.GEAR_SHOP, game)).toThrow("Shelf preparation failed");
    expect(readGameplayState(game)).toBe(before);
    expect(snapshotRun(game).activity.kind).toBe(mode === "campaign" ? "destination" : "labyrinth-map");
    expect(committed).not.toHaveBeenCalled();
    unsubscribe();
    vi.restoreAllMocks();
    const result = enter(mode, DESTINATIONS.GEAR_SHOP, game);
    expect(result?.screen).toBe("equipment-shop");
  },
);

it.each(["campaign", "labyrinth"] as const)(
  "rolls back %s encounter selection, history, room counts, and RNG when opening resolution fails",
  (mode) => {
    const game = session(mode, DESTINATIONS.NORMAL_COMBAT);
    const before = readGameplayState(game);
    const resolve = battleEngine.resolveBattleStart;
    vi.spyOn(battleEngine, "resolveBattleStart").mockImplementation((...args) => {
      resolve(...args);
      throw new Error("Opening action failed");
    });
    expect(() => enter(mode, DESTINATIONS.NORMAL_COMBAT, game)).toThrow("Opening action failed");
    expect(readGameplayState(game)).toBe(before);
    expect(readBattle(game).hasActiveBattle).toBe(false);
  },
);

it("rejects stale Campaign choices and wrong-mode requests before consuming RNG", () => {
  const game = session("campaign", DESTINATIONS.CAMPFIRE);
  const before = readGameplayState(game);
  expect(enterRunRoom({ kind: "campaign", destination: DESTINATIONS.CARD_SHOP }, game)).toBeNull();
  expect(enterRunRoom({ kind: "labyrinth" }, game)).toBeNull();
  expect(readGameplayState(game)).toBe(before);
  dispatchGameplayCommand(
    (draft) => {
      draft.session.activity = { kind: "rewards" };
      return acceptCommand();
    },
    undefined,
    game,
  );
  const rewards = readGameplayState(game);
  expect(enterRunRoom({ kind: "campaign", destination: DESTINATIONS.CAMPFIRE }, game)).toBeNull();
  expect(readGameplayState(game)).toBe(rewards);
});

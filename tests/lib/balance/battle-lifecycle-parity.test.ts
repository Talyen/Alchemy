import "../../helpers/mock-audio";
import { initializeBattleForTest as initializeActiveBattle } from "../../helpers/run-domain-store-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as battle from "@/lib/battle";
import * as random from "@/lib/rng";
import { simulateBattle, type BattleSimulationConfig } from "@/lib/balance";
import { commitBattleWish, commitCardPlay, commitEndTurn } from "@/features/alchemy/shared/stores/battle-commands";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { createBattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";

import { readActiveRun, readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { resetRunDomainStore } from "../../helpers/run-domain-store-test";
import { makeTestCard } from "../../fixtures/battle";

type Action = (
  | { kind: "play"; cardId: string; index: number }
  | { kind: "wish"; cardId: string }
  | { kind: "end"; frames: battle.BattleTurnFrame[] }
) & { state: battle.BattleSnapshot; counter: number };

beforeEach(resetRunDomainStore);

function recordSimulation(config: BattleSimulationConfig, patch: Partial<battle.BattleSnapshot> = {}) {
  let world!: random.RunRngState;
  let opening!: battle.BattleSnapshot;
  let originalOpening!: battle.BattleSnapshot;
  let openingOptions!: Parameters<typeof battle.resolveBattleStart>[0];
  let openingCounter = 0;
  const actions: Action[] = [];
  const makeRng = random.createRunStateRng;
  vi.spyOn(random, "createRunStateRng").mockImplementation((state, stream) => {
    world = state;
    return makeRng(state, stream);
  });
  const start = battle.resolveBattleStart;
  vi.spyOn(battle, "resolveBattleStart").mockImplementation((options, context) => {
    const result = start(options, context);
    originalOpening = result.state;
    openingOptions = options;
    opening = { ...result.state, ...patch };
    openingCounter = world.counters.world;
    return { ...result, state: opening };
  });
  const play = battle.playBattleCardResolved;
  vi.spyOn(battle, "playBattleCardResolved").mockImplementation((state, cardId, index, options) => {
    const result = play(state, cardId, index, options);
    actions.push({
      kind: "play",
      cardId,
      index,
      state: battle.battleSnapshot(result.state),
      counter: world.counters.world,
    });
    return result;
  });
  const wish = battle.chooseWishCard;
  vi.spyOn(battle, "chooseWishCard").mockImplementation((state, cardId, texts) => {
    const result = wish(state, cardId, texts);
    actions.push({ kind: "wish", cardId, state: battle.battleSnapshot(result), counter: world.counters.world });
    return result;
  });
  const end = battle.resolveBattleTurn;
  vi.spyOn(battle, "resolveBattleTurn").mockImplementation((state, context, options) => {
    const result = end(state, context, options);
    actions.push({ kind: "end", frames: result.frames, state: result.state, counter: world.counters.world });
    return result;
  });
  const result = simulateBattle(config);
  vi.restoreAllMocks();

  return { result, actions, opening, originalOpening, openingOptions, openingCounter };
}

function replaySimulation(config: BattleSimulationConfig, patch: Partial<battle.BattleSnapshot> = {}) {
  const { result, actions, opening, originalOpening, openingOptions, openingCounter } = recordSimulation(config, patch);
  dispatchGameplayCommand((draft) => {
    const run = draft.run.activeRun;
    run.characterId = config.characterId;
    draft.session.activity = { kind: "idle" };
    run.rng = random.createRunRngState(config.seed ?? 1);
    run.roomsEncountered = (openingOptions.totalRooms ?? 0) - 1;
    run.runDeck = openingOptions.runDeck;
    run.runPlayerHealth = openingOptions.playerHealth!;
    run.runMaxHealth = openingOptions.maxHealth!;
    run.runBoons = openingOptions.trinketIds ?? [];
    draft.runProfile.gold = openingOptions.gold ?? 0;
    draft.runProfile.unlockedTalents = {};
    draft.runProfile.effects = { ...defaultHomesteadEffects };
    draft.profile.discoveredCardIds = [];
    return acceptCommand();
  });
  createBattleStartCommands(() => {}).startBattle({
    enemyId: config.enemyId,
    modifiers: config.difficultyModifiers ?? [],
  });
  // Live battles omit report instrumentation; all gameplay and RNG must agree.
  const { battleMetrics: _metrics, ...openingGameplay } = originalOpening;
  expect(readBattle().battleState, "opening snapshot").toEqual(openingGameplay);
  expect(readActiveRun().rng.counters.world, "opening world RNG").toBe(openingCounter);
  expect(readActiveRun().runGoldEarned, "opening Gold earnings").toBe(
    originalOpening.gold - (openingOptions.gold ?? 0),
  );
  dispatchGameplayCommand((draft) => {
    draft.run.activeRun.rng = random.createRunRngState(config.seed ?? 1);
    draft.run.activeRun.rng.counters.world = openingCounter;
    draft.runProfile.gold = opening.gold;
    initializeActiveBattle(draft, opening);
    return acceptCommand();
  });
  for (const [index, action] of actions.entries()) {
    if (action.kind === "play") expect(commitCardPlay(action.index, action.cardId)).not.toBeNull();
    else if (action.kind === "wish") expect(commitBattleWish(action.cardId)).not.toBeNull();
    else commitEndTurn();
    expect(readBattle().battleState, `snapshot after action ${index}: ${action.kind}`).toEqual(action.state);
    expect(readActiveRun().rng.counters.world, `world RNG after action ${index}: ${action.kind}`).toBe(action.counter);
  }
  return { result, actions };
}

const heldDeck = Array.from({ length: 8 }, (_, index) => makeTestCard({ id: `held-${index}`, cost: 99 }));
const base: BattleSimulationConfig = {
  characterId: "knight",
  enemyId: "skeleton",
  seed: 24,
  loadoutMode: "bare",
  playerMaxHealth: 1000,
  maxTurns: 3,
  depth: 1,
  difficultyModifiers: [{ kind: "start-companion", companionId: "golden-retriever" }],
};

describe("simulator and live command parity", () => {
  it("resolves both Eager Pack opening actions before drawing and returns serializable feedback", () => {
    const result = battle.resolveBattleStart(
      {
        runDeck: heldDeck,
        currentEnemy: battle.defaultBattleState().currentEnemy,
        difficultyModifiers: base.difficultyModifiers,
        contentSystemType: "labyrinth",
        encounterBenefits: ["eager-pack"],
      },
      { rng: random.createRunStreamRng(24) },
    );
    expect(result.state.gold).toBe(4);
    expect(result.companion?.state.hand).toHaveLength(0);
    expect(result.state.hand).toHaveLength(4);
    expect(result.companion?.texts).toEqual([{ target: "player", kind: "status", stat: "gold", amount: 4 }]);
    expect(structuredClone(result)).toEqual(result);
  });
  it("replays random card and Wish decisions without advancing combat RNG for the decisions", () => {
    const config: BattleSimulationConfig = {
      ...base,
      deck: Array.from({ length: 8 }, (_, index) =>
        makeTestCard({
          id: `wish-${index}`,
          cost: 1,
          consume: true,
          effects: [{ kind: "wish", amount: 1 }],
        }),
      ),
    };
    const { result, actions } = replaySimulation(config);
    expect(simulateBattle(config)).toEqual(result);
    expect(actions.some((action) => action.kind === "wish")).toBe(true);
    expect(actions.some((action) => action.kind === "play")).toBe(true);
    expect(actions.some((action) => action.kind === "end")).toBe(true);
  });

  it("skips Companion rewards on controlled turns and preserves the same seeded draws", () => {
    const { result, actions } = replaySimulation(
      { ...base, deck: heldDeck },
      {
        playerCC: { stunSkipTurns: 3, freezeSkipTurns: 0, cooldown: 0 },
      },
    );
    const ended = actions.find((action) => action.kind === "end");
    expect(ended?.kind).toBe("end");
    if (ended?.kind !== "end") throw new Error("Expected an end-turn action");
    expect(ended.frames.map((frame) => frame.turn.playerTurnSkipped)).toEqual([true, true, false]);
    expect(ended.frames.filter((frame) => frame.companion)).toHaveLength(1);
    expect(result.combatGoldEarned).toBe(4); // Opening action plus the first playable turn.
    expect(result.turns).toBe(3);
  });

  it("runs the opening Library Owl before the shared hand draw", () => {
    const { actions } = replaySimulation({
      ...base,
      deck: heldDeck,
      maxTurns: 1,
      difficultyModifiers: [{ kind: "start-companion", companionId: "library-owl" }],
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]?.kind).toBe("end");
  });

  it("caps forced skips without granting a Companion action or exceeding the round budget", () => {
    const { result, actions } = recordSimulation(
      { ...base, deck: heldDeck, maxTurns: 2 },
      {
        playerCC: { stunSkipTurns: 3, freezeSkipTurns: 0, cooldown: 0 },
      },
    );
    expect(result).toMatchObject({ outcome: "timeout", turns: 2, combatGoldEarned: 2 });
    expect(actions).toHaveLength(1);
    const action = actions[0];
    if (action?.kind !== "end") throw new Error("Expected an end-turn action");
    expect(action.frames).toHaveLength(2);
    expect(action.frames.every((frame) => frame.turn.playerTurnSkipped && frame.companion === null)).toBe(true);
    expect(action.state.playerCC.stunSkipTurns).toBe(1);
  });

  it("ends both hosts at lethal enemy damage without another Companion action", () => {
    const { result, actions } = replaySimulation(
      { ...base, deck: heldDeck },
      {
        playerHealth: 1,
        deathsDoorUsed: true,
        currentEnemy: { ...battle.defaultBattleState().currentEnemy, abilityIds: ["slash", "stab", "bash"] },
      },
    );
    expect(result.outcome).toBe("loss");
    expect(result.combatGoldEarned).toBe(2);
    expect(
      actions
        .filter((action) => action.kind === "end")
        .flatMap((action) => action.frames)
        .every((frame) => frame.companion === null),
    ).toBe(true);
  });
});

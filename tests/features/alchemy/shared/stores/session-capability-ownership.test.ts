import { createLabyrinthNodeRouting } from "@/features/alchemy/shell/labyrinth-node-routing";
import { describe, expect, it, vi } from "vitest";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { dispatchRunSessionCommand, acceptCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { setGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { createRunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { createRunFlowEngine } from "@/features/alchemy/shell/run-flow-engine";
import { createBattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { assertSessionOwnership, bindSessionCapabilities } from "@/features/alchemy/shared/stores/session-capabilities";

const shellActions = { navigateTo: () => {}, transition: () => {}, clearCardHover: () => {} };

describe("session capability composition", () => {
  it("rejects foreign shops and spread outcome handlers hidden in nested groups before either career changes", async () => {
    const a = createGameSession();
    const b = createGameSession();
    try {
      const foreignShop = createShopActions(b).merchant;
      const foreignVictory = createRunOutcomes({ actions: shellActions }, b).victory;
      const beforeA = readGameplayState(a);
      const beforeB = readGameplayState(b);
      for (const graph of [{ routes: { shop: foreignShop } }, { routes: { victory: { ...foreignVictory } } }]) {
        expect(() => assertSessionOwnership(a, graph)).toThrow(/different game sessions/);
        expect(() => bindSessionCapabilities(a, graph)).toThrow(/different game sessions/);
      }
      expect(readGameplayState(a)).toBe(beforeA);
      expect(readGameplayState(b)).toBe(beforeB);
    } finally {
      await Promise.all([a.dispose(), b.dispose()]);
    }
  });

  it("rejects a foreign nested victory handler at the production flow boundary", async () => {
    const a = createGameSession();
    const b = createGameSession();
    try {
      const local = createRunOutcomes({ actions: shellActions }, a);
      const foreign = createRunOutcomes({ actions: shellActions }, b);
      const beforeA = readGameplayState(a);
      const beforeB = readGameplayState(b);
      expect(() =>
        createRunFlowEngine(
          {
            ...shellActions,
            resumeTo: () => {},
            cancelPending: () => {},
            battle: createBattleStartCommands(() => {}, a),
          },
          { ...local, victory: { ...foreign.victory } },
          a,
        ),
      ).toThrow(/different game sessions/);
      expect(readGameplayState(a)).toBe(beforeA);
      expect(readGameplayState(b)).toBe(beforeB);
    } finally {
      await Promise.all([a.dispose(), b.dispose()]);
    }
  });

  it("binds detached nested methods to disposal and prevents replacement after validation", async () => {
    const session = createGameSession();
    let calls = 0;
    const source = { routes: { act: () => ++calls } };
    const bound = bindSessionCapabilities(session, source);
    const act = bound.routes.act;
    try {
      source.routes.act = () => 100;
      expect(act()).toBe(1);
      expect(Reflect.set(bound.routes, "act", () => 200)).toBe(false);
      expect(Reflect.set(bound, "routes", { act: () => 300 })).toBe(false);
      expect(bound.routes.act()).toBe(2);
      await session.dispose();
      expect(() => act()).toThrow(/disposed/);
      expect(calls).toBe(2);
    } finally {
      await session.dispose();
    }
  });

  it("checks symbol and non-enumerable groups without losing aliases or looping on cycles", async () => {
    const a = createGameSession();
    const b = createGameSession();
    const key = Symbol("commands");
    try {
      const act = () => 7;
      const group = { act };
      const graph: { groups: Array<typeof group>; alias: typeof group; self?: unknown; [key]?: unknown } = {
        groups: [group],
        alias: group,
      };
      graph.self = graph;
      Object.defineProperty(graph, key, { value: { act }, enumerable: false });
      const bound = bindSessionCapabilities(a, graph);
      expect(bound.self).toBe(bound);
      expect(bound.groups[0]).toBe(bound.alias);
      expect(bound.groups[0]!.act).toBe(bound.alias.act);
      expect(bound.alias.act()).toBe(7);
      expect(Object.isFrozen(bound.groups)).toBe(true);
      assertSessionOwnership(a, bound);
      expect(() => assertSessionOwnership(b, { copied: [...bound.groups] })).toThrow(/different game sessions/);
      const foreign = {};
      Object.defineProperty(foreign, key, { value: { ...bound.alias }, enumerable: false });
      expect(() => bindSessionCapabilities(b, foreign)).toThrow(/different game sessions/);
    } finally {
      await Promise.all([a.dispose(), b.dispose()]);
    }
  });

  it("rejects dynamic or opaque groups without executing accessors during composition", async () => {
    const session = createGameSession();
    let getterCalls = 0;
    try {
      const dynamic = Object.defineProperty({}, "commands", {
        get() {
          getterCalls++;
          return { act: () => {} };
        },
      });
      expect(() => bindSessionCapabilities(session, dynamic)).toThrow(/accessor/);
      expect(getterCalls).toBe(0);
      expect(() => bindSessionCapabilities(session, { commands: new Map() })).toThrow(/plain records/);
    } finally {
      await session.dispose();
    }
  });
});

it("captures validated outcome dependencies so later replacement cannot mutate another career", async () => {
  const a = createGameSession();
  const b = createGameSession();
  const navigateTo = () => {};
  const actions = { ...shellActions, navigateTo };
  const deps = { actions };
  const outcomes = createRunOutcomes(deps, a);
  const foreign = bindSessionCapabilities(b, {
    navigateTo: () => dispatchRunSessionCommand((tx) => acceptCommand(setGold(tx, 999)), undefined, b),
  });
  const before = readGameplayState(b);
  try {
    actions.navigateTo = foreign.navigateTo;
    deps.actions = { ...shellActions, navigateTo: foreign.navigateTo };
    outcomes.victory.completeRunVictory();
    expect(readGameplayState(b)).toBe(before);
  } finally {
    await Promise.all([a.dispose(), b.dispose()]);
  }
});

it("captures nested Labyrinth commands before a caller can replace them with another career's commands", async () => {
  const a = createGameSession();
  const b = createGameSession();
  const enterSelectedNode = vi.fn(() => null);
  const labyrinth = { enterSelectedNode };
  const routing = createLabyrinthNodeRouting({ labyrinth, navigateTo: () => {}, presentBattleStart: () => {} }, a);
  const foreign = bindSessionCapabilities(b, {
    enterSelectedNode: () => {
      dispatchRunSessionCommand((tx) => acceptCommand(setGold(tx, 999)), undefined, b);
      return null;
    },
  });
  const before = readGameplayState(b);
  try {
    labyrinth.enterSelectedNode = vi.fn(foreign.enterSelectedNode);
    expect(routing.handleLabyrinthNodeEnter()).toBe(false);
    expect(readGameplayState(b)).toBe(before);
    expect(enterSelectedNode).toHaveBeenCalledOnce();
  } finally {
    await Promise.all([a.dispose(), b.dispose()]);
  }
});

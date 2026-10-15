import { initializeBattleForTest as initializeActiveBattle } from "../../../../helpers/run-domain-store-test";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptCommand,
  rejectCommand,
  dispatchRunSessionCommand,
  type RunTransaction,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import { dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import {
  addGold,
  deductGold,
  createDraftRunRandomSource,
  setGold,
  setRunDeck,
  setRunActivityData,
} from "@/features/alchemy/shared/stores/run-session-write-port";

import {
  dispatchGearMutationWithRunHealthSync,
  mutateGearWithRunHealthSync,
} from "@/features/alchemy/shared/stores/gear-session-command";
import type { GearInstance } from "@/lib/gear";
import type { GearDraftView } from "@/features/alchemy/shared/stores/gear-store-types";
import { getGoldMultiplier } from "@/lib/game-data";
import { makeTestBattleState, makeTestCard } from "../../../../fixtures/battle";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";

beforeEach(resetAllTestStores);

const forbiddenWrites: Array<[string, (transaction: RunTransaction) => void]> = [
  [
    "Gold",
    (transaction) => {
      Reflect.set(transaction.runProfile, "gold", 999);
    },
  ],
  [
    "battle results",
    (transaction) => {
      if (transaction.session.activity.kind !== "battle") throw new Error("Fixture battle is missing");
      Reflect.set(transaction.session.activity.data.battleState, "enemyHealth", 0);
    },
  ],
  [
    "Gear loadouts",
    (transaction) => {
      Reflect.set(transaction.gear.loadouts.knight, "body", "forged-item");
    },
  ],
  [
    "nested inventory arrays",
    (transaction) => {
      Reflect.apply(Array.prototype.push, transaction.gear.inventories.knight, [{}]);
    },
  ],
  [
    "property descriptors",
    (transaction) => {
      Object.defineProperty(transaction.runProfile, "gold", { value: 999 });
    },
  ],
];

describe("feature transaction capabilities", () => {
  it.each(["accept", "reject", "throw"] as const)(
    "owns setter inputs without mutating or freezing caller data when commands %s",
    (ending) => {
      const card = makeTestCard({ effects: [{ kind: "damage", amount: 5, damageType: "physical" }] });
      const cards = [card];
      const before = readGameplayState(defaultGameSession);
      const execute = () =>
        dispatchRunSessionCommand(
          (transaction) => {
            setRunDeck(transaction, cards);
            Reflect.set(card.effects[0]!, "amount", 999);
            cards.push(makeTestCard({ id: "external" }));
            expect(transaction.run.activeRun.runDeck).toHaveLength(1);
            expect(transaction.run.activeRun.runDeck[0]!.effects[0]).toMatchObject({ amount: 5 });
            if (ending === "throw") throw new Error("abort input ownership test");
            return ending === "accept" ? acceptCommand() : rejectCommand("cancelled", undefined);
          },
          undefined,
          defaultGameSession,
        );
      if (ending === "throw") expect(execute).toThrow("abort input ownership test");
      else execute();
      if (ending === "accept") {
        expect(readGameplayState(defaultGameSession).run.activeRun.runDeck).toHaveLength(1);
      } else expect(readGameplayState(defaultGameSession)).toBe(before);
      expect(Object.isFrozen(cards)).toBe(false);
      expect(Object.isFrozen(card.effects[0])).toBe(false);
      Reflect.set(card.effects[0]!, "amount", 1000);
      expect(card.effects[0]).toMatchObject({ amount: 1000 });
    },
  );

  it("owns functional setter results and typed visit inputs while preserving unchanged updater identity", () => {
    const cards = [makeTestCard()];
    const offers = [makeTestCard()];
    dispatchRunSessionCommand(
      (transaction) => {
        setRunDeck(transaction, () => cards);
        setRunActivityData(transaction, "campfire", { offers, result: null, original: null, completed: false });
        cards.length = 0;
        offers.length = 0;
        expect(transaction.run.activeRun.runDeck).toHaveLength(1);
        expect(transaction.session.activity.kind).toBe("campfire");
        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    const before = readGameplayState(defaultGameSession);
    expect(before.session.activity).toMatchObject({ kind: "campfire", data: { offers: [makeTestCard()] } });
    dispatchRunSessionCommand(
      (transaction) => acceptCommand(setRunDeck(transaction, (deck) => deck)),
      undefined,
      defaultGameSession,
    );
    expect(readGameplayState(defaultGameSession)).toBe(before);
  });

  it("takes ownership of Gear before caller edits can bypass guarded mutation methods", () => {
    const armor: GearInstance = {
      instanceId: "owned-armor",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "max-health", value: 7 }],
    };
    dispatchGearMutationWithRunHealthSync(
      {
        mutate: (gear) => {
          gear.addInstance(armor, "knight");
          armor.affixes[0]!.value = 999;
          expect(gear.inventories.knight[0]!.affixes[0]!.value).toBe(7);
        },
      },
      defaultGameSession,
    );
    expect(readGameplayState(defaultGameSession).gear.inventories.knight[0]!.affixes[0]!.value).toBe(7);
    expect(Object.isFrozen(armor.affixes)).toBe(false);
  });

  it.each(forbiddenWrites)("rolls back earlier operations and RNG when an untyped caller writes %s", (_name, write) => {
    dispatchGameplayCommand(
      (draft) => acceptCommand(initializeActiveBattle(draft, makeTestBattleState())),
      undefined,
      defaultGameSession,
    );
    const before = readGameplayState(defaultGameSession);
    const effect = vi.fn();
    const commit = vi.fn();
    const unsubscribe = subscribeRunSessionCommits(commit, defaultGameSession);
    try {
      expect(() =>
        dispatchRunSessionCommand(
          (transaction) => {
            setGold(transaction, 17);
            createDraftRunRandomSource(transaction, "world")();
            write(transaction);
            return acceptCommand();
          },
          { afterCommit: effect },
          defaultGameSession,
        ),
      ).toThrow(/readonly/);
      expect(readGameplayState(defaultGameSession)).toBe(before);
      expect(commit).not.toHaveBeenCalled();
      expect(effect).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it("keeps transaction reads current while Gold operations settle purse, battle, and run earnings once", () => {
    setRunProgress({ gold: 100, selectedDifficulty: "difficulty-2", runGoldEarned: 0 });
    setRunSession({ hasActiveRun: true });
    dispatchGameplayCommand(
      (draft) => acceptCommand(initializeActiveBattle(draft, makeTestBattleState({ gold: 100 }))),
      undefined,
      defaultGameSession,
    );
    const before = readGameplayState(defaultGameSession);
    const commit = vi.fn();
    const unsubscribe = subscribeRunSessionCommits(commit, defaultGameSession);
    let retained!: RunTransaction;
    const result = dispatchRunSessionCommand(
      (transaction) => {
        retained = transaction;
        const expectedEarned = Math.round(
          5 * getGoldMultiplier(transaction.run.activeRun.characterId, transaction.run.activeRun.selectedDifficulty),
        );
        addGold(transaction, 5);
        expect(transaction.runProfile.gold).toBe(100 + expectedEarned);
        deductGold(transaction, 3);
        if (transaction.session.activity.kind !== "battle") throw new Error("Fixture battle is missing");
        expect(transaction.session.activity.data.battleState.gold).toBe(transaction.runProfile.gold);
        expect(transaction.run.activeRun.runGoldEarned).toBe(expectedEarned);
        return acceptCommand({
          purse: transaction.runProfile.gold,
          battle: transaction.session.activity.data.battleState,
        });
      },
      undefined,
      defaultGameSession,
    );
    unsubscribe();
    expect(commit).toHaveBeenCalledExactlyOnceWith(before.revision + 1);
    expect(result.battle.gold).toBe(result.purse);
    expect(() => JSON.stringify(result)).not.toThrow();
    Reflect.set(result.battle, "gold", 999);
    expect(readBattle(defaultGameSession).battleState.gold).toBe(result.purse);
    const committed = readGameplayState(defaultGameSession);
    expect(() => setGold(retained, 999)).toThrow(/current transaction/);
    expect(readGameplayState(defaultGameSession)).toBe(committed);
  });

  it("protects functional setter reads and detaches reused nested values before publication", () => {
    const card = makeTestCard({ effects: [{ kind: "damage", amount: 5, damageType: "physical" }] });
    dispatchRunSessionCommand(
      (transaction) => acceptCommand(setRunDeck(transaction, [card])),
      undefined,
      defaultGameSession,
    );
    const before = readGameplayState(defaultGameSession);
    expect(() =>
      dispatchRunSessionCommand(
        (transaction) => {
          setRunDeck(transaction, (deck) => {
            Reflect.set(deck[0]!.effects[0]!, "amount", 999);
            return deck;
          });
          return acceptCommand();
        },
        undefined,
        defaultGameSession,
      ),
    ).toThrow(/readonly/);
    expect(readGameplayState(defaultGameSession)).toBe(before);
    dispatchRunSessionCommand(
      (transaction) => {
        setRunDeck(transaction, (deck) => [...deck, { ...deck[0]!, id: "copied" }]);
        setRunActivityData(transaction, "campfire", { offers: [], result: null, original: null, completed: false });
        setRunActivityData(transaction, "campfire", (visit) => ({ ...visit, completed: true }));
        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    expect(readGameplayState(defaultGameSession).run.activeRun.runDeck.map((entry) => entry.id)).toEqual([
      card.id,
      "copied",
    ]);
    expect(() => JSON.stringify(readGameplayState(defaultGameSession))).not.toThrow();
    const committed = readGameplayState(defaultGameSession);
    expect(() =>
      dispatchRunSessionCommand(
        (transaction) => {
          setRunActivityData(transaction, "campfire", (visit) => {
            Reflect.set(visit, "completed", false);
            return visit;
          });
          return acceptCommand();
        },
        undefined,
        defaultGameSession,
      ),
    ).toThrow(/readonly/);
    expect(readGameplayState(defaultGameSession)).toBe(committed);
  });

  it("updates Gear and Health together, and prevents a raw Gear edit from bypassing combat locks", () => {
    const armor: GearInstance = {
      instanceId: "readonly-armor",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "max-health", value: 7 }],
    };
    setRunProgress({ runMaxHealth: 30, runMetaMaxHealth: 30, runPlayerHealth: 30 });
    setRunSession({ hasActiveRun: true });
    const beforeRevision = readGameplayState(defaultGameSession).revision;
    dispatchRunSessionCommand(
      (transaction) => {
        mutateGearWithRunHealthSync(transaction, {
          mutate: (gear) => {
            gear.addInstance(armor, "knight");
            return gear.equip("knight", "body", armor);
          },
        });
        expect(transaction.run.activeRun.runMaxHealth).toBe(37);
        return acceptCommand();
      },
      undefined,
      defaultGameSession,
    );
    expect(readGameplayState(defaultGameSession).revision).toBe(beforeRevision + 1);
    const inventory = dispatchGearMutationWithRunHealthSync(
      { mutate: (gear) => gear.inventories.knight },
      defaultGameSession,
    );
    expect(() => JSON.stringify(inventory)).not.toThrow();
    expect(inventory).toEqual([armor]);
    dispatchGameplayCommand(
      (draft) => acceptCommand(initializeActiveBattle(draft, makeTestBattleState({ playerMaxHealth: 37 }))),
      undefined,
      defaultGameSession,
    );
    const before = readGameplayState(defaultGameSession);
    expect(
      dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.unequip("knight", "body") }, defaultGameSession),
    ).toBe(false);
    expect(() =>
      dispatchGearMutationWithRunHealthSync(
        {
          mutate: (gear) => {
            gear.addCurrencies({ voidstone: 1 });
            Reflect.set(gear.loadouts.knight, "body", null);
          },
        },
        defaultGameSession,
      ),
    ).toThrow(/readonly/);
    expect(() =>
      dispatchGearMutationWithRunHealthSync(
        {
          mutate: (gear) => {
            Reflect.set(gear.inventories.knight[0]!.affixes[0]!, "value", 999);
          },
        },
        defaultGameSession,
      ),
    ).toThrow(/readonly/);
    expect(() => dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.reset() }, defaultGameSession)).toThrow(
      /during combat/,
    );
    expect(() =>
      dispatchGearMutationWithRunHealthSync(
        { mutate: (gear) => gear.initialize(gear.inventories, gear.loadouts) },
        defaultGameSession,
      ),
    ).toThrow(/during combat/);
    expect(readGameplayState(defaultGameSession)).toBe(before);
    expect(readBattle(defaultGameSession).battleState.playerMaxHealth).toBe(37);
  });

  it.each(["return", "throw"] as const)(
    "revokes Gear writes after its callback %s so late equipment cannot bypass Health synchronization",
    (ending) => {
      const armor: GearInstance = {
        instanceId: "scoped-armor",
        definitionId: "leather-armor-basic",
        affixes: [{ id: "max-health", value: 7 }],
      };
      setRunProgress({ runMaxHealth: 30, runMetaMaxHealth: 30, runPlayerHealth: 30 });
      setRunSession({ hasActiveRun: true });
      dispatchGearMutationWithRunHealthSync(
        {
          mutate: (gear) => {
            gear.addInstance(armor, "knight");
            gear.equip("knight", "body", armor);
          },
        },
        defaultGameSession,
      );
      const before = readGameplayState(defaultGameSession);
      const committed = vi.fn();
      const unsubscribe = subscribeRunSessionCommits(committed, defaultGameSession);
      const effect = vi.fn();
      try {
        expect(() =>
          dispatchRunSessionCommand(
            (transaction) => {
              setGold(transaction, 17);
              createDraftRunRandomSource(transaction, "world")();
              let retained!: GearDraftView["unequip"];
              try {
                mutateGearWithRunHealthSync(transaction, {
                  mutate: (gear) => {
                    retained = gear.unequip;
                    if (ending === "throw") throw new Error("abort gear callback");
                  },
                });
              } catch (error) {
                if (!(error instanceof Error) || error.message !== "abort gear callback") throw error;
              }
              retained("knight", "body");
              return acceptCommand();
            },
            { afterCommit: effect },
            defaultGameSession,
          ),
        ).toThrow(/current Gear mutation/);
        expect(readGameplayState(defaultGameSession)).toBe(before);
        expect(before.gear.loadouts.knight.body).toBe(armor.instanceId);
        expect(before.run.activeRun.runMaxHealth).toBe(37);
        expect(committed).not.toHaveBeenCalled();
        expect(effect).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    },
  );

  it.each(["throw", "async"] as const)(
    "rolls back a %s Gear callback even when the enclosing command catches its failure and accepts",
    async (failure) => {
      const armor: GearInstance = {
        instanceId: "failed-gear-armor",
        definitionId: "leather-armor-basic",
        affixes: [{ id: "max-health", value: 7 }],
      };
      setRunProgress({ runMaxHealth: 30, runMetaMaxHealth: 30, runPlayerHealth: 30 });
      setRunSession({ hasActiveRun: true });
      dispatchGearMutationWithRunHealthSync(
        {
          mutate: (gear) => {
            gear.addInstance(armor, "knight");
            gear.equip("knight", "body", armor);
          },
        },
        defaultGameSession,
      );
      const before = readGameplayState(defaultGameSession);
      const committed = vi.fn();
      const effect = vi.fn();
      const caught = vi.fn();
      const unsubscribe = subscribeRunSessionCommits(committed, defaultGameSession);
      try {
        expect(() =>
          dispatchRunSessionCommand(
            (transaction) => {
              setGold(transaction, 17);
              createDraftRunRandomSource(transaction, "world")();
              try {
                mutateGearWithRunHealthSync(transaction, {
                  mutate: (gear): unknown => {
                    gear.unequip("knight", "body");
                    if (failure === "throw") throw new Error("Gear callback failed");
                    return (async () => {
                      await Promise.resolve();
                      gear.addCurrencies({ voidstone: 1 });
                    })();
                  },
                });
              } catch (error) {
                caught(error);
              }
              return acceptCommand();
            },
            { afterCommit: effect },
            defaultGameSession,
          ),
        ).toThrow(failure === "throw" ? /Gear callback failed/ : /must be synchronous/);
        // Invalid asynchronous continuations are observed after their methods revoke.
        await Promise.resolve();
        expect(caught).toHaveBeenCalledOnce();
        expect(readGameplayState(defaultGameSession)).toBe(before);
        expect(before.gear.loadouts.knight.body).toBe(armor.instanceId);
        expect(before.run.activeRun.runMaxHealth).toBe(37);
        expect(committed).not.toHaveBeenCalled();
        expect(effect).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    },
  );
});

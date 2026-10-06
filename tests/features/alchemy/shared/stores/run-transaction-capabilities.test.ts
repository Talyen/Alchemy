import { initializeBattleForTest as initializeActiveBattle } from "../../../../helpers/run-domain-store-test";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  type RunTransaction,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import { dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
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
import { getGoldMultiplier } from "@/lib/game-data";
import { makeTestBattleState, makeTestCard } from "../../../../fixtures/battle";
import { resetAllTestStores, setRunProgress, setRunSession } from "../../../../helpers/run-domain-store-test";

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
  it.each(forbiddenWrites)("rolls back earlier operations and RNG when an untyped caller writes %s", (_name, write) => {
    dispatchGameplayCommand((draft) => acceptCommand(initializeActiveBattle(draft, makeTestBattleState())));
    const before = readGameplayState();
    const effect = vi.fn();
    const commit = vi.fn();
    const unsubscribe = subscribeRunSessionCommits(commit);
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
        ),
      ).toThrow(/readonly/);
      expect(readGameplayState()).toBe(before);
      expect(commit).not.toHaveBeenCalled();
      expect(effect).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it("keeps transaction reads current while Gold operations settle purse, battle, and run earnings once", () => {
    setRunProgress({ gold: 100, selectedDifficulty: "difficulty-2", runGoldEarned: 0 });
    setRunSession({ hasActiveRun: true });
    dispatchGameplayCommand((draft) =>
      acceptCommand(initializeActiveBattle(draft, makeTestBattleState({ gold: 100 }))),
    );
    const before = readGameplayState();
    const commit = vi.fn();
    const unsubscribe = subscribeRunSessionCommits(commit);
    let retained!: RunTransaction;
    const result = dispatchRunSessionCommand((transaction) => {
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
    });
    unsubscribe();
    expect(commit).toHaveBeenCalledExactlyOnceWith(before.revision + 1);
    expect(result.battle.gold).toBe(result.purse);
    expect(() => JSON.stringify(result)).not.toThrow();
    const committed = readGameplayState();
    expect(() => setGold(retained, 999)).toThrow(/current transaction/);
    expect(readGameplayState()).toBe(committed);
  });

  it("protects functional setter reads and detaches reused nested values before publication", () => {
    const card = makeTestCard({ effects: [{ kind: "damage", amount: 5, damageType: "physical" }] });
    dispatchRunSessionCommand((transaction) => acceptCommand(setRunDeck(transaction, [card])));
    const before = readGameplayState();
    expect(() =>
      dispatchRunSessionCommand((transaction) => {
        setRunDeck(transaction, (deck) => {
          Reflect.set(deck[0]!.effects[0]!, "amount", 999);
          return deck;
        });
        return acceptCommand();
      }),
    ).toThrow(/readonly/);
    expect(readGameplayState()).toBe(before);
    dispatchRunSessionCommand((transaction) => {
      setRunDeck(transaction, (deck) => [...deck, { ...deck[0]!, id: "copied" }]);
      setRunActivityData(transaction, "campfire", { offers: [], result: null, original: null, completed: false });
      setRunActivityData(transaction, "campfire", (visit) => ({ ...visit, completed: true }));
      return acceptCommand();
    });
    expect(readGameplayState().run.activeRun.runDeck.map((entry) => entry.id)).toEqual([card.id, "copied"]);
    expect(() => JSON.stringify(readGameplayState())).not.toThrow();
    const committed = readGameplayState();
    expect(() =>
      dispatchRunSessionCommand((transaction) => {
        setRunActivityData(transaction, "campfire", (visit) => {
          Reflect.set(visit, "completed", false);
          return visit;
        });
        return acceptCommand();
      }),
    ).toThrow(/readonly/);
    expect(readGameplayState()).toBe(committed);
  });

  it("updates Gear and Health together, and prevents a raw Gear edit from bypassing combat locks", () => {
    const armor: GearInstance = {
      instanceId: "readonly-armor",
      definitionId: "leather-armor-basic",
      affixes: [{ id: "max-health", value: 7 }],
    };
    setRunProgress({ runMaxHealth: 30, runMetaMaxHealth: 30, runPlayerHealth: 30 });
    setRunSession({ hasActiveRun: true });
    const beforeRevision = readGameplayState().revision;
    dispatchRunSessionCommand((transaction) => {
      mutateGearWithRunHealthSync(transaction, {
        mutate: (gear) => {
          gear.addInstance(armor, "knight");
          return gear.equip("knight", "body", armor);
        },
      });
      expect(transaction.run.activeRun.runMaxHealth).toBe(37);
      return acceptCommand();
    });
    expect(readGameplayState().revision).toBe(beforeRevision + 1);
    const inventory = dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.inventories.knight });
    expect(() => JSON.stringify(inventory)).not.toThrow();
    expect(inventory).toEqual([armor]);
    dispatchGameplayCommand((draft) =>
      acceptCommand(initializeActiveBattle(draft, makeTestBattleState({ playerMaxHealth: 37 }))),
    );
    const before = readGameplayState();
    expect(dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.unequip("knight", "body") })).toBe(false);
    expect(() =>
      dispatchGearMutationWithRunHealthSync({
        mutate: (gear) => {
          gear.addCurrencies({ voidstone: 1 });
          Reflect.set(gear.loadouts.knight, "body", null);
        },
      }),
    ).toThrow(/readonly/);
    expect(() =>
      dispatchGearMutationWithRunHealthSync({
        mutate: (gear) => {
          Reflect.set(gear.inventories.knight[0]!.affixes[0]!, "value", 999);
        },
      }),
    ).toThrow(/readonly/);
    expect(() => dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.reset() })).toThrow(/during combat/);
    expect(() =>
      dispatchGearMutationWithRunHealthSync({ mutate: (gear) => gear.initialize(gear.inventories, gear.loadouts) }),
    ).toThrow(/during combat/);
    expect(readGameplayState()).toBe(before);
    expect(readBattle().battleState.playerMaxHealth).toBe(37);
  });
});

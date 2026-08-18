import { makeTestBattleState, makeTestCard } from "../../../../fixtures/battle";
import type { BattleState } from "@/lib/battle";
import type { Screen } from "@/lib/routing";
import { EMPTY_HIDDEN_HAND_KEYS, type HiddenHandCardKeys } from "@/features/alchemy/run-loop/battle/playable-hand";

const playableCard = makeTestCard({
  id: "slash",
  cost: 1,
  effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
});

const unplayableCard = makeTestCard({
  id: "meteor",
  cost: 9,
  effects: [{ kind: "damage", damageType: "burn", amount: 20 }],
});

export interface OpenBattleGate {
  screen: Screen;
  hasActiveBattle: boolean;
  cardTransferInProgress: boolean;
  hiddenHandCardKeys: HiddenHandCardKeys;
  cardPlayInProgress: boolean;
  battleState: BattleState;
}

export function makeOpenBattle<T extends object>(overrides: T = {} as T): OpenBattleGate & T {
  return {
    screen: "battle",
    hasActiveBattle: true,
    cardTransferInProgress: false,
    hiddenHandCardKeys: EMPTY_HIDDEN_HAND_KEYS,
    cardPlayInProgress: false,
    battleState: makeTestBattleState({
      hand: [{ ...playableCard, uid: 1 }],
      mana: 3,
      turnPhase: "player",
      enemyHealth: 20,
    }),
    ...overrides,
  };
}

export function makeUnplayableBattle<T extends object>(overrides: T = {} as T): OpenBattleGate & T {
  return makeOpenBattle({
    battleState: makeTestBattleState({
      hand: [{ ...unplayableCard, uid: 1 }],
      mana: 1,
      turnPhase: "player",
      enemyHealth: 20,
    }),
    ...overrides,
  });
}

export function makeEmptyHandBattle<T extends object>(overrides: T = {} as T): OpenBattleGate & T {
  return makeOpenBattle({
    battleState: makeTestBattleState({
      hand: [],
      mana: 3,
      turnPhase: "player",
      enemyHealth: 20,
    }),
    ...overrides,
  });
}

export { playableCard, unplayableCard };

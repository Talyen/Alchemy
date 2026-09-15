import { makeTestBattleState, makeTestCard } from "../../../../fixtures/battle";
import type { BattleState } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
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
    battleState: openBattleState([{ ...playableCard, uid: 1 }], 3),
    ...overrides,
  };
}

function openBattleState(hand: BattleCard[], mana: number): BattleState {
  return makeTestBattleState({ hand, mana, turnPhase: "player", enemyHealth: 20 });
}

export function makeUnplayableBattle<T extends object>(overrides: T = {} as T): OpenBattleGate & T {
  return makeOpenBattle({
    battleState: openBattleState([{ ...unplayableCard, uid: 1 }], 1),
    ...overrides,
  });
}

export function makeEmptyHandBattle<T extends object>(overrides: T = {} as T): OpenBattleGate & T {
  return makeOpenBattle({
    battleState: openBattleState([], 3),
    ...overrides,
  });
}

export { playableCard };

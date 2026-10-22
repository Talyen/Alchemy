import { beforeEach, expect, it } from "vitest";
import { defaultGameSession } from "@/app/application-session";
import { createBattleCapabilities } from "@/features/alchemy/shared/stores/commands/battle-commands";
import { readGameplayState } from "@/features/alchemy/shared/stores/session/gameplay-state-reads";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/commands/run-lifecycle";
import { readBattle } from "@/features/alchemy/shared/stores/session/run-reads";
import { setScreen } from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { cardById } from "@/lib/game-data";
import { regressionBattle, slashDeck } from "../../../../../fixtures/battle";
import {
  initializeBattleForTest,
  mutateGameplayForTest,
  resetAllTestStores,
} from "../../../../../helpers/run-domain-store-test";

beforeEach(resetAllTestStores);

function openBattle(options: Parameters<typeof regressionBattle>[0] = {}) {
  mutateGameplayForTest((draft) =>
    initializeBattleForTest(
      draft,
      regressionBattle({
        playerHealth: 1000,
        playerMaxHealth: 1000,
        enemyHealth: 1000,
        enemyMaxHealth: 1000,
        mana: 10,
        deck: slashDeck(20),
        ...options,
      }),
    ),
  );
  return readBattle(defaultGameSession).battleState;
}

it("cannot spend a second turn using input offered before the first turn committed", () => {
  const offered = openBattle();
  const battle = createBattleCapabilities(defaultGameSession);
  expect(battle.endTurn(offered)).not.toBeNull();
  const committed = readGameplayState(defaultGameSession);
  expect(battle.endTurn(offered)).toBeNull();
  expect(readGameplayState(defaultGameSession)).toBe(committed);
  expect(battle.endTurn(battle.read().battleState)).not.toBeNull();
});

it("cannot apply the same Wish input to the next Wish even when both offer the same card", () => {
  const card = cardById.slash!;
  const offered = openBattle({ wishOptions: [card], wishQueue: [[card]] });
  const battle = createBattleCapabilities(defaultGameSession);
  expect(battle.chooseWish(offered, card.id)).not.toBeNull();
  const committed = readGameplayState(defaultGameSession);
  expect(battle.read().battleState.wishOptions?.[0]?.id).toBe(card.id);
  expect(battle.chooseWish(offered, card.id)).toBeNull();
  expect(readGameplayState(defaultGameSession)).toBe(committed);
  expect(battle.chooseWish(battle.read().battleState, card.id)).not.toBeNull();
});

it("invalidates old card input when an identical battle is restored", () => {
  const card = { ...cardById.slash!, uid: 1 };
  const offered = openBattle({ hand: [card] });
  const battle = createBattleCapabilities(defaultGameSession);
  restoreRun(snapshotRun(defaultGameSession), {}, {}, defaultGameSession);
  const restored = readGameplayState(defaultGameSession);
  expect(battle.playCard(offered, 0, card.id)).toBeNull();
  expect(readGameplayState(defaultGameSession)).toBe(restored);
  expect(battle.playCard(battle.read().battleState, 0, card.id)).not.toBeNull();
});

it("keeps input valid across unrelated display navigation", () => {
  const offered = openBattle();
  mutateGameplayForTest((draft) => setScreen(draft, "options"));
  expect(readBattle(defaultGameSession).battleState).toBe(offered);
  expect(createBattleCapabilities(defaultGameSession).endTurn(offered)).not.toBeNull();
});

import { beforeEach, describe, expect, it } from "vitest";
import { commitBattleWish, commitCardPlay } from "@/features/alchemy/shared/stores/battle-commands";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { setDiscoveredCardIds, setHasActiveRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import { initializeActiveBattle } from "@/features/alchemy/shared/stores/write/run-battle";
import { cardById } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { regressionBattle } from "../../../../fixtures/battle";
import { resetRunDomainStore } from "../../../../helpers/run-domain-store-test";

beforeEach(resetRunDomainStore);

describe("battle Wish discovery", () => {
  it("Discovery uses cards discovered earlier in the same battle", () => {
    const chosen = cardById["wolf-companion"]!;
    const stillMissing = cardById["fox-companion"]!;
    const discovered = getOfferableCardPool()
      .filter((card) => card.id !== chosen.id && card.id !== stillMissing.id)
      .map((card) => card.id);
    const wish = { ...cardById.wish!, uid: 10 };
    dispatchGameplayCommand((draft) => {
      setHasActiveRun(draft, true);
      setDiscoveredCardIds(draft, discovered);
      initializeActiveBattle(
        draft,
        regressionBattle({
          discoveredCardIds: discovered,
          wishOptions: [chosen],
          hand: [wish],
          mana: 3,
          talentEffects: { wishUndiscoveredCards: true },
        }),
      );

      return acceptCommand();
    });
    expect(commitBattleWish(chosen.id)).not.toBeNull();
    expect(readGameplayState().profile.discoveredCardIds).toContain(chosen.id);
    expect(readGameplayState().battle.battleState.discoveredCardIds).toContain(chosen.id);
    expect(commitCardPlay(0, wish.id)?.state.wishOptions?.map((card) => card.id)).toContain(stillMissing.id);
  });

  it("Roads Not Taken discovers its bonus card even when both cards enter the hand queue", () => {
    const chosen = cardById["wolf-companion"]!;
    const bonus = cardById["fox-companion"]!;
    dispatchGameplayCommand((draft) => {
      setHasActiveRun(draft, true);
      setDiscoveredCardIds(draft, []);
      initializeActiveBattle(
        draft,
        regressionBattle({
          hand: Array.from({ length: 7 }, () => cardById.slash!),
          wishOptions: [chosen, bonus],
          talentEffects: { declinedWishCardChance: 100 },
        }),
      );

      return acceptCommand();
    });
    const after = commitBattleWish(chosen.id);
    expect(after?.pendingHandCards.map((card) => card.id)).toEqual([chosen.id, bonus.id]);
    expect(readGameplayState().profile.discoveredCardIds).toEqual(expect.arrayContaining([chosen.id, bonus.id]));
  });
});

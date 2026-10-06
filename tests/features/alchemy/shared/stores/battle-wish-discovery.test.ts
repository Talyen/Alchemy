import { initializeBattleForTest as initializeActiveBattle } from "../../../../helpers/run-domain-store-test";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";
import { beforeEach, describe, expect, it } from "vitest";
import { commitBattleWish, commitCardPlay } from "@/features/alchemy/shared/stores/battle-commands";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { acceptCommand, dispatchGameplayCommand } from "@/features/alchemy/shared/stores/gameplay-command";
import { setDiscoveredCardIds, setHasActiveRun } from "@/features/alchemy/shared/stores/run-session-write-port";

import { cardById } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { regressionBattle } from "../../../../fixtures/battle";
import { resetRunDomainStore } from "../../../../helpers/run-domain-store-test";
import { defaultGameSession } from "@/app/application-session";

beforeEach(resetRunDomainStore);

describe("battle Wish discovery", () => {
  it("Discovery uses cards discovered earlier in the same battle", () => {
    const chosen = cardById["wolf-companion"]!;
    const stillMissing = cardById["fox-companion"]!;
    const discovered = getOfferableCardPool()
      .filter((card) => card.id !== chosen.id && card.id !== stillMissing.id)
      .map((card) => card.id);
    const wish = { ...cardById.wish!, uid: 10 };
    dispatchGameplayCommand(
      (draft) => {
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
      },
      undefined,
      defaultGameSession,
    );
    expect(commitBattleWish(chosen.id, defaultGameSession)).not.toBeNull();
    expect(readGameplayState(defaultGameSession).profile.discoveredCardIds).toContain(chosen.id);
    expect(readBattle(defaultGameSession).battleState.discoveredCardIds).toContain(chosen.id);
    expect(commitCardPlay(0, wish.id, defaultGameSession)?.state.wishOptions?.map((card) => card.id)).toContain(
      stillMissing.id,
    );
  });

  it("Roads Not Taken discovers its bonus card even when both cards enter the hand queue", () => {
    const chosen = cardById["wolf-companion"]!;
    const bonus = cardById["fox-companion"]!;
    dispatchGameplayCommand(
      (draft) => {
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
      },
      undefined,
      defaultGameSession,
    );
    const after = commitBattleWish(chosen.id, defaultGameSession);
    expect(after?.pendingHandCards.map((card) => card.id)).toEqual([chosen.id, bonus.id]);
    expect(readGameplayState(defaultGameSession).profile.discoveredCardIds).toEqual(
      expect.arrayContaining([chosen.id, bonus.id]),
    );
  });
});

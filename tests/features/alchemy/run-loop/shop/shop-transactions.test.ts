import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createShopRefreshAction } from "@/features/alchemy/run-loop/shop/shop-commands-core";
import { applyStrongSpiritsToPotions } from "@/features/alchemy/run-loop/shop/shop-state-init";
import {
  acceptCommand,
  createRunSessionCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import { setShopState as mutateShopState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { SHOP_REFRESH_PRICE } from "@/lib/game-constants";
import { cardById, createEmptyTalentEffectManifest } from "@/lib/game-data";
import { emptyShopState, readActivityData } from "@/lib/active-run-session";
import { resetAllTestStores } from "../../../../helpers/run-domain-store-test";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";
import { readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { createDraftRunRandomSource, deductGold } from "@/features/alchemy/shared/stores/run-session-write-port";
import { runShopTransaction } from "@/features/alchemy/run-loop/shop/shop-transactions";
import { playGoldSpend, playUISound } from "@/lib/audio";
const setShopState = createRunSessionCommand((...args: Parameters<typeof mutateShopState>) =>
  acceptCommand(mutateShopState(...args)),
);

beforeEach(() => {
  resetAllTestStores();
});

describe("shop refresh transaction", () => {
  const talentEffects = createEmptyTalentEffectManifest();
  const newItems = [cardById["health-potion"]!, cardById["mana-potion"]!];

  it("rolls back payment, shelf changes, and RNG when a recipe rejects after writing", () => {
    setRunProgress({ gold: 100 });
    setShopState({ ...emptyShopState(), cards: newItems, refreshesLeft: 1 });
    const before = readGameplayState();
    const onCommit = vi.fn();
    const unsubscribe = subscribeRunSessionCommits(onCommit);
    vi.mocked(playGoldSpend).mockClear();
    vi.mocked(playUISound).mockClear();
    try {
      const result = runShopTransaction(
        "shop",
        (draft) => {
          deductGold(draft, 25);
          createDraftRunRandomSource(draft, "shops")();
          mutateShopState(draft, { ...emptyShopState(), cards: [], refreshesLeft: 0 });
          return { committed: false, price: 25, value: null };
        },
        "shopRefresh",
      );

      expect(result).toEqual({ committed: false, price: 25, value: null });
      expect(readGameplayState()).toBe(before);
      expect(onCommit).not.toHaveBeenCalled();
      expect(playGoldSpend).not.toHaveBeenCalled();
      expect(playUISound).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it("commits gold and refreshed state atomically", () => {
    setRunProgress({ gold: SHOP_REFRESH_PRICE + 5 });
    setShopState({
      ...emptyShopState(),
      cards: newItems,
      refreshesLeft: 1,
      firstPurchaseUsed: true,
      removeUsed: true,
      purchasedSlotKeys: ["health-potion-0"],
    });
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    const expectedItems = applyStrongSpiritsToPotions(newItems, ["strong-spirits"]);
    const refreshed = createShopRefreshAction({
      activity: "shop",
      talentEffects,
      resample: (_draft, state) => ({ ...state, cards: expectedItems }),
    })();
    unsubscribe();

    expect(refreshed).toBe(true);
    expect(expectedItems).not.toEqual(newItems);
    expect(commits).toHaveLength(1);
    expect(readRunProfile().gold).toBe(5);
    expect(readActivityData(readRunSession().activity, "shop").cards).toEqual(expectedItems);
    expect(readActivityData(readRunSession().activity, "shop")).toMatchObject({
      firstPurchaseUsed: true,
      removeUsed: true,
    });
    expect(readActivityData(readRunSession().activity, "shop").refreshesLeft).toBe(0);
    expect(readActivityData(readRunSession().activity, "shop").purchasedSlotKeys).toEqual([]);
  });

  it.each([
    { name: "no refreshes remain", gold: SHOP_REFRESH_PRICE, refreshesLeft: 0 },
    { name: "gold is insufficient", gold: 2, refreshesLeft: 1 },
  ])("does not publish a revision when $name", ({ gold, refreshesLeft }) => {
    setRunProgress({ gold });
    setShopState({
      ...emptyShopState(),
      cards: newItems,
      refreshesLeft,
      firstPurchaseUsed: true,
      purchasedSlotKeys: ["health-potion-0"],
    });
    const previousSession = readRunSession();
    const resample = vi.fn(() => ({ ...emptyShopState(), cards: newItems }));
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    const refreshed = createShopRefreshAction({ activity: "shop", talentEffects, resample })();
    unsubscribe();

    expect(refreshed).toBe(false);
    expect(commits).toHaveLength(0);
    expect(readRunProfile().gold).toBe(gold);
    expect(resample).not.toHaveBeenCalled();
    expect(readRunSession()).toEqual(previousSession);
  });
});

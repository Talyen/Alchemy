import "../../../../helpers/mock-audio";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createShopRefreshAction } from "@/features/alchemy/run-loop/shop/shop-commands-core";
import { applyStrongSpiritsToPotions } from "@/features/alchemy/run-loop/shop/shop-state-init";
import {
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
const setShopState = createRunSessionCommand(mutateShopState);

beforeEach(() => {
  resetAllTestStores();
});

describe("shop refresh transaction", () => {
  const talentEffects = createEmptyTalentEffectManifest();
  const newItems = [cardById["health-potion"]!, cardById["mana-potion"]!];

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

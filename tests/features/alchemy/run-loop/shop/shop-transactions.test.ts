import { beforeEach, describe, expect, it, vi } from "vitest";
import { purchaseShopOffering, refreshShopOfferings } from "@/features/alchemy/run-loop/shop/shop-transactions";
import { applyStrongSpiritsToPotions } from "@/features/alchemy/run-loop/shop/shop-state-init";
import {
  createRunSessionCommand,
  dispatchRunSessionCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import { setShopState as mutateShopState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { cardById, type BattleCard } from "@/lib/game-data";
import { emptyShopState, readActivityData, type ShopState } from "@/lib/active-run-session";
import { resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";
import { readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
const setShopState = createRunSessionCommand(mutateShopState);

beforeEach(() => {
  resetAllTestStores();
});

describe("refreshShopOfferings", () => {
  const newItems = [cardById["health-potion"]!, cardById["mana-potion"]!];

  it("commits gold and refreshed state atomically", () => {
    setRunProgress({ gold: 10 });
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

    const refreshed = dispatchRunSessionCommand((draft) =>
      refreshShopOfferings<ShopState, BattleCard>({
        draft,
        price: 5,
        refreshesLeft: readActivityData(draft.session.activity, "shop").refreshesLeft,
        setState: mutateShopState,
        resample: () => applyStrongSpiritsToPotions(newItems, ["strong-spirits"]),
        mapState: (previous, items) => ({ ...previous, cards: items }),
      }),
    );
    unsubscribe();

    expect(refreshed).toMatchObject({
      committed: true,
      price: 5,
      value: applyStrongSpiritsToPotions(newItems, ["strong-spirits"]),
    });
    expect(refreshed.value).not.toEqual(newItems);
    expect(commits).toHaveLength(1);
    expect(readRunProfile().gold).toBe(5);
    expect(readActivityData(readRunSession().activity, "shop").cards).toEqual(refreshed.value);
    expect(readActivityData(readRunSession().activity, "shop")).toMatchObject({
      firstPurchaseUsed: true,
      removeUsed: true,
    });
    expect(readActivityData(readRunSession().activity, "shop").refreshesLeft).toBe(0);
    expect(readActivityData(readRunSession().activity, "shop").purchasedSlotKeys).toEqual([]);
  });

  it.each([
    { name: "no refreshes remain", gold: 10, refreshesLeft: 0 },
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
    const resample = vi.fn(() => newItems);
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    const refreshed = dispatchRunSessionCommand((draft) =>
      refreshShopOfferings<ShopState, BattleCard>({
        draft,
        price: 5,
        refreshesLeft: readActivityData(draft.session.activity, "shop").refreshesLeft,
        setState: mutateShopState,
        resample,
        mapState: (previous, items) => ({ ...previous, cards: items }),
      }),
    );
    unsubscribe();

    expect(refreshed).toMatchObject({ committed: false, price: 5, value: null });
    expect(commits).toHaveLength(0);
    expect(readRunProfile().gold).toBe(gold);
    expect(resample).not.toHaveBeenCalled();
    expect(readRunSession()).toEqual(previousSession);
  });
});

describe("purchaseShopOffering", () => {
  it("does not spend gold when the payload is not the live offering", () => {
    setRunProgress({ gold: 10 });
    setShopState({ ...emptyShopState(), purchasedSlotKeys: [] });
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    const result = dispatchRunSessionCommand((draft) =>
      purchaseShopOffering({
        draft,
        price: 5,
        state: readActivityData(draft.session.activity, "shop"),
        setState: mutateShopState,
        slotKey: "missing-0",
        offeringMatches: false,
        acquire: () => {
          throw new Error("should not acquire");
        },
      }),
    );
    unsubscribe();

    expect(result).toMatchObject({ committed: false, price: 5 });
    expect(commits).toHaveLength(0);
    expect(readRunProfile().gold).toBe(10);
  });
});

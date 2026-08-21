import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mapRefreshedShopOfferings,
  purchaseShopOffering,
  refreshCardShopOfferings,
  refreshShopOfferings,
} from "@/features/alchemy/run-loop/shop/shop-transactions";
import { createInitialShopState } from "@/features/alchemy/run-loop/shop/shop-state-init";
import {
  createRunSessionCommand,
  dispatchRunSessionCommand,
  subscribeRunSessionCommits,
} from "@/features/alchemy/shared/stores/run-session-command";
import { setShopState as mutateShopState } from "@/features/alchemy/shared/stores/run-session-write-port";
const setShopState = createRunSessionCommand(mutateShopState);
import { selectRewardCards, type BattleCard } from "@/lib/game-data";
import { emptyShopState, type ShopState } from "@/lib/active-run-session";
import { makeEffect, makeTestCardWithId } from "../../../../fixtures/battle";
import { resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";

vi.mock("@/lib/game-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/game-data")>();
  return { ...actual, selectRewardCards: vi.fn() };
});

const makeCard = (id: string): BattleCard => makeTestCardWithId(id, { effects: [makeEffect("physical", 1)] });

beforeEach(() => {
  resetAllTestStores();
});

describe("refreshShopOfferings", () => {
  const newItems = [makeCard("b"), makeCard("c")];

  it("commits gold and refreshed state atomically", () => {
    setRunProgress({ runGold: 10 });
    setShopState({ ...createInitialShopState([], () => 0.5), refreshesLeft: 1 });
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    const refreshed = dispatchRunSessionCommand((draft) =>
      refreshShopOfferings<ShopState, BattleCard>({
        draft,
        price: 5,
        refreshesLeft: draft.session.shopState.refreshesLeft,
        setState: mutateShopState,
        resample: () => newItems,
        mapState: (previous, items) => mapRefreshedShopOfferings(previous, "cards", items),
      }),
    );
    unsubscribe();

    expect(refreshed).toMatchObject({ committed: true, price: 5, value: newItems });
    expect(commits).toHaveLength(1);
    expect(getRunProgressStoreView().runGold).toBe(5);
    expect(getRunSessionStoreView().shopState.cards).toEqual(newItems);
    expect(getRunSessionStoreView().shopState.refreshesLeft).toBe(0);
    expect(getRunSessionStoreView().shopState.purchasedSlotKeys).toEqual([]);
  });

  it.each([
    { name: "no refreshes remain", runGold: 10, refreshesLeft: 0 },
    { name: "gold is insufficient", runGold: 2, refreshesLeft: 1 },
  ])("does not publish a revision when $name", ({ runGold, refreshesLeft }) => {
    setRunProgress({ runGold });
    setShopState({ ...createInitialShopState([], () => 0.5), refreshesLeft });
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    const refreshed = dispatchRunSessionCommand((draft) =>
      refreshShopOfferings<ShopState, BattleCard>({
        draft,
        price: 5,
        refreshesLeft: draft.session.shopState.refreshesLeft,
        setState: mutateShopState,
        resample: () => newItems,
        mapState: (previous, items) => ({ ...previous, cards: items }),
      }),
    );
    unsubscribe();

    expect(refreshed).toMatchObject({ committed: false, price: 5, value: null });
    expect(commits).toHaveLength(0);
    expect(getRunProgressStoreView().runGold).toBe(runGold);
  });
});

describe("refreshCardShopOfferings", () => {
  it("selects replacement cards from the draft deck and supplied pool", () => {
    const deck = [makeCard("d")];
    const pool = [makeCard("x")];
    const currentItems = [makeCard("a")];
    const newItems = [makeCard("b")];
    const rng = () => 0.5;
    setRunProgress({ runGold: 10, runDeck: deck });
    setShopState({ ...createInitialShopState([], rng), cards: currentItems, refreshesLeft: 1 });
    vi.mocked(selectRewardCards).mockClear();
    vi.mocked(selectRewardCards).mockImplementation((actualDeck, actualPool, count, excluded, actualRng) => {
      expect(actualDeck).toEqual(deck);
      expect(actualPool).toBe(pool);
      expect(count).toBe(2);
      expect(excluded).toEqual(currentItems);
      expect(actualRng).toBe(rng);
      return newItems;
    });

    const refreshed = dispatchRunSessionCommand((draft) =>
      refreshCardShopOfferings<ShopState>({
        draft,
        price: 5,
        refreshesLeft: draft.session.shopState.refreshesLeft,
        pool,
        currentItems: draft.session.shopState.cards,
        count: 2,
        setState: mutateShopState,
        rng,
        mapState: (previous, cards) => ({ ...previous, cards }),
      }),
    );

    expect(refreshed).toMatchObject({ committed: true, price: 5, value: newItems });
    expect(selectRewardCards).toHaveBeenCalledOnce();
    expect(getRunSessionStoreView().shopState.cards).toEqual(newItems);
  });
});

describe("purchaseShopOffering", () => {
  it("does not spend gold when the payload is not the live offering", () => {
    setRunProgress({ runGold: 10 });
    setShopState({ ...emptyShopState(), purchasedSlotKeys: [] });
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));

    const result = dispatchRunSessionCommand((draft) =>
      purchaseShopOffering({
        draft,
        price: 5,
        state: draft.session.shopState,
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
    expect(getRunProgressStoreView().runGold).toBe(10);
  });
});

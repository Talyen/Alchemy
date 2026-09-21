import { describe, expect, it, vi } from "vitest";
import { createLabyrinthNodeRouting } from "@/features/alchemy/shell/labyrinth-node-routing";
import type { LabyrinthNodeHandlers } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { ROUTE_SCREENS } from "@/lib/routing";

function makeRoutingDeps(enterImpl: (handlers: LabyrinthNodeHandlers) => void) {
  return {
    prepareRoomTraits: vi.fn(),
    navigateTo: vi.fn(),
    labyrinth: {
      enterSelectedNode: (handlers: LabyrinthNodeHandlers) => {
        enterImpl(handlers);
        return true;
      },
    },
    battle: {
      startBattle: vi.fn(),
      startBossBattle: vi.fn(),
    },
    nav: { beginMysteryEvent: vi.fn() },
    shop: {
      initialize: vi.fn(),
    },
    corruption: {
      reset: vi.fn(),
    },
  };
}

describe("createLabyrinthNodeRouting", () => {
  it("starts mystery via beginMysteryEvent without a duplicate navigateTo", () => {
    const deps = makeRoutingDeps((handlers) => handlers.onStartMystery());
    const routing = createLabyrinthNodeRouting(deps);

    routing.handleLabyrinthNodeEnter();

    // Empty sets still forward [] so stale traits from the previous node are
    // cleared; the store writers skip the revision bump when already empty.
    expect(deps.prepareRoomTraits).toHaveBeenCalledWith([], expect.any(Array));
    expect(deps.prepareRoomTraits).toHaveBeenCalledWith(expect.any(Array), []);
    expect(deps.nav.beginMysteryEvent).toHaveBeenCalledOnce();
    expect(deps.navigateTo).not.toHaveBeenCalledWith(ROUTE_SCREENS.MYSTERY, expect.anything());
  });

  it("starts mystery with reward modifiers applied first", () => {
    const deps = makeRoutingDeps((handlers) => handlers.onStartMystery(["strong-spirits"]));
    deps.nav.beginMysteryEvent.mockImplementation(() => {
      expect(deps.prepareRoomTraits).toHaveBeenCalledWith(expect.any(Array), ["strong-spirits"]);
    });
    createLabyrinthNodeRouting(deps).handleLabyrinthNodeEnter();
    expect(deps.prepareRoomTraits).toHaveBeenCalledWith([], expect.any(Array));
    expect(deps.nav.beginMysteryEvent).toHaveBeenCalledOnce();
  });

  it("applies combat modifiers then starts battle, and initializes shops after empty modifiers", () => {
    const combatDeps = makeRoutingDeps((handlers) =>
      handlers.onStartBattleWithModifiers("elite", ["tempered"], ["generous"], "goblin"),
    );
    createLabyrinthNodeRouting(combatDeps).handleLabyrinthNodeEnter();

    expect(combatDeps.prepareRoomTraits).toHaveBeenCalledWith(["tempered"], expect.any(Array));
    expect(combatDeps.prepareRoomTraits).toHaveBeenCalledWith(expect.any(Array), ["generous"]);
    // Combat traits travel via session store, not battle-starter args.
    expect(combatDeps.battle.startBattle).toHaveBeenCalledWith(undefined, undefined, "elite", [], "goblin");
    expect(combatDeps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.BATTLE);

    const shopDeps = makeRoutingDeps((handlers) => handlers.onStartShop());
    createLabyrinthNodeRouting(shopDeps).handleLabyrinthNodeEnter();

    expect(shopDeps.prepareRoomTraits).toHaveBeenCalledWith([], expect.any(Array));
    expect(shopDeps.prepareRoomTraits).toHaveBeenCalledWith(expect.any(Array), []);
    expect(shopDeps.shop.initialize).toHaveBeenCalledWith("merchant");
    expect(shopDeps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.SHOP);
  });
});

it("passes support modifiers before initializing their destination", () => {
  const deps = makeRoutingDeps((handlers) => handlers.onStartAlchemist(["strong-spirits"]));
  deps.shop.initialize.mockImplementation(() => {
    expect(deps.prepareRoomTraits).toHaveBeenCalledWith(expect.any(Array), ["strong-spirits"]);
  });
  createLabyrinthNodeRouting(deps).handleLabyrinthNodeEnter();
  expect(deps.prepareRoomTraits).toHaveBeenCalledWith([], expect.any(Array));
  expect(deps.shop.initialize).toHaveBeenCalledWith("alchemist");
});

it("routes corruption nodes to the altar with cleared results and room modifiers", () => {
  const deps = makeRoutingDeps((handlers) => handlers.onStartCorruption(["blood-rite"]));
  createLabyrinthNodeRouting(deps).handleLabyrinthNodeEnter();

  expect(deps.prepareRoomTraits).toHaveBeenCalledWith([], expect.any(Array));
  expect(deps.prepareRoomTraits).toHaveBeenCalledWith(expect.any(Array), ["blood-rite"]);
  expect(deps.corruption.reset).toHaveBeenCalledOnce();
  expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.CORRUPTION);
});

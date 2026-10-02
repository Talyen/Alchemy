import { describe, expect, it, vi } from "vitest";
import { createLabyrinthNodeRouting } from "@/features/alchemy/shell/labyrinth-node-routing";
import type { LabyrinthNode } from "@/lib/content-systems/types";
import { gridLabyrinthMapFixture } from "../../../fixtures/labyrinth-map";
import { ROUTE_SCREENS } from "@/lib/routing";

function makeRoutingDeps(type: LabyrinthNode["type"], overrides: Partial<LabyrinthNode> = {}) {
  const node = { ...gridLabyrinthMapFixture().nodes["labyrinth-floor-1-n0"]!, type, ...overrides };
  return {
    prepareRoomTraits: vi.fn(),
    navigateTo: vi.fn((_screen: string, prepare?: () => void) => prepare?.()),
    labyrinth: {
      enterSelectedNode: (openRoom: (node: LabyrinthNode) => void) => {
        openRoom(node);
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
    const deps = makeRoutingDeps("mystery");
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
    const deps = makeRoutingDeps("mystery", { rewardModifiers: ["strong-spirits"] });
    deps.nav.beginMysteryEvent.mockImplementation(() => {
      expect(deps.prepareRoomTraits).toHaveBeenCalledWith(expect.any(Array), ["strong-spirits"]);
    });
    createLabyrinthNodeRouting(deps).handleLabyrinthNodeEnter();
    expect(deps.prepareRoomTraits).toHaveBeenCalledWith([], expect.any(Array));
    expect(deps.nav.beginMysteryEvent).toHaveBeenCalledOnce();
  });

  it.each(["combat", "elite", "boss"] as const)("prepares %s traits before starting its authored enemy", (type) => {
    const deps = makeRoutingDeps(type, { modifiers: ["tempered"], rewardModifiers: ["generous"], enemyId: "goblin" });
    const launch = type === "boss" ? deps.battle.startBossBattle : deps.battle.startBattle;
    launch.mockImplementation(() => {
      expect(deps.prepareRoomTraits).toHaveBeenCalledWith(["tempered"], ["generous"]);
    });
    createLabyrinthNodeRouting(deps).handleLabyrinthNodeEnter();
    // Combat traits travel via session store, not battle-starter args.
    expect(launch).toHaveBeenCalledWith(
      type === "boss"
        ? { modifiers: [], enemyId: "goblin" }
        : { enemyType: type === "elite" ? "elite" : "normal", modifiers: [], enemyId: "goblin" },
    );
    expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.BATTLE, expect.any(Function));
  });
});

it.each([
  ["shop", "merchant", ROUTE_SCREENS.SHOP],
  ["alchemist", "alchemist", ROUTE_SCREENS.ALCHEMIST],
  ["trinket-shop", "trinket", ROUTE_SCREENS.TRINKET_SHOP],
  ["equipment-shop", "equipment", ROUTE_SCREENS.EQUIPMENT_SHOP],
] as const)("prepares %s rewards and clears combat traits before initializing", (type, kind, screen) => {
  const deps = makeRoutingDeps(type, { modifiers: ["tempered"], rewardModifiers: ["strong-spirits"] });
  deps.shop.initialize.mockImplementation(() => {
    expect(deps.prepareRoomTraits).toHaveBeenCalledWith([], ["strong-spirits"]);
  });
  createLabyrinthNodeRouting(deps).handleLabyrinthNodeEnter();
  expect(deps.shop.initialize).toHaveBeenCalledWith(kind);
  expect(deps.navigateTo).toHaveBeenCalledWith(screen, expect.any(Function));
});

it("routes corruption nodes to the altar with cleared results and room modifiers", () => {
  const deps = makeRoutingDeps("corruption", { rewardModifiers: ["blood-rite"] });
  createLabyrinthNodeRouting(deps).handleLabyrinthNodeEnter();

  expect(deps.prepareRoomTraits).toHaveBeenCalledWith([], expect.any(Array));
  expect(deps.prepareRoomTraits).toHaveBeenCalledWith(expect.any(Array), ["blood-rite"]);
  expect(deps.corruption.reset).toHaveBeenCalledOnce();
  expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.CORRUPTION, expect.any(Function));
});

it("does not mutate traits or initialize destination if navigateTo does not execute prepare", () => {
  const deps = makeRoutingDeps("shop");
  deps.navigateTo = vi.fn(); // does not execute prepare callback
  createLabyrinthNodeRouting(deps).handleLabyrinthNodeEnter();

  expect(deps.prepareRoomTraits).not.toHaveBeenCalled();
  expect(deps.shop.initialize).not.toHaveBeenCalled();
  expect(deps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.SHOP, expect.any(Function));
});

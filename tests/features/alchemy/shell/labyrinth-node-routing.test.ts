import { describe, expect, it, vi } from "vitest";
import { createLabyrinthNodeRouting } from "@/features/alchemy/shell/labyrinth-node-routing";
import type { LabyrinthNodeHandlers } from "@/features/alchemy/shell/use-labyrinth-controller";
import { ROUTE_SCREENS } from "@/lib/routing";

function makeRoutingDeps(enterImpl: (handlers: LabyrinthNodeHandlers) => void) {
  return {
    applyLabyrinthBattleModifiers: vi.fn(),
    applyLabyrinthRewardModifiers: vi.fn(),
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
  };
}

describe("createLabyrinthNodeRouting", () => {
  it("starts mystery via beginMysteryEvent without a duplicate navigateTo", () => {
    const deps = makeRoutingDeps((handlers) => handlers.onStartMystery());
    const routing = createLabyrinthNodeRouting(deps);

    routing.handleLabyrinthNodeEnter();

    expect(deps.applyLabyrinthBattleModifiers).toHaveBeenCalledWith([]);
    expect(deps.applyLabyrinthRewardModifiers).toHaveBeenCalledWith([]);
    expect(deps.nav.beginMysteryEvent).toHaveBeenCalledOnce();
    expect(deps.navigateTo).not.toHaveBeenCalledWith(ROUTE_SCREENS.MYSTERY, expect.anything());
  });

  it("applies combat modifiers then starts battle, and initializes shops after empty modifiers", () => {
    const combatDeps = makeRoutingDeps((handlers) =>
      handlers.onStartBattleWithModifiers("elite", ["tempered"], ["generous"], "goblin"),
    );
    createLabyrinthNodeRouting(combatDeps).handleLabyrinthNodeEnter();

    expect(combatDeps.applyLabyrinthBattleModifiers).toHaveBeenCalledWith(["tempered"]);
    expect(combatDeps.applyLabyrinthRewardModifiers).toHaveBeenCalledWith(["generous"]);
    expect(combatDeps.battle.startBattle).toHaveBeenCalledWith(undefined, undefined, "elite", [], "goblin");
    expect(combatDeps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.BATTLE);

    const shopDeps = makeRoutingDeps((handlers) => handlers.onStartShop());
    createLabyrinthNodeRouting(shopDeps).handleLabyrinthNodeEnter();

    expect(shopDeps.applyLabyrinthBattleModifiers).toHaveBeenCalledWith([]);
    expect(shopDeps.applyLabyrinthRewardModifiers).toHaveBeenCalledWith([]);
    expect(shopDeps.shop.initialize).toHaveBeenCalledWith("merchant");
    expect(shopDeps.navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.SHOP);
  });
});

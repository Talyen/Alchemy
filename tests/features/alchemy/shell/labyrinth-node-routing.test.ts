import { describe, expect, it, vi } from "vitest";
import { createLabyrinthNodeRouting } from "@/features/alchemy/shell/labyrinth-node-routing";
import type { LabyrinthNodeHandlers } from "@/features/alchemy/shell/use-labyrinth-controller";
import { CONSTANTS } from "@/features/alchemy/shared/types";

function makeRoutingDeps(enterImpl: (handlers: LabyrinthNodeHandlers) => void) {
  return {
    applyLabyrinthBattleModifiers: vi.fn(),
    applyLabyrinthRewardModifiers: vi.fn(),
    navigateTo: vi.fn(),
    labyrinth: {
      enterNode: (_row: number, _col: number, handlers: LabyrinthNodeHandlers) => {
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

    routing.handleLabyrinthNodeEnter(0, 0);

    expect(deps.nav.beginMysteryEvent).toHaveBeenCalledOnce();
    expect(deps.navigateTo).not.toHaveBeenCalledWith(CONSTANTS.SCREENS.MYSTERY, expect.anything());
  });

  it("applies combat modifiers then starts battle, and initializes shops after empty modifiers", () => {
    const combatDeps = makeRoutingDeps((handlers) =>
      handlers.onStartBattleWithModifiers("elite", ["tempered"], ["generous"]),
    );
    createLabyrinthNodeRouting(combatDeps).handleLabyrinthNodeEnter(0, 0);

    expect(combatDeps.applyLabyrinthBattleModifiers).toHaveBeenCalledWith(["tempered"]);
    expect(combatDeps.applyLabyrinthRewardModifiers).toHaveBeenCalledWith(["generous"]);
    expect(combatDeps.battle.startBattle).toHaveBeenCalledWith(undefined, undefined, "elite", []);
    expect(combatDeps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.BATTLE);

    const shopDeps = makeRoutingDeps((handlers) => handlers.onStartShop());
    createLabyrinthNodeRouting(shopDeps).handleLabyrinthNodeEnter(0, 0);

    expect(shopDeps.applyLabyrinthBattleModifiers).toHaveBeenCalledWith([]);
    expect(shopDeps.applyLabyrinthRewardModifiers).toHaveBeenCalledWith([]);
    expect(shopDeps.shop.initialize).toHaveBeenCalledWith("merchant");
    expect(shopDeps.navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.SHOP);
  });
});

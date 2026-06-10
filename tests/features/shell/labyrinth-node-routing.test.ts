import { describe, expect, it, vi } from "vitest";
import { createLabyrinthNodeRouting } from "@/features/alchemy/shell/labyrinth-node-routing";
import { CONSTANTS } from "@/features/alchemy/shared/types";

describe("createLabyrinthNodeRouting", () => {
  it("starts mystery via beginMysteryEvent without a duplicate navigateTo", () => {
    const navigateTo = vi.fn();
    const beginMysteryEvent = vi.fn();
    const routing = createLabyrinthNodeRouting({
      applyLabyrinthBattleModifiers: vi.fn(),
      applyLabyrinthRewardModifiers: vi.fn(),
      navigateTo,
      labyrinth: {
        enterNode: (_row, _col, handlers) => {
          handlers.onStartMystery();
          return true;
        },
      },
      battle: {
        startBattle: vi.fn(),
        startBossBattle: vi.fn(),
      },
      nav: { beginMysteryEvent },
      shop: { initShop: vi.fn(), initAlchemist: vi.fn() },
    });

    routing.handleLabyrinthNodeEnter(0, 0);

    expect(beginMysteryEvent).toHaveBeenCalledOnce();
    expect(navigateTo).not.toHaveBeenCalledWith(CONSTANTS.SCREENS.MYSTERY, expect.anything());
  });
});

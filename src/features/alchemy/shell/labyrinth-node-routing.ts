// Labyrinth map node entry: apply modifiers, run screen init, then navigate.
import type { EncounterCombatTraitId, EncounterRewardTraitId } from "@/lib/content-systems/types";
import type { BattleCard, DifficultyModifier } from "@/lib/game-data";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";
import type { LabyrinthNodeHandlers } from "./use-labyrinth-controller";
import type { ShopActions } from "@/features/alchemy/run-loop/shop/shop-action-types";

interface LabyrinthNodeRoutingDeps {
  applyLabyrinthBattleModifiers: (modifiers: EncounterCombatTraitId[]) => void;
  applyLabyrinthRewardModifiers: (modifiers: EncounterRewardTraitId[]) => void;
  navigateTo: (screen: Screen, onRenderedScreenCommit?: () => void) => void;
  labyrinth: {
    enterNode: (row: number, col: number, handlers: LabyrinthNodeHandlers) => boolean;
  };
  battle: {
    startBattle: (
      deck?: BattleCard[],
      gold?: number,
      enemyType?: "normal" | "elite",
      modifiers?: DifficultyModifier[],
    ) => void;
    startBossBattle: (modifiers?: DifficultyModifier[]) => void;
  };
  nav: { beginMysteryEvent: () => void };
  shop: Pick<ShopActions, "initialize">;
}

export function createLabyrinthNodeRouting(deps: LabyrinthNodeRoutingDeps) {
  function enterLabyrinthNodeScreen(
    screen: Screen,
    init?: () => void,
    battleModifiers?: EncounterCombatTraitId[],
    rewardModifiers?: EncounterRewardTraitId[],
  ) {
    deps.applyLabyrinthBattleModifiers(battleModifiers ?? []);
    deps.applyLabyrinthRewardModifiers(rewardModifiers ?? []);
    init?.();
    deps.navigateTo(screen);
  }

  function handleLabyrinthNodeEnter(row: number, col: number): boolean {
    return deps.labyrinth.enterNode(row, col, {
      onStartBattleWithModifiers: (enemyType, modifiers, rewardModifiers) => {
        enterLabyrinthNodeScreen(
          CONSTANTS.SCREENS.BATTLE,
          () => {
            deps.battle.startBattle(undefined, undefined, enemyType, []);
          },
          modifiers,
          rewardModifiers,
        );
      },
      onStartBossBattleWithModifiers: (modifiers, rewardModifiers) => {
        enterLabyrinthNodeScreen(
          CONSTANTS.SCREENS.BATTLE,
          () => {
            deps.battle.startBossBattle([]);
          },
          modifiers,
          rewardModifiers,
        );
      },
      onStartRest: () => enterLabyrinthNodeScreen(CONSTANTS.SCREENS.CAMPFIRE),
      onStartMystery: () => deps.nav.beginMysteryEvent(),
      onStartShop: () => enterLabyrinthNodeScreen(CONSTANTS.SCREENS.SHOP, () => deps.shop.initialize("merchant")),
      onStartAlchemist: () =>
        enterLabyrinthNodeScreen(CONSTANTS.SCREENS.ALCHEMIST, () => deps.shop.initialize("alchemist")),
      onStartTrinketShop: () =>
        enterLabyrinthNodeScreen(CONSTANTS.SCREENS.TRINKET_SHOP, () => deps.shop.initialize("trinket")),
      onStartEquipmentShop: () =>
        enterLabyrinthNodeScreen(CONSTANTS.SCREENS.EQUIPMENT_SHOP, () => deps.shop.initialize("equipment")),
    });
  }

  return { handleLabyrinthNodeEnter };
}

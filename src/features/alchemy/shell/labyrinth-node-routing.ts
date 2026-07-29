// Labyrinth map node entry: apply modifiers, run screen init, then navigate.
import { labyrinthModifiersToDifficulty } from "@/lib/content-systems/labyrinth/modifiers";
import type { EncounterCombatTraitId, EncounterRewardTraitId } from "@/lib/content-systems/types";
import type { BattleCard, DifficultyModifier } from "@/lib/game-data";
import { CONSTANTS, type Screen } from "@/features/alchemy/shared/types";
import type { LabyrinthNodeHandlers } from "./use-labyrinth-controller";

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
  shop: { initShop: () => void; initAlchemist: () => void; initTrinketShop: () => void; initEquipmentShop: () => void };
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
            deps.battle.startBattle(undefined, undefined, enemyType, labyrinthModifiersToDifficulty());
          },
          modifiers,
          rewardModifiers,
        );
      },
      onStartBossBattleWithModifiers: (modifiers, rewardModifiers) => {
        enterLabyrinthNodeScreen(
          CONSTANTS.SCREENS.BATTLE,
          () => {
            deps.battle.startBossBattle(labyrinthModifiersToDifficulty());
          },
          modifiers,
          rewardModifiers,
        );
      },
      onStartRest: () => enterLabyrinthNodeScreen(CONSTANTS.SCREENS.CAMPFIRE),
      onStartMystery: () => deps.nav.beginMysteryEvent(),
      onStartShop: () => enterLabyrinthNodeScreen(CONSTANTS.SCREENS.SHOP, () => deps.shop.initShop()),
      onStartAlchemist: () => enterLabyrinthNodeScreen(CONSTANTS.SCREENS.ALCHEMIST, () => deps.shop.initAlchemist()),
      onStartTrinketShop: () =>
        enterLabyrinthNodeScreen(CONSTANTS.SCREENS.TRINKET_SHOP, () => deps.shop.initTrinketShop()),
      onStartEquipmentShop: () =>
        enterLabyrinthNodeScreen(CONSTANTS.SCREENS.EQUIPMENT_SHOP, () => deps.shop.initEquipmentShop()),
    });
  }

  return { handleLabyrinthNodeEnter };
}

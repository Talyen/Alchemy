// Labyrinth map node entry: apply modifiers, run screen init, then navigate.
import { labyrinthModifiersToDifficulty } from "@/lib/content-systems/labyrinth/modifiers";
import type { LabyrinthModifierKind } from "@/lib/content-systems/types";
import type { BattleCard, DifficultyModifier } from "@/lib/game-data";
import { CONSTANTS, type Screen } from "@/features/alchemy/shared/types";

type LabyrinthNodeRoutingDeps = {
  applyLabyrinthBattleModifiers: (modifiers: LabyrinthModifierKind[]) => void;
  applyLabyrinthRewardModifiers: (modifiers: LabyrinthModifierKind[]) => void;
  navigateTo: (screen: Screen, onRenderedScreenCommit?: () => void) => void;
  labyrinth: {
    enterNode: (
      row: number,
      col: number,
      handlers: {
        onStartBattleWithModifiers: (
          enemyType: "normal" | "elite",
          modifiers: LabyrinthModifierKind[],
          rewardModifiers: LabyrinthModifierKind[],
        ) => void;
        onStartBossBattleWithModifiers: (
          modifiers: LabyrinthModifierKind[],
          rewardModifiers: LabyrinthModifierKind[],
        ) => void;
        onStartRest: () => void;
        onStartMystery: () => void;
        onStartShop: () => void;
        onStartAlchemist: () => void;
      },
    ) => boolean;
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
  shop: { initShop: () => void; initAlchemist: () => void };
};

export function createLabyrinthNodeRouting(deps: LabyrinthNodeRoutingDeps) {
  function enterLabyrinthNodeScreen(
    screen: Screen,
    init?: () => void,
    battleModifiers?: LabyrinthModifierKind[],
    rewardModifiers?: LabyrinthModifierKind[],
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
            deps.battle.startBattle(undefined, undefined, enemyType, labyrinthModifiersToDifficulty(modifiers));
          },
          modifiers,
          rewardModifiers,
        );
      },
      onStartBossBattleWithModifiers: (modifiers, rewardModifiers) => {
        enterLabyrinthNodeScreen(
          CONSTANTS.SCREENS.BATTLE,
          () => {
            deps.battle.startBossBattle(labyrinthModifiersToDifficulty(modifiers));
          },
          modifiers,
          rewardModifiers,
        );
      },
      onStartRest: () => enterLabyrinthNodeScreen(CONSTANTS.SCREENS.CAMPFIRE),
      onStartMystery: () => deps.nav.beginMysteryEvent(),
      onStartShop: () => enterLabyrinthNodeScreen(CONSTANTS.SCREENS.SHOP, () => deps.shop.initShop()),
      onStartAlchemist: () => enterLabyrinthNodeScreen(CONSTANTS.SCREENS.ALCHEMIST, () => deps.shop.initAlchemist()),
    });
  }

  return { handleLabyrinthNodeEnter };
}

import type { LabyrinthNodeHandlers } from "./use-labyrinth-controller";
import type { ShopActions } from "@/features/alchemy/run-loop/shop/shop-action-types";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import { type EncounterCombatTraitId, type EncounterRewardTraitId } from "@/lib/content-systems/types";
import { type BattleCard, type DifficultyModifier } from "@/lib/game-data";

interface LabyrinthNodeRoutingDeps {
  applyLabyrinthBattleModifiers: (modifiers: EncounterCombatTraitId[]) => void;
  applyLabyrinthRewardModifiers: (modifiers: EncounterRewardTraitId[]) => void;
  navigateTo: (screen: Screen, onRenderedScreenCommit?: () => void) => void;
  labyrinth: {
    enterSelectedNode: (handlers: LabyrinthNodeHandlers) => boolean;
  };
  battle: {
    startBattle: (
      deck?: BattleCard[],
      gold?: number,
      enemyType?: "normal" | "elite",
      modifiers?: DifficultyModifier[],
      enemyId?: string,
    ) => void;
    startBossBattle: (modifiers?: DifficultyModifier[], enemyId?: string) => void;
  };
  nav: { beginMysteryEvent: () => void };
  shop: Pick<ShopActions, "initialize">;
}

export function createLabyrinthNodeRouting(deps: LabyrinthNodeRoutingDeps) {
  function applyNodeModifiers(
    battleModifiers: EncounterCombatTraitId[] = [],
    rewardModifiers: EncounterRewardTraitId[] = [],
  ) {
    deps.applyLabyrinthBattleModifiers(battleModifiers);
    deps.applyLabyrinthRewardModifiers(rewardModifiers);
  }

  function enterLabyrinthNodeScreen(
    screen: Screen,
    init?: () => void,
    battleModifiers?: EncounterCombatTraitId[],
    rewardModifiers?: EncounterRewardTraitId[],
  ) {
    applyNodeModifiers(battleModifiers ?? [], rewardModifiers ?? []);
    init?.();
    deps.navigateTo(screen);
  }

  function handleLabyrinthNodeEnter(): boolean {
    return deps.labyrinth.enterSelectedNode({
      onStartBattleWithModifiers: (enemyType, modifiers, rewardModifiers, enemyId) => {
        enterLabyrinthNodeScreen(
          ROUTE_SCREENS.BATTLE,
          () => {
            deps.battle.startBattle(undefined, undefined, enemyType, [], enemyId);
          },
          modifiers,
          rewardModifiers,
        );
      },
      onStartBossBattleWithModifiers: (modifiers, rewardModifiers, enemyId) => {
        enterLabyrinthNodeScreen(
          ROUTE_SCREENS.BATTLE,
          () => {
            deps.battle.startBossBattle([], enemyId);
          },
          modifiers,
          rewardModifiers,
        );
      },
      onStartRest: () => enterLabyrinthNodeScreen(ROUTE_SCREENS.CAMPFIRE),
      onStartMystery: () => {
        applyNodeModifiers();
        deps.nav.beginMysteryEvent();
      },
      onStartShop: () => enterLabyrinthNodeScreen(ROUTE_SCREENS.SHOP, () => deps.shop.initialize("merchant")),
      onStartAlchemist: () =>
        enterLabyrinthNodeScreen(ROUTE_SCREENS.ALCHEMIST, () => deps.shop.initialize("alchemist")),
      onStartTrinketShop: () =>
        enterLabyrinthNodeScreen(ROUTE_SCREENS.TRINKET_SHOP, () => deps.shop.initialize("trinket")),
      onStartEquipmentShop: () =>
        enterLabyrinthNodeScreen(ROUTE_SCREENS.EQUIPMENT_SHOP, () => deps.shop.initialize("equipment")),
    });
  }

  return { handleLabyrinthNodeEnter };
}

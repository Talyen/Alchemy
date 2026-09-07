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
      onStartRest: (modifiers = []) => enterLabyrinthNodeScreen(ROUTE_SCREENS.CAMPFIRE, undefined, [], modifiers),
      onStartMystery: (modifiers = []) => {
        applyNodeModifiers([], modifiers);
        deps.nav.beginMysteryEvent();
      },
      onStartShop: (modifiers = []) =>
        enterLabyrinthNodeScreen(ROUTE_SCREENS.SHOP, () => deps.shop.initialize("merchant"), [], modifiers),
      onStartAlchemist: (modifiers = []) =>
        enterLabyrinthNodeScreen(ROUTE_SCREENS.ALCHEMIST, () => deps.shop.initialize("alchemist"), [], modifiers),
      onStartTrinketShop: (modifiers = []) =>
        enterLabyrinthNodeScreen(ROUTE_SCREENS.TRINKET_SHOP, () => deps.shop.initialize("trinket"), [], modifiers),
      onStartEquipmentShop: (modifiers = []) =>
        enterLabyrinthNodeScreen(ROUTE_SCREENS.EQUIPMENT_SHOP, () => deps.shop.initialize("equipment"), [], modifiers),
    });
  }

  return { handleLabyrinthNodeEnter };
}

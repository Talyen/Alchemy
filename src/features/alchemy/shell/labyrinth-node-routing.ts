import type { ShopActions } from "@/features/alchemy/run-loop/shop/shop-action-types";
import { type EncounterCombatTraitId, type EncounterRewardTraitId } from "@/lib/content-systems/types";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";
import type { LabyrinthNodeHandlers } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import type { BattleLauncherDeps } from "./shell-types";

interface LabyrinthNodeRoutingDeps {
  prepareRoomTraits: (combat: EncounterCombatTraitId[], rewards: EncounterRewardTraitId[]) => void;
  navigateTo: (screen: Screen, prepareNavigation?: () => void) => void;
  labyrinth: {
    enterSelectedNode: (handlers: LabyrinthNodeHandlers) => boolean;
  };
  battle: {
    startBattle?: BattleLauncherDeps["startBattle"];
    startBossBattle?: BattleLauncherDeps["startBossBattle"];
    onStartBattle?: BattleLauncherDeps["startBattle"];
    onStartBossBattle?: BattleLauncherDeps["startBossBattle"];
  };
  nav: { beginMysteryEvent: () => void };
  shop: Pick<ShopActions, "initialize">;
  corruption: { reset: () => void };
}

export function createLabyrinthNodeRouting(deps: LabyrinthNodeRoutingDeps) {
  const startBattle = deps.battle.startBattle ?? deps.battle.onStartBattle;
  const startBossBattle = deps.battle.startBossBattle ?? deps.battle.onStartBossBattle;

  function applyNodeModifiers(
    battleModifiers: EncounterCombatTraitId[] = [],
    rewardModifiers: EncounterRewardTraitId[] = [],
  ) {
    // Always forward, including [] clears: the store writers skip the write
    // only when already empty (no revision bump), so stale traits from the
    // previous node cannot leak into nodes without modifiers.
    deps.prepareRoomTraits(battleModifiers, rewardModifiers);
  }

  function enterLabyrinthNodeScreen(
    screen: Screen,
    init?: () => void,
    battleModifiers?: EncounterCombatTraitId[],
    rewardModifiers?: EncounterRewardTraitId[],
  ) {
    deps.navigateTo(screen, () => {
      applyNodeModifiers(battleModifiers ?? [], rewardModifiers ?? []);
      init?.();
    });
  }

  function handleLabyrinthNodeEnter(): boolean {
    return deps.labyrinth.enterSelectedNode({
      onStartBattleWithModifiers: (enemyType, modifiers, rewardModifiers, enemyId) => {
        // Combat traits travel via the run session (activeLabyrinthModifiers),
        // not battle-starter args, so battles stay seeded from one source.
        enterLabyrinthNodeScreen(
          ROUTE_SCREENS.BATTLE,
          () => {
            startBattle?.(undefined, undefined, enemyType, [], enemyId);
          },
          modifiers,
          rewardModifiers,
        );
      },
      onStartBossBattleWithModifiers: (modifiers, rewardModifiers, enemyId) => {
        enterLabyrinthNodeScreen(
          ROUTE_SCREENS.BATTLE,
          () => {
            startBossBattle?.([], enemyId);
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
      onStartCorruption: (modifiers = []) =>
        enterLabyrinthNodeScreen(ROUTE_SCREENS.CORRUPTION, () => deps.corruption.reset(), [], modifiers),
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

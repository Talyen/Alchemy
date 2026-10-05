import { initializeAlchemyVisit } from "@/features/alchemy/run-loop/navigation/alchemy-commands";
import type { LabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import type { ShopActions } from "@/features/alchemy/run-loop/shop/shop-action-types";
import type { BattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import type {
  EncounterCombatTraitId,
  EncounterRewardTraitId,
  LabyrinthNode,
  LabyrinthNodeType,
} from "@/lib/content-systems/types";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";

interface LabyrinthNodeRoutingDeps {
  prepareRoomTraits: (combat: EncounterCombatTraitId[], rewards: EncounterRewardTraitId[]) => void;
  navigateTo: (screen: Screen, prepareNavigation?: () => void) => void;
  labyrinth: Pick<LabyrinthController, "enterSelectedNode">;
  battle: Pick<BattleStartCommands, "startBattle" | "startBossBattle">;
  nav: { beginMysteryEvent: () => void };
  shop: Pick<ShopActions, "initialize">;
  corruption: { reset: () => void };
}

export function createLabyrinthNodeRouting(
  deps: LabyrinthNodeRoutingDeps,
  gameSession: GameSession = defaultGameSession,
) {
  const rooms: Record<
    Exclude<LabyrinthNodeType, "entrance" | "mystery">,
    { screen: Screen; initialize?: (node: LabyrinthNode) => void }
  > = {
    combat: {
      screen: ROUTE_SCREENS.BATTLE,
      initialize: (node) => deps.battle.startBattle({ enemyType: "normal", modifiers: [], enemyId: node.enemyId }),
    },
    elite: {
      screen: ROUTE_SCREENS.BATTLE,
      initialize: (node) => deps.battle.startBattle({ enemyType: "elite", modifiers: [], enemyId: node.enemyId }),
    },
    boss: {
      screen: ROUTE_SCREENS.BATTLE,
      initialize: (node) => deps.battle.startBossBattle({ modifiers: [], enemyId: node.enemyId }),
    },
    rest: { screen: ROUTE_SCREENS.CAMPFIRE, initialize: () => initializeAlchemyVisit("campfire", gameSession) },
    transmutation: {
      screen: ROUTE_SCREENS.TRANSMUTATION,
      initialize: () => initializeAlchemyVisit("transmutation", gameSession),
    },
    corruption: { screen: ROUTE_SCREENS.CORRUPTION, initialize: () => deps.corruption.reset() },
    shop: { screen: ROUTE_SCREENS.SHOP, initialize: () => deps.shop.initialize("merchant") },
    alchemist: { screen: ROUTE_SCREENS.ALCHEMIST, initialize: () => deps.shop.initialize("alchemist") },
    "trinket-shop": { screen: ROUTE_SCREENS.TRINKET_SHOP, initialize: () => deps.shop.initialize("trinket") },
    "equipment-shop": { screen: ROUTE_SCREENS.EQUIPMENT_SHOP, initialize: () => deps.shop.initialize("equipment") },
  };

  function openRoom(node: LabyrinthNode) {
    if (node.type === "entrance") return;
    if (node.type === "mystery") {
      deps.prepareRoomTraits([], node.rewardModifiers);
      deps.nav.beginMysteryEvent();
      return;
    }
    const room = rooms[node.type];
    deps.navigateTo(room.screen, () => {
      // Combat traits live in the session, not battle-starter args. Forward
      // empty lists too, so traits from the previous room cannot leak.
      const combat = node.type === "combat" || node.type === "elite" || node.type === "boss";
      deps.prepareRoomTraits(combat ? node.modifiers : [], node.rewardModifiers);
      room.initialize?.(node);
    });
  }

  return { handleLabyrinthNodeEnter: () => deps.labyrinth.enterSelectedNode(openRoom) };
}

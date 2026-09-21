import { createRunFlowEngine } from "@/features/alchemy/shell/run-flow-engine";
import { createRunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { readRunAvailableDestinations } from "@/features/alchemy/shell/run-destination-wiring";
import { createScreenNavigation } from "@/features/alchemy/shell/screen-navigation";
import { createBattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { createLabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { createLabyrinthNodeRouting } from "@/features/alchemy/shell/labyrinth-node-routing";
import { readActiveRunScreen, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import {
  prepareRunScreen,
  showRunScreen,
  prepareLabyrinthRoomTraits,
  resetCorruptionVisit,
} from "@/features/alchemy/shared/stores/navigation-commands";
import { computeTalentEffects } from "@/lib/game-data";

export function createPlaythroughController() {
  const navigation = createScreenNavigation({
    readScreen: readActiveRunScreen,
    prepareScreen: prepareRunScreen,
    showScreen: showRunScreen,
  });
  const transition: typeof navigation.transition = (screen, options) =>
    navigation.transition(screen, { ...options, immediate: true });
  const navigateTo: typeof navigation.navigateTo = (screen, prepare) => transition(screen, prepare ? { prepare } : {});
  const outcomes = createRunOutcomes({
    actions: { navigateTo, transition, clearCardHover: () => {} },
    getAvailableDestinations: readRunAvailableDestinations,
  });
  const battle = createBattleStartCommands(({ outcome }) => {
    if (outcome === "victory") outcomes.victory.handleBattleVictory();
    if (outcome === "defeat") outcomes.defeat.handleBattleDefeat();
  });
  // Pricing manifests are refreshed for every call, including after between-run spending.
  const shop = () =>
    createShopActions({
      talentEffects: computeTalentEffects(readRunProfile().unlockedTalents),
      homesteadEffects: readRunProfile().effects,
    });
  const labyrinth = createLabyrinthController();
  const flow = createRunFlowEngine(
    {
      navigateTo,
      transition,
      cancelPending: navigation.cancelPending,
      battle: {
        onStartBattle: battle.startBattle,
        onStartBossBattle: battle.startBossBattle,
        onStartBossById: battle.startBossById,
      },
      initializeShop: (kind) => shop().initialize(kind),
      labyrinthClearNode: labyrinth.onNodeCleared,
    },
    outcomes,
  );
  const nodes = createLabyrinthNodeRouting({
    navigateTo,
    labyrinth,
    battle,
    nav: flow,
    shop: { initialize: (kind) => shop().initialize(kind) },
    prepareRoomTraits: prepareLabyrinthRoomTraits,
    corruption: { reset: resetCorruptionVisit },
  });
  return { flow, shop, labyrinth, nodes };
}

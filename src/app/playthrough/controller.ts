import { createLabyrinthController } from "@/features/alchemy/run-loop/run/labyrinth-controller";
import { createRunOutcomes } from "@/features/alchemy/run-loop/run/run-flow";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { createBattleStartCommands } from "@/features/alchemy/shared/stores/battle-start-commands";
import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import { type GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { showRunScreen } from "@/features/alchemy/shared/stores/navigation-commands";
import { readActiveRunScreen, readRunProfile } from "@/features/alchemy/shared/stores/run-reads";
import { createLabyrinthNodeRouting } from "@/features/alchemy/shell/labyrinth-node-routing";
import { readRunAvailableDestinations } from "@/features/alchemy/shell/run-destination-wiring";
import { createRunFlowEngine } from "@/features/alchemy/shell/run-flow-engine";
import { createScreenNavigation } from "@/features/alchemy/shell/screen-navigation";
import { computeTalentEffects } from "@/lib/game-data";

export function createPlaythroughController(gameSession: GameSession = defaultGameSession) {
  const navigation = createScreenNavigation(
    {
      readScreen: () => readActiveRunScreen(gameSession),
      showScreen: (arg0: Parameters<typeof showRunScreen>[0]) => showRunScreen(arg0, gameSession),
    },
    gameSession,
  );
  const transition: typeof navigation.transition = (screen, options) =>
    navigation.transition(screen, { ...options, immediate: true });
  const navigateTo: typeof navigation.navigateTo = (screen, prepare) => transition(screen, prepare ? { prepare } : {});
  const resumeTo: typeof navigation.resumeTo = (screen, prepare) => navigation.resumeTo(screen, prepare, true);
  const outcomes = createRunOutcomes(
    {
      actions: { navigateTo, transition, clearCardHover: () => {} },
      getAvailableDestinations: (arg0?: Parameters<typeof readRunAvailableDestinations>[0]) =>
        readRunAvailableDestinations(arg0, gameSession),
    },
    gameSession,
  );
  const battle = createBattleStartCommands(({ outcome }) => {
    if (outcome === "victory") outcomes.victory.handleBattleVictory();
    if (outcome === "defeat") outcomes.defeat.handleBattleDefeat();
  }, gameSession);
  // Pricing manifests are refreshed for every call, including after between-run spending.
  const shop = () =>
    createShopActions(
      {
        talentEffects: computeTalentEffects(readRunProfile(gameSession).unlockedTalents),
        homesteadEffects: readRunProfile(gameSession).effects,
      },
      gameSession,
    );
  const labyrinth = createLabyrinthController(gameSession);
  const flow = createRunFlowEngine(
    {
      navigateTo,
      resumeTo,
      transition,
      cancelPending: navigation.cancelPending,
      battle,
      labyrinthClearNode: labyrinth.onNodeCleared,
    },
    outcomes,
    gameSession,
  );
  const nodes = createLabyrinthNodeRouting(
    {
      navigateTo,
      labyrinth,
      presentBattleStart: battle.presentBattleStart,
    },
    gameSession,
  );
  return { flow, shop, labyrinth, nodes };
}

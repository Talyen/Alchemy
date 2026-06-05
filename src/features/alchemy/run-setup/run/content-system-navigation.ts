// Content-system entry: campaign, labyrinth, wildwood, character select, and run start.
import type { RefObject } from "react";
import { logError } from "@/lib/error-logger";
import { playGoldGain } from "@/lib/audio";
import { appendUniqueMany } from "@/lib/utils";
import { getDifficultyModifiers, type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";
import { DEFAULT_BATTLE_ENEMY_TYPE } from "@/lib/game-constants";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { useHomesteadStore } from "../../shared/stores/homestead-store";
import { useUiStore } from "../../shared/stores/ui-store";
import {
  setHasActiveRun,
  setPendingCharacterId,
  setPendingContentSystemType,
  setRewardState,
} from "../../shared/stores/run-session-actions";
import { readRunSessionStore } from "../../shared/stores/run-session-read";
import { afterCampaignCharacterResolved } from "@/features/alchemy/navigation/run-navigation-helpers";
import { createDestinationRewardState } from "@/features/alchemy/navigation/victory-flow";
import { sampleDestinationChoices } from "@/features/alchemy/navigation/destination-flow";
import { restoreOrCreateDestinationRewardState } from "@/features/alchemy/navigation/destination-flow";
import { getPreviousDestination } from "@/features/alchemy/navigation/run-navigation-helpers";
import { createRunStartSnapshot, type RunStartSnapshot } from "./run-start";
import { getBossEnemy } from "@/features/alchemy/config";
import { CONSTANTS, type Destination, type Screen } from "../../shared/types";
import type { RunStateController, TalentStateController } from "../../shared/stores/run-store";
import type { DestinationOptionsInput } from "@/lib/active-run-session";

export type ContentSystemNavigationDeps = {
  run: RunStateController;
  talents: TalentStateController;
  draftedDeckRef: RefObject<BattleCard[] | null>;
  hasActiveRun: boolean;
  hasActiveBattle: boolean;
  pendingContentSystemType: ContentSystemId | null;
  completedDifficulties: Record<string, DifficultyId[]>;
  navigateTo: (nextScreen: Screen, onRenderedScreenCommit?: () => void) => void;
  returnToBattle: () => void;
  onStartBattle: (
    deck?: BattleCard[],
    gold?: number,
    enemyType?: "normal" | "elite",
    modifiers?: ReturnType<typeof getDifficultyModifiers>,
  ) => void;
  getAvailableDestinations: (options?: DestinationOptionsInput) => Destination[];
  setDiscoveredCardIds: React.Dispatch<React.SetStateAction<string[]>>;
  setEncounteredEnemyIds: React.Dispatch<React.SetStateAction<string[]>>;
};

export function createContentSystemNavigation(deps: ContentSystemNavigationDeps) {
  function createInitialDestinations(options?: DestinationOptionsInput, prevDest?: Destination) {
    return createDestinationRewardState(
      sampleDestinationChoices(deps.getAvailableDestinations(options), prevDest),
      getBossEnemy().id,
    );
  }

  function applyRunStartSnapshot(snapshot: RunStartSnapshot) {
    deps.run.hydrateFromSnapshot(snapshot);
    setHasActiveRun(snapshot.hasActiveRun);
  }

  function startRun(
    characterId: CharacterId,
    contentSystemType: ContentSystemId,
    options: {
      difficultyId?: DifficultyId | null;
      discoverStarterDeck?: boolean;
      playStartGoldSound?: boolean;
      resetEncounteredEnemies?: boolean;
    } = {},
  ) {
    const snapshot = createStartSnapshot(characterId, contentSystemType, options.difficultyId);
    applyRunStartSnapshot(snapshot);
    if (options.playStartGoldSound && snapshot.runGold > 0) {
      playGoldGain();
    }
    if (options.discoverStarterDeck || characterId === "wildcard") {
      deps.setDiscoveredCardIds((current) =>
        appendUniqueMany(
          current,
          snapshot.freshDeck.map((c) => c.id),
        ),
      );
    }
    if (options.resetEncounteredEnemies) {
      deps.setEncounteredEnemyIds([]);
    }
    useUiStore.getState().clearCardHover();
    return snapshot;
  }

  function createStartSnapshot(
    characterId: CharacterId,
    contentSystemType: ContentSystemId,
    difficultyId?: DifficultyId | null,
  ) {
    const homesteadEffects = useHomesteadStore.getState().effects;
    const baseInput = {
      characterId,
      contentSystemType,
      difficultyId,
      talentStartGold: deps.talents.talentEffects.startGold,
      homesteadStartGold: homesteadEffects.startGold,
      homesteadStartMaxHealthBonus: homesteadEffects.startMaxHealthBonus,
    };
    return createRunStartSnapshot(
      characterId === "wildcard" && deps.draftedDeckRef.current
        ? { ...baseInput, draftedDeck: deps.draftedDeckRef.current }
        : baseInput,
    );
  }

  function initializeRunForDifficulty(characterId: CharacterId, difficultyId: DifficultyId) {
    const snapshot = startRun(characterId, CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN, {
      difficultyId,
      discoverStarterDeck: true,
      playStartGoldSound: true,
      resetEncounteredEnemies: true,
    });
    setRewardState(
      createInitialDestinations({
        currentHealth: snapshot.runMaxHealth,
        currentGold: snapshot.runGold,
        destinationIndexInAct: 0,
        maxHealth: snapshot.runMaxHealth,
      }),
    );
    return { freshDeck: snapshot.freshDeck, totalStartGold: snapshot.runGold };
  }

  function initializeLabyrinthRun(characterId: CharacterId) {
    startRun(characterId, CONSTANTS.CONTENT_SYSTEMS.LABYRINTH, { discoverStarterDeck: true, playStartGoldSound: true });
    deps.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
  }

  function initializeWildwoodRun(characterId: CharacterId) {
    startRun(characterId, CONSTANTS.CONTENT_SYSTEMS.WILDWOOD);
    deps.navigateTo(CONSTANTS.SCREENS.WILDWOOD_SELECT);
  }

  const noviceCampaignDeps = () => ({
    completedDifficulties: deps.completedDifficulties,
    initializeRunForDifficulty,
    getDifficultyModifiers,
    onStartBattle: deps.onStartBattle,
    navigateToBattle: () => deps.navigateTo(CONSTANTS.SCREENS.BATTLE),
  });

  function beginContentSystem(systemId: ContentSystemId) {
    if (deps.hasActiveBattle && deps.run.contentSystemType === systemId) {
      deps.returnToBattle();
      return;
    }
    if (deps.hasActiveRun && deps.run.contentSystemType === systemId) {
      if (systemId === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
        deps.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
      } else if (systemId === CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN) {
        const prevDest = getPreviousDestination(deps.run.destinationIndexInAct, deps.run.completedDestinations);
        deps.navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
          setRewardState((prev) =>
            restoreOrCreateDestinationRewardState(prev, {
              availableDestinations: deps.getAvailableDestinations(),
              ...(prevDest !== undefined ? { previousDestination: prevDest } : {}),
              bossEnemyId: getBossEnemy().id,
            }),
          );
        });
      } else if (systemId === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
        deps.navigateTo(CONSTANTS.SCREENS.WILDWOOD_SELECT);
      }
      return;
    }
    setPendingContentSystemType(systemId);
    deps.navigateTo(CONSTANTS.SCREENS.CHARACTER_SELECT);
  }

  function beginCampaign() {
    beginContentSystem(CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN);
  }

  function beginLabyrinth() {
    beginContentSystem(CONSTANTS.CONTENT_SYSTEMS.LABYRINTH);
  }

  function beginWildwood() {
    beginContentSystem(CONSTANTS.CONTENT_SYSTEMS.WILDWOOD);
  }

  function handleCharacterSelect(selectedId: CharacterId) {
    const systemType = deps.pendingContentSystemType;

    if (selectedId === "wildcard") {
      setPendingCharacterId(selectedId);
      deps.draftedDeckRef.current = null;
      deps.navigateTo(CONSTANTS.SCREENS.DRAFT_DECK);
      return;
    }

    if (systemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      initializeLabyrinthRun(selectedId);
      return;
    }
    if (systemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      initializeWildwoodRun(selectedId);
      return;
    }
    if (systemType !== CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN) {
      logError(`[useRunNavigation] handleCharacterSelect: unhandled content system ${systemType}`, "other");
      deps.navigateTo(CONSTANTS.SCREENS.MENU);
      return;
    }

    afterCampaignCharacterResolved(selectedId, noviceCampaignDeps(), () => {
      setPendingCharacterId(selectedId);
      deps.navigateTo(CONSTANTS.SCREENS.DIFFICULTY_SELECT);
    });
  }

  function handleDraftComplete(draftedCards: BattleCard[]) {
    deps.draftedDeckRef.current = draftedCards;
    const systemType = deps.pendingContentSystemType;

    if (systemType === CONSTANTS.CONTENT_SYSTEMS.LABYRINTH) {
      initializeLabyrinthRun("wildcard");
      return;
    }
    if (systemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      initializeWildwoodRun("wildcard");
      return;
    }

    afterCampaignCharacterResolved("wildcard", noviceCampaignDeps(), () =>
      deps.navigateTo(CONSTANTS.SCREENS.DIFFICULTY_SELECT),
    );
  }

  function handleDifficultySelect(difficultyId: DifficultyId) {
    const pendingCharacterId = readRunSessionStore().pendingCharacterId;
    if (!pendingCharacterId) {
      logError("[useRunNavigation] handleDifficultySelect: no pending character", "other");
      deps.navigateTo(CONSTANTS.SCREENS.MENU);
      return;
    }
    const selectedId = pendingCharacterId;
    const { freshDeck, totalStartGold } = initializeRunForDifficulty(selectedId, difficultyId);
    const modifiers = getDifficultyModifiers(selectedId, difficultyId);
    deps.onStartBattle(freshDeck, totalStartGold, DEFAULT_BATTLE_ENEMY_TYPE, modifiers);
    deps.navigateTo(CONSTANTS.SCREENS.BATTLE, () => setPendingCharacterId(null));
  }

  function handleBackFromDifficultySelect() {
    deps.navigateTo(CONSTANTS.SCREENS.CHARACTER_SELECT);
  }

  return {
    beginCampaign,
    beginLabyrinth,
    beginWildwood,
    handleCharacterSelect,
    handleDraftComplete,
    handleDifficultySelect,
    handleBackFromDifficultySelect,
    startRun,
    initializeRunForDifficulty,
    createInitialDestinations,
  };
}

export type ContentSystemNavigationApi = ReturnType<typeof createContentSystemNavigation>;

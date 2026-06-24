// Content-system entry: campaign, labyrinth, wildwood, character select, and run start.
import type { RefObject } from "react";
import { logError } from "@/lib/error-logger";
import { playGoldGain } from "@/lib/audio";
import { appendUniqueMany } from "@/lib/utils";
import { getDifficultyModifiers, type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";
import { DEFAULT_BATTLE_ENEMY_TYPE, DRAFT_ROUNDS } from "@/lib/game-constants";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { useAppStore } from "../../shared/stores/app-store";
import { useUiStore } from "../../shared/stores/ui-store";
import { useGearStore } from "../../shared/stores/gear-store";
import {
  setHasActiveRun,
  setPendingCharacterId,
  setPendingContentSystemType,
  setRewardState,
  setWildwoodDraft,
  readRunSessionStore,
  getRunDomainStore,
} from "../../shared/stores/run-session-facade";
import { afterCampaignCharacterResolved } from "@/features/alchemy/run-loop/navigation/run-navigation-helpers";
import { createDestinationRewardState } from "@/features/alchemy/run-loop/navigation/victory-flow";
import {
  sampleDestinationChoices,
  restoreOrCreateDestinationRewardState,
  type DestinationOptionsInput,
} from "@/features/alchemy/run-loop/navigation/destination-flow";
import { createRunStartSnapshot, type RunStartSnapshot } from "./run-start";
import { getBossEnemy } from "@/features/alchemy/shared/config";
import { CONSTANTS, type Destination, type Screen } from "../../shared/types";
import type { RunStateController, TalentStateController } from "../../shared/stores/run-session-facade";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { computeGearManifest, flattenGearInventories } from "@/lib/gear";

export interface ContentSystemNavigationDeps {
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
  onResumeWildwood: () => void;
  onStartNextWildwoodBoss: () => void;
}

export function createContentSystemNavigation(deps: ContentSystemNavigationDeps) {
  function createInitialDestinations(options?: DestinationOptionsInput) {
    const sampled = sampleDestinationChoices(deps.getAvailableDestinations(options), {
      lastOfferedDestinations: deps.run.lastOfferedDestinations,
      roundsSinceOffered: deps.run.destinationRoundsSinceOffered,
    });
    deps.run.setDestinationOfferState(sampled.offerState);
    return createDestinationRewardState(sampled.choices, getBossEnemy().id);
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
      draftedDeck?: BattleCard[];
    } = {},
  ) {
    const snapshot = createStartSnapshot(characterId, contentSystemType, options.difficultyId, options.draftedDeck);
    applyRunStartSnapshot(snapshot);
    if (options.playStartGoldSound && snapshot.runGold > 0) {
      playGoldGain();
    }
    if (options.discoverStarterDeck || characterId === "wildcard") {
      useAppStore.getState().setDiscoveredCardIds((current) =>
        appendUniqueMany(
          current,
          snapshot.freshDeck.map((c) => c.id),
        ),
      );
    }
    if (options.resetEncounteredEnemies) {
      useAppStore.getState().setEncounteredEnemyIds([]);
    }
    useUiStore.getState().clearCardHover();
    return snapshot;
  }

  function createStartSnapshot(
    characterId: CharacterId,
    contentSystemType: ContentSystemId,
    difficultyId?: DifficultyId | null,
    draftedDeck?: BattleCard[],
  ) {
    const baseInput = {
      characterId,
      contentSystemType,
      difficultyId,
      talentStartGold: deps.talents.talentEffects.startGold,
      talentXP: deps.talents.talentXP,
    };
    const resolvedDraft =
      draftedDeck !== undefined
        ? draftedDeck
        : characterId === "wildcard" && deps.draftedDeckRef.current
          ? deps.draftedDeckRef.current
          : undefined;
    return createRunStartSnapshot(
      resolvedDraft !== undefined
        ? {
            ...baseInput,
            draftedDeck: resolvedDraft,
            gearMaxHealthBonus: computeGearManifest(
              characterId,
              flattenGearInventories(useGearStore.getState().inventories),
              useGearStore.getState().loadouts,
            ).maxHealth,
            homesteadMaxHealthBonus: getRunDomainStore().progress.effects.runMaxHealthBonus,
          }
        : {
            ...baseInput,
            gearMaxHealthBonus: computeGearManifest(
              characterId,
              flattenGearInventories(useGearStore.getState().inventories),
              useGearStore.getState().loadouts,
            ).maxHealth,
            homesteadMaxHealthBonus: getRunDomainStore().progress.effects.runMaxHealthBonus,
          },
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

  function initializeWildwoodRun(characterId: CharacterId, initialDeck?: BattleCard[]) {
    const skipDraft = initialDeck !== undefined && initialDeck.length >= DRAFT_ROUNDS;
    setWildwoodDraft(createInitialWildwoodDraftState(characterId));
    if (skipDraft) {
      startRun(characterId, CONSTANTS.CONTENT_SYSTEMS.WILDWOOD, {
        draftedDeck: initialDeck,
        discoverStarterDeck: true,
      });
      setPendingCharacterId(null);
      deps.onStartNextWildwoodBoss();
      return;
    }
    startRun(characterId, CONSTANTS.CONTENT_SYSTEMS.WILDWOOD, { draftedDeck: [] });
    setPendingCharacterId(characterId);
    deps.navigateTo(CONSTANTS.SCREENS.DRAFT_DECK);
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
        deps.navigateTo(CONSTANTS.SCREENS.DESTINATION, () => {
          setRewardState((prev) =>
            restoreOrCreateDestinationRewardState(prev, {
              availableDestinations: deps.getAvailableDestinations(),
              offerState: {
                lastOfferedDestinations: deps.run.lastOfferedDestinations,
                roundsSinceOffered: deps.run.destinationRoundsSinceOffered,
              },
              bossEnemyId: getBossEnemy().id,
              onSampled: (result) => deps.run.setDestinationOfferState(result.offerState),
            }),
          );
        });
      } else if (systemId === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
        deps.onResumeWildwood();
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

    if (systemType === CONSTANTS.CONTENT_SYSTEMS.WILDWOOD) {
      initializeWildwoodRun(selectedId);
      return;
    }

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
      initializeWildwoodRun("wildcard", draftedCards);
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

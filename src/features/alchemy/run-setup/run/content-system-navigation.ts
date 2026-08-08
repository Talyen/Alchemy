// Content-system entry: campaign, labyrinth, wildwood, character select, and run start.
import { logError } from "@/lib/error-logger";
import { playGoldGain } from "@/lib/audio";
import { appendUniqueMany } from "@/lib/utils";
import { getDifficultyModifiers, type BattleCard, type CharacterId, type DifficultyId } from "@/lib/game-data";
import { DEFAULT_BATTLE_ENEMY_TYPE, DRAFT_ROUNDS } from "@/lib/game-constants";
import type { ContentSystemId } from "@/lib/content-systems/types";
import { setDiscoveredCardIds, setEncounteredEnemyIds } from "../../shared/stores/profile-store";
import { readGearMaxHealthBonus } from "../../shared/stores/gear-store";
import {
  applyRunStartSnapshot,
  setPendingCharacterId,
  setPendingContentSystemType,
  setWildwoodDraft,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { setDestinationOfferState, setRewardState } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readRunSession, readRunProfile } from "@/features/alchemy/shared/stores/run-session-read-port";
import { dispatchRunSessionCommand, type GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { bindRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import { afterCampaignCharacterResolved } from "@/features/alchemy/shared/run-flow/campaign-start";
import {
  createDestinationRewardState,
  type InitialDestinationResult,
  type DestinationOptionsInput,
  sampleDestinationChoices,
  restoreOrCreateDestinationRewardState,
} from "@/features/alchemy/shared/run-flow/destination-flow";
import type { ContentSystemNavigationDeps } from "./content-system-navigation-types";
import { createRunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { getBossEnemy } from "@/features/alchemy/shared/config";
import { CONSTANTS } from "../../shared/types";
import { createInitialWildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";

export function createContentSystemNavigation(deps: ContentSystemNavigationDeps) {
  function createInitialDestinations(
    options?: DestinationOptionsInput,
    draft?: GameplayDraft,
  ): InitialDestinationResult {
    const run = draft?.run.activeRun ?? deps.run;
    const destinationRng = draft ? bindRunRandomSource(deps.destinationRng, draft) : deps.destinationRng;
    const worldRng = draft ? bindRunRandomSource(deps.worldRng, draft) : deps.worldRng;
    const sampled = sampleDestinationChoices(
      deps.getAvailableDestinations(options),
      {
        lastOfferedDestinations: run.lastOfferedDestinations,
        roundsSinceOffered: run.destinationRoundsSinceOffered,
      },
      destinationRng,
    );
    return {
      offerState: sampled.offerState,
      rewardState: createDestinationRewardState(sampled.choices, getBossEnemy([], worldRng).id),
    };
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
    draft?: GameplayDraft,
  ) {
    const applyStart = (nextDraft: GameplayDraft) => {
      const snapshot = createStartSnapshot(characterId, contentSystemType, options.difficultyId, options.draftedDeck);
      applyRunStartSnapshot(nextDraft, snapshot);
      if (options.discoverStarterDeck || characterId === "wildcard") {
        setDiscoveredCardIds(nextDraft, (current) =>
          appendUniqueMany(
            current,
            snapshot.freshDeck.map((c) => c.id),
          ),
        );
      }
      if (options.resetEncounteredEnemies) {
        setEncounteredEnemyIds(nextDraft, []);
      }
      return snapshot;
    };

    if (draft) return applyStart(draft);
    return dispatchRunSessionCommand(applyStart, {
      afterCommit: (snapshot) => {
        if (options.playStartGoldSound && snapshot.runGold > 0) playGoldGain();
        deps.clearCardHover();
      },
    });
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
      draftedDeck ??
      (characterId === "wildcard" && deps.draftedDeckRef.current ? deps.draftedDeckRef.current : undefined);
    return createRunStartSnapshot(
      resolvedDraft !== undefined
        ? {
            ...baseInput,
            draftedDeck: resolvedDraft,
            gearMaxHealthBonus: readGearMaxHealthBonus(characterId),
            homesteadMaxHealthBonus: readRunProfile().effects.runMaxHealthBonus,
          }
        : {
            ...baseInput,
            gearMaxHealthBonus: readGearMaxHealthBonus(characterId),
            homesteadMaxHealthBonus: readRunProfile().effects.runMaxHealthBonus,
          },
    );
  }

  function initializeRunForDifficulty(characterId: CharacterId, difficultyId: DifficultyId) {
    let startSnapshot: ReturnType<typeof createStartSnapshot> | null = null;
    return dispatchRunSessionCommand(
      (draft) => {
        startSnapshot = startRun(
          characterId,
          CONSTANTS.CONTENT_SYSTEMS.CAMPAIGN,
          {
            difficultyId,
            discoverStarterDeck: true,
            resetEncounteredEnemies: true,
          },
          draft,
        );
        const initialDestinations = createInitialDestinations(
          {
            currentHealth: startSnapshot.runMaxHealth,
            currentGold: startSnapshot.runGold,
            destinationIndexInAct: 0,
            maxHealth: startSnapshot.runMaxHealth,
          },
          draft,
        );
        setDestinationOfferState(draft, initialDestinations.offerState);
        setRewardState(draft, initialDestinations.rewardState);
        return { freshDeck: startSnapshot.freshDeck, totalStartGold: startSnapshot.runGold };
      },
      {
        afterCommit: () => {
          if ((startSnapshot?.runGold ?? 0) > 0) playGoldGain();
          deps.clearCardHover();
        },
      },
    );
  }

  function initializeLabyrinthRun(characterId: CharacterId) {
    startRun(characterId, CONSTANTS.CONTENT_SYSTEMS.LABYRINTH, { discoverStarterDeck: true, playStartGoldSound: true });
    deps.navigateTo(CONSTANTS.SCREENS.LABYRINTH_MAP);
  }

  function initializeWildwoodRun(characterId: CharacterId, initialDeck?: BattleCard[]) {
    let startSnapshot: ReturnType<typeof createStartSnapshot> | null = null;
    dispatchRunSessionCommand(
      (draft) => {
        const skipDraft = initialDeck !== undefined && initialDeck.length >= DRAFT_ROUNDS;
        setWildwoodDraft(
          draft,
          createInitialWildwoodDraftState(characterId, bindRunRandomSource(deps.worldRng, draft)),
        );
        if (skipDraft) {
          startSnapshot = startRun(
            characterId,
            CONSTANTS.CONTENT_SYSTEMS.WILDWOOD,
            {
              draftedDeck: initialDeck,
              discoverStarterDeck: true,
            },
            draft,
          );
          setPendingCharacterId(draft, null);
          return true;
        }
        startSnapshot = startRun(characterId, CONSTANTS.CONTENT_SYSTEMS.WILDWOOD, { draftedDeck: [] }, draft);
        setPendingCharacterId(draft, characterId);
        return false;
      },
      {
        afterCommit: (skipDraft) => {
          if ((startSnapshot?.runGold ?? 0) > 0) playGoldGain();
          deps.clearCardHover();
          if (skipDraft) {
            deps.onStartNextWildwoodBoss();
          } else {
            deps.navigateTo(CONSTANTS.SCREENS.DRAFT_DECK);
          }
        },
      },
    );
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
          dispatchRunSessionCommand((draft) => {
            setRewardState(draft, (prev) =>
              restoreOrCreateDestinationRewardState(prev, {
                availableDestinations: deps.getAvailableDestinations(),
                offerState: {
                  lastOfferedDestinations: deps.run.lastOfferedDestinations,
                  roundsSinceOffered: deps.run.destinationRoundsSinceOffered,
                },
                bossEnemyId: getBossEnemy([], bindRunRandomSource(deps.worldRng, draft)).id,
                rng: bindRunRandomSource(deps.destinationRng, draft),
                onSampled: (result) => setDestinationOfferState(draft, result.offerState),
              }),
            );
          });
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
      logError(`[content-system-navigation] handleCharacterSelect: unhandled content system ${systemType}`, "other");
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
    const pendingCharacterId = readRunSession().pendingCharacterId;
    if (!pendingCharacterId) {
      logError("[content-system-navigation] handleDifficultySelect: no pending character", "other");
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

import { isPlayerDefeated } from "@/lib/battle";
import {
  emptyHydratedMysteryVisit,
  hydrateAlchemistState,
  hydrateEquipmentShopState,
  hydrateMysteryVisit,
  hydrateShopState,
  hydrateTrinketShopState,
  serializeAlchemistState,
  serializeEquipmentShopState,
  serializeMysteryVisit,
  serializeShopState,
  serializeTrinketShopState,
  type ActiveRunData,
  type AlchemistState,
  type EquipmentShopState,
  type InterruptedFlow,
  type LabyrinthPendingNodeId,
  type PersistedAlchemistState,
  type PersistedBattleTransition,
  type PersistedEquipmentShopState,
  type PersistedMysteryVisit,
  type PersistedShopState,
  type PersistedTrinketShopState,
  type RewardState,
  type ShopState,
  type TrinketShopState,
} from "@/lib/active-run-session";
import type { CorruptionResult } from "@/lib/corruption";
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { BattleCard } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { MysteryChoice, MysteryEvent } from "@/lib/mystery";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import { type Screen } from "@/lib/routing";
import { createInitialActiveRunFields, type ActiveRunProgressFields } from "./run-state-init";
import type { RunSession } from "./run-reads";
import { decodeInterruptedFlow, encodeInterruptedFlow, resolveEncodeScreen } from "./encode-interrupted-flow";

export interface DecodedRunResumeSession {
  labyrinthMap: LabyrinthMap | null;
  labyrinthPendingNode: LabyrinthPendingNodeId | null;
  activeLabyrinthModifiers: EncounterCombatTraitId[];
  activeLabyrinthRewardModifiers: EncounterRewardTraitId[];
  wildwoodDraft: WildwoodDraftState | null;
  starterDraftChoices: BattleCard[] | null;
  rewardState: RewardState | null;
  companionRewardCards: BattleCard[] | null;
  shopState: ShopState | null;
  alchemistState: AlchemistState | null;
  trinketShopState: TrinketShopState | null;
  equipmentShopState: EquipmentShopState | null;
  mysteryEvent: MysteryEvent | null;
  mysteryChosenChoice: MysteryChoice | null;
  mysteryPendingRemoval: boolean;
  mysteryCardChoices: BattleCard[] | null;
  mysteryGrantedTrinketIds: string[];
  mysteryGrantedGearInstances: GearInstance[];
  mysteryChosenCardId: string | null;
  corruptionResult: CorruptionResult | null;
}

export interface DecodedRunResumeSnapshot {
  progress: ActiveRunProgressFields;
  screen: Screen | null;
  pendingBattleTransition: PersistedBattleTransition | null;
  session: DecodedRunResumeSession;
}

interface PersistedShops {
  shopState: PersistedShopState | null;
  alchemistState: PersistedAlchemistState | null;
  trinketShopState: PersistedTrinketShopState | null;
  equipmentShopState: PersistedEquipmentShopState | null;
}

const EMPTY_PERSISTED_SHOPS: PersistedShops = Object.freeze({
  shopState: null,
  alchemistState: null,
  trinketShopState: null,
  equipmentShopState: null,
});

export function encodePersistedShops(
  session: RunSession["session"],
  currentScreen: Screen | null | undefined,
): PersistedShops {
  switch (currentScreen) {
    case "shop":
      return { ...EMPTY_PERSISTED_SHOPS, shopState: serializeShopState(session.shopState) };
    case "alchemist":
      return { ...EMPTY_PERSISTED_SHOPS, alchemistState: serializeAlchemistState(session.alchemistState) };
    case "trinket-shop":
      return { ...EMPTY_PERSISTED_SHOPS, trinketShopState: serializeTrinketShopState(session.trinketShopState) };
    case "equipment-shop":
      return {
        ...EMPTY_PERSISTED_SHOPS,
        equipmentShopState: serializeEquipmentShopState(session.equipmentShopState),
      };
    case undefined:
    case null:
    case "menu":
    case "game-mode-select":
    case "character-select":
    case "difficulty-select":
    case "draft-deck":
    case "battle":
    case "rewards":
    case "destination":
    case "options":
    case "collection":
    case "talents":
    case "homestead":
    case "armory":
    case "game-over":
    case "campfire":
    case "mystery":
    case "corruption":
    case "run-victory":
    case "labyrinth-map":
    case "wildwood-removal":
      return EMPTY_PERSISTED_SHOPS;
    default: {
      const _exhaustiveCheck: never = currentScreen;
      throw new Error(`encodePersistedShops: unhandled screen ${String(_exhaustiveCheck)}`);
    }
  }
}

const ACTIVE_RUN_PROGRESS_KEYS = [
  "characterId",
  "runDeck",
  "runPlayerHealth",
  "runMaxHealth",
  "runMetaMaxHealth",
  "roomsEncountered",
  "currentAct",
  "destinationIndexInAct",
  "completedDestinations",
  "lastOfferedDestinations",
  "destinationRoundsSinceOffered",
  "runBoons",
  "encounteredRunEnemyIds",
  "selectedDifficulty",
  "contentSystemType",
  "rng",
  "runTalentXP",
  "runMaterialsEarned",
  "runObtainedItems",
] as const satisfies ReadonlyArray<keyof ActiveRunProgressFields>;

type MissingProgressKey = Exclude<keyof ActiveRunProgressFields, (typeof ACTIVE_RUN_PROGRESS_KEYS)[number]>;

function pickActiveRunProgress(run: RunSession["run"] & Record<MissingProgressKey, never>): ActiveRunProgressFields {
  return Object.fromEntries(
    ACTIVE_RUN_PROGRESS_KEYS.map((key) => [key, run[key]]),
  ) as unknown as ActiveRunProgressFields;
}

interface EncodeResumeFields {
  currentScreen: Screen | null;
  interruptedFlow: InterruptedFlow;
  shopState: PersistedShopState | null;
  alchemistState: PersistedAlchemistState | null;
  trinketShopState: PersistedTrinketShopState | null;
  equipmentShopState: PersistedEquipmentShopState | null;
  mysteryVisit: PersistedMysteryVisit | null;
  corruptionResult: CorruptionResult | null;
}

function synthesizeLegacyEnemyTurnTransition(activeRun: ActiveRunData): PersistedBattleTransition | null {
  if (activeRun.activeCombat?.battleState.turnPhase === "enemy") {
    return { kind: "legacy-enemy-turn" };
  }
  return null;
}

function resolvePendingBattleTransition(activeRun: ActiveRunData): PersistedBattleTransition | null {
  const pending = activeRun.activeCombat?.pendingBattleTransition ?? null;
  if (pending) return pending;
  return synthesizeLegacyEnemyTurnTransition(activeRun);
}

function encodeScreenGatedFields(
  session: RunSession["session"],
  screen: Screen | null | undefined,
): Omit<EncodeResumeFields, "currentScreen"> {
  const shops = encodePersistedShops(session, screen);
  return {
    interruptedFlow: encodeInterruptedFlow(session, screen),
    shopState: shops.shopState,
    alchemistState: shops.alchemistState,
    trinketShopState: shops.trinketShopState,
    equipmentShopState: shops.equipmentShopState,
    mysteryVisit: screen === "mystery" ? serializeMysteryVisit(session) : null,
    corruptionResult: screen === "corruption" ? session.corruptionResult : null,
  };
}

function encodeActiveRunFromSession(source: RunSession, resume: EncodeResumeFields): ActiveRunData {
  const { run, session, battle } = source;
  const progress = pickActiveRunProgress(run);
  const isLabyrinth = progress.contentSystemType === "labyrinth";
  const activeCombat =
    battle.hasActiveBattle && battle.battleState.enemyHealth > 0 && !isPlayerDefeated(battle.battleState)
      ? {
          battleState: battle.battleState,
          pendingBattleTransition: battle.pendingBattleTransition ?? null,
          activeLabyrinthModifiers: isLabyrinth ? session.activeLabyrinthModifiers : [],
          activeLabyrinthRewardModifiers: isLabyrinth ? session.activeLabyrinthRewardModifiers : [],
        }
      : null;

  return {
    ...progress,
    destinationRoundsSinceOffered: { ...progress.destinationRoundsSinceOffered },
    rng: { seed: progress.rng.seed, counters: { ...progress.rng.counters } },
    labyrinthMap: isLabyrinth ? session.labyrinthMap : null,
    labyrinthPendingNode: isLabyrinth ? session.activeLabyrinthPendingNode : null,
    activeLabyrinthModifiers: isLabyrinth ? [...session.activeLabyrinthModifiers] : [],
    activeLabyrinthRewardModifiers: isLabyrinth ? [...session.activeLabyrinthRewardModifiers] : [],
    wildwoodDraft: progress.contentSystemType === "wildwood" ? session.wildwoodDraft : null,
    starterDraftChoices:
      progress.contentSystemType === "wildwood" || !session.starterDraftChoices?.length
        ? null
        : session.starterDraftChoices,
    activeCombat,
    currentScreen: resume.currentScreen,
    interruptedFlow: resume.interruptedFlow,
    shopState: resume.shopState,
    alchemistState: resume.alchemistState,
    trinketShopState: resume.trinketShopState,
    equipmentShopState: resume.equipmentShopState,
    mysteryVisit: resume.mysteryVisit,
    corruptionResult: resume.corruptionResult,
  };
}

export function encodeRunResumeSnapshot(source: RunSession, screen?: Screen): ActiveRunData {
  const requestedScreen = screen ?? source.screen;
  const currentScreen = resolveEncodeScreen(requestedScreen, source.session) ?? requestedScreen;
  return encodeActiveRunFromSession(source, {
    currentScreen,
    ...encodeScreenGatedFields(source.session, currentScreen),
  });
}

export function decodeRunResumeSnapshot(activeRun: ActiveRunData): DecodedRunResumeSnapshot {
  let screen = activeRun.currentScreen;
  let rewardState: RewardState | null = null;
  let companionRewardCards: BattleCard[] | null = null;

  if (activeRun.interruptedFlow.kind !== "none") {
    const claim = decodeInterruptedFlow(activeRun);
    rewardState = claim.rewardState;
    companionRewardCards = claim.companionRewardCards;
    screen = claim.screen;
  }

  const mysteryVisit = screen === "mystery" ? hydrateMysteryVisit(activeRun.mysteryVisit) : emptyHydratedMysteryVisit();

  return {
    progress: createInitialActiveRunFields(activeRun),
    screen,
    pendingBattleTransition: resolvePendingBattleTransition(activeRun),
    session: {
      labyrinthMap: activeRun.labyrinthMap,
      labyrinthPendingNode: activeRun.labyrinthPendingNode,
      activeLabyrinthModifiers:
        (activeRun.activeLabyrinthModifiers ?? []).length > 0
          ? (activeRun.activeLabyrinthModifiers ?? [])
          : (activeRun.activeCombat?.activeLabyrinthModifiers ?? []),
      activeLabyrinthRewardModifiers:
        (activeRun.activeLabyrinthRewardModifiers ?? []).length > 0
          ? (activeRun.activeLabyrinthRewardModifiers ?? [])
          : (activeRun.activeCombat?.activeLabyrinthRewardModifiers ?? []),
      wildwoodDraft: activeRun.wildwoodDraft,
      starterDraftChoices: activeRun.starterDraftChoices,
      rewardState,
      companionRewardCards,
      shopState: activeRun.shopState ? hydrateShopState(activeRun.shopState) : null,
      alchemistState: activeRun.alchemistState ? hydrateAlchemistState(activeRun.alchemistState) : null,
      trinketShopState: activeRun.trinketShopState ? hydrateTrinketShopState(activeRun.trinketShopState) : null,
      equipmentShopState: activeRun.equipmentShopState ? hydrateEquipmentShopState(activeRun.equipmentShopState) : null,
      ...mysteryVisit,
      corruptionResult: activeRun.corruptionResult,
    },
  };
}

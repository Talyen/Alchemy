// Canonical boundary between aggregate run state and persisted resume data.
// Keeping this translation in one public module prevents autosave and boot hydration from
// growing independent field-by-field mappings. Shop and interrupted-flow encode live beside this file.
import { isPlayerDefeated } from "@/lib/battle";
import {
  emptyHydratedMysteryVisit,
  hydrateAlchemistState,
  hydrateEquipmentShopState,
  hydrateMysteryVisit,
  hydrateShopState,
  hydrateTrinketShopState,
  serializeMysteryVisit,
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
import { createInitialActiveRunFields, pickActiveRunFields, type ActiveRunProgressFields } from "./run-state-init";
import type { RunSession } from "./run-session-model";
import { decodeInterruptedFlow, encodeInterruptedFlow, resolveEncodeScreen } from "./encode-interrupted-flow";
import { encodePersistedShops } from "./encode-shops";

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

function resolvePendingBattleTransition(activeRun: ActiveRunData): PersistedBattleTransition | null {
  const pending = activeRun.activeCombat?.pendingBattleTransition ?? null;
  if (pending) return pending;
  if (activeRun.activeCombat?.battleState.turnPhase === "enemy") {
    return { kind: "legacy-enemy-turn" };
  }
  return null;
}

/** Single place for all screen-gated persistence — shops, mystery, corruption, interrupted flow. */
function encodeScreenGatedFields(
  session: RunSession["session"],
  screen: Screen | null | undefined,
): Omit<EncodeResumeFields, "currentScreen"> {
  return {
    interruptedFlow: encodeInterruptedFlow(session, screen),
    ...encodePersistedShops(session, screen),
    mysteryVisit: screen === "mystery" ? serializeMysteryVisit(session) : null,
    corruptionResult: screen === "corruption" ? session.corruptionResult : null,
  };
}

/** Encode the aggregate run read model directly into persisted ActiveRunData. */
function encodeActiveRunFromSession(source: RunSession, resume: EncodeResumeFields): ActiveRunData {
  const { run, session, battle } = source;
  // Strip profile-joined fields before projecting the canonical active-run progress.
  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    initialized: _initialized,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    gold: _gold,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    talentXP: _talentXP,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    unlockedTalents: _unlockedTalents,
    ...runProgress
  } = run as unknown as ActiveRunProgressFields & Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const progress = pickActiveRunFields(runProgress as unknown as ActiveRunProgressFields);
  const activeCombat =
    battle.hasActiveBattle && battle.battleState.enemyHealth > 0 && !isPlayerDefeated(battle.battleState)
      ? {
          battleState: battle.battleState,
          pendingBattleTransition: battle.pendingBattleTransition ?? null,
          activeLabyrinthModifiers: progress.contentSystemType === "labyrinth" ? session.activeLabyrinthModifiers : [],
          activeLabyrinthRewardModifiers:
            progress.contentSystemType === "labyrinth" ? session.activeLabyrinthRewardModifiers : [],
        }
      : null;

  return {
    ...progress,
    destinationRoundsSinceOffered: { ...progress.destinationRoundsSinceOffered },
    rng: { seed: progress.rng.seed, counters: { ...progress.rng.counters } },
    labyrinthMap: progress.contentSystemType === "labyrinth" ? session.labyrinthMap : null,
    labyrinthPendingNode: progress.contentSystemType === "labyrinth" ? session.activeLabyrinthPendingNode : null,
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

/** Decode persisted resume data into the aggregate session fields. */
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
      activeLabyrinthModifiers: activeRun.activeCombat?.activeLabyrinthModifiers ?? [],
      activeLabyrinthRewardModifiers: activeRun.activeCombat?.activeLabyrinthRewardModifiers ?? [],
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

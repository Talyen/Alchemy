import {
  emptyAlchemistState,
  emptyEquipmentShopState,
  emptyShopState,
  emptyTrinketShopState,
} from "@/lib/active-run-session";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import { DESTINATIONS, type Destination } from "@/lib/routing";
import type { GameplayDraft } from "./run-session-command";
import { createInitialSessionFields, type RunSessionFields } from "./run-domain-types";
import {
  hydrateFromSnapshot,
  setCompletedDestinations,
  setDestinationIndexInAct,
  setDestinationOfferState,
} from "./write-port-run";
import { getDifficultyXPMultiplier, tryUnlockTalent, type KeywordId } from "@/lib/game-data";
import {
  computeRunEndTalentXPSnapshot,
  mergeRunTalentXPIntoPermanent,
  talentPool,
  xpThresholdForPoints,
  type TalentXP,
  type UnlockedTalents,
} from "@/lib/game-data";
import type { CompanionId } from "@/lib/game-data";
import type {
  BuildingId,
  FarmId,
  MaterialInventory as ProfileMaterialInventory,
  ResearchId,
} from "@/lib/homestead/types";
import type { CollectionTab } from "@/features/alchemy/shared/types";
import { createInitialPermanentFields } from "./run-state-init";
import { createInitialProfileState, type ProfileStateFields } from "./profile-store-types";
import * as homestead from "./homestead-actions";
import { rebindLiveRunMeta } from "./run-meta-rebind";
import { addRunMaterialsEarned, resetRunXP } from "./write-port-run";
import { createDraftFieldSetter } from "./draft-helpers";

const createSessionFieldSetter = createDraftFieldSetter<RunSessionFields, GameplayDraft>((draft) => draft.session);

export const setPendingCharacterId = createSessionFieldSetter("pendingCharacterId");
export const setPendingContentSystemType = createSessionFieldSetter("pendingContentSystemType");
export const setWildwoodDraft = createSessionFieldSetter("wildwoodDraft");
export const setStarterDraftChoices = createSessionFieldSetter("starterDraftChoices");

export function setHasActiveRun(draft: GameplayDraft, active: boolean): void {
  draft.session.hasActiveRun = active;
}

export function clearTransientSession(draft: GameplayDraft): void {
  Object.assign(draft.session, createInitialSessionFields());
}

export function applyRunStartSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void {
  hydrateFromSnapshot(draft, snapshot);
  draft.session.runEndTalentXP = {};
  draft.session.runEndItems = [];
  draft.session.runEndLabyrinthFloor = null;
  draft.session.hasActiveRun = snapshot.hasActiveRun;
}

export const setRewardState = createSessionFieldSetter("rewardState");
export const setCompanionRewardCards = createSessionFieldSetter("companionRewardCards");
export const setRunEndMaterials = createSessionFieldSetter("runEndMaterials");
export const setRunEndItems = createSessionFieldSetter("runEndItems");
export const setCorruptionResult = createSessionFieldSetter("corruptionResult");

export function beginRewardClaim(draft: GameplayDraft): boolean {
  if (draft.session.rewardClaimInFlight) return false;
  if (draft.session.rewardState.choices.length === 0 && !draft.session.companionRewardCards?.length) return false;
  draft.session.rewardClaimInFlight = true;
  return true;
}

export function releaseRewardClaim(draft: GameplayDraft): void {
  draft.session.rewardClaimInFlight = false;
}

export function beginDestinationClaim(draft: GameplayDraft, destination: Destination): boolean {
  if (draft.session.pendingDestinationClaim !== null) return false;
  if (!draft.session.rewardState.destinations.includes(destination)) return false;
  draft.session.pendingDestinationClaim = destination;
  return true;
}

export function cancelDestinationClaim(draft: GameplayDraft): void {
  draft.session.pendingDestinationClaim = null;
}

export function commitDestinationClaim(draft: GameplayDraft, destination: Destination): boolean {
  const transient = draft.session;
  if (transient.pendingDestinationClaim !== destination) return false;
  if (!transient.rewardState.destinations.includes(destination)) {
    cancelDestinationClaim(draft);
    return false;
  }
  if (draft.run.activeRun.lastOfferedDestinations.length === 0) {
    setDestinationOfferState(draft, {
      lastOfferedDestinations: [...transient.rewardState.destinations],
      roundsSinceOffered: { ...draft.run.activeRun.destinationRoundsSinceOffered },
    });
  }
  setRewardState(draft, (prev) => ({ ...prev, destinations: [] }));
  cancelDestinationClaim(draft);
  setCompletedDestinations(draft, (prev) => [...prev, destination]);
  setDestinationIndexInAct(draft, (prev) => prev + 1);
  return true;
}

function abandonDestinationVisit(draft: GameplayDraft, destination: Destination): void {
  const transient = draft.session;

  if (transient.pendingDestinationClaim === destination) {
    cancelDestinationClaim(draft);
  } else if (draft.run.activeRun.completedDestinations.at(-1) === destination) {
    setCompletedDestinations(draft, (prev) => prev.slice(0, -1));
    setDestinationIndexInAct(draft, (prev) => Math.max(0, prev - 1));
  }

  if (transient.rewardState.destinations.length === 0) {
    const restored = [...draft.run.activeRun.lastOfferedDestinations];
    if (restored.length > 0) {
      setRewardState(draft, (prev) => ({ ...prev, destinations: restored }));
    }
  }

  if (destination === DESTINATIONS.CORRUPTION) {
    setCorruptionResult(draft, null);
  }
}

export function abandonCorruptionDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.CORRUPTION);
}

export function abandonMysteryDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.MYSTERY);
}

export const setShopState = createSessionFieldSetter("shopState");
export const setAlchemistState = createSessionFieldSetter("alchemistState");
export const setTrinketShopState = createSessionFieldSetter("trinketShopState");
export const setEquipmentShopState = createSessionFieldSetter("equipmentShopState");

export function clearShopOfferings(draft: GameplayDraft): void {
  setShopState(draft, emptyShopState());
  setAlchemistState(draft, emptyAlchemistState());
  setTrinketShopState(draft, emptyTrinketShopState());
  setEquipmentShopState(draft, emptyEquipmentShopState());
}

export const setActiveLabyrinthModifiers = createSessionFieldSetter("activeLabyrinthModifiers");
export const setActiveLabyrinthRewardModifiers = createSessionFieldSetter("activeLabyrinthRewardModifiers");
export const setActiveLabyrinthPendingNode = createSessionFieldSetter("activeLabyrinthPendingNode");
export const setSelectedLabyrinthNodeId = createSessionFieldSetter("selectedLabyrinthNodeId");
export const setRunEndLabyrinthFloor = createSessionFieldSetter("runEndLabyrinthFloor");
export const setLabyrinthMap = createSessionFieldSetter("labyrinthMap");

export const setMysteryEvent = createSessionFieldSetter("mysteryEvent");
export const setMysteryChosenChoice = createSessionFieldSetter("mysteryChosenChoice");
export const setMysteryPendingRemoval = createSessionFieldSetter("mysteryPendingRemoval");
export const setMysteryCardChoices = createSessionFieldSetter("mysteryCardChoices");
export const setMysteryGrantedTrinketIds = createSessionFieldSetter("mysteryGrantedTrinketIds");
export const setMysteryGrantedGearInstances = createSessionFieldSetter("mysteryGrantedGearInstances");
export const setMysteryChosenCardId = createSessionFieldSetter("mysteryChosenCardId");

export function clearMysteryVisitState(draft: GameplayDraft): void {
  setMysteryEvent(draft, null);
  setMysteryChosenChoice(draft, null);
  setMysteryPendingRemoval(draft, false);
  setMysteryCardChoices(draft, null);
  setMysteryGrantedTrinketIds(draft, []);
  setMysteryGrantedGearInstances(draft, []);
  setMysteryChosenCardId(draft, null);
}

export function grantMaterials(
  draft: GameplayDraft,
  materials: ProfileMaterialInventory,
  options: { trackRunEarned?: boolean } = {},
): void {
  homestead.addMaterials(draft.runProfile, materials);
  if (options.trackRunEarned) addRunMaterialsEarned(draft, materials);
}

export function awardMaterialsDuringRun(draft: GameplayDraft, materials: ProfileMaterialInventory): void {
  grantMaterials(draft, materials, { trackRunEarned: true });
}

export function setMaterials(draft: GameplayDraft, materials: ProfileMaterialInventory): void {
  homestead.setMaterials(draft.runProfile, materials);
}

export function addMaterials(draft: GameplayDraft, materials: ProfileMaterialInventory): void {
  grantMaterials(draft, materials);
}

export function constructBuilding(draft: GameplayDraft, id: BuildingId): boolean {
  const ok = homestead.constructBuilding(draft.runProfile, id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

export function plantFarm(draft: GameplayDraft, id: FarmId): boolean {
  const ok = homestead.plantFarm(draft.runProfile, id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

export function completeResearch(draft: GameplayDraft, id: ResearchId): boolean {
  const ok = homestead.completeResearch(draft.runProfile, id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

export function bondCompanion(draft: GameplayDraft, id: CompanionId): boolean {
  const ok = homestead.bondCompanion(draft.runProfile, id);
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

export function unlockTalent(draft: GameplayDraft, keywordId: KeywordId, talentId: string): void {
  const result = tryUnlockTalent(keywordId, talentId, draft.runProfile.talentXP, draft.runProfile.unlockedTalents);
  if (result.unlockedTalents) draft.runProfile.unlockedTalents = result.unlockedTalents;
  rebindLiveRunMeta(draft);
}

export function resetUnlockedTalents(draft: GameplayDraft): void {
  draft.runProfile.unlockedTalents = {};
}

export function unlockAllTalents(draft: GameplayDraft): void {
  if (!import.meta.env.DEV) return;
  const next: UnlockedTalents = {};
  const xp: TalentXP = {};
  for (const talent of talentPool) {
    next[talent.keywordId] = [...(next[talent.keywordId] ?? []), talent.id];
  }
  for (const [keyword, ids] of Object.entries(next)) {
    xp[keyword as KeywordId] = xpThresholdForPoints(ids.length);
  }
  draft.runProfile.unlockedTalents = next;
  draft.runProfile.talentXP = xp;
  resetRunXP(draft);
  rebindLiveRunMeta(draft);
}

export function applyTalentState(draft: GameplayDraft, talentXP: TalentXP, unlockedTalents: UnlockedTalents): void {
  draft.runProfile.talentXP = talentXP;
  draft.runProfile.unlockedTalents = unlockedTalents;
}

function mergeRunTalentXPIntoProfile(draft: GameplayDraft, runTalentXP: TalentXP, multiplier: number): TalentXP {
  const snapshot = computeRunEndTalentXPSnapshot(runTalentXP, multiplier);
  draft.runProfile.talentXP = mergeRunTalentXPIntoPermanent(runTalentXP, draft.runProfile.talentXP, multiplier);
  return snapshot;
}

export function clearPermanentData(draft: GameplayDraft): void {
  Object.assign(draft.runProfile, createInitialPermanentFields());
}

export function finalizeRunXP(draft: GameplayDraft): void {
  const runTalentXP = draft.run.activeRun.runTalentXP;
  if (Object.keys(runTalentXP).length === 0) {
    draft.session.runEndTalentXP = {};
    return;
  }
  const multiplier = getDifficultyXPMultiplier(draft.run.activeRun.selectedDifficulty);
  draft.session.runEndTalentXP = mergeRunTalentXPIntoProfile(draft, runTalentXP, multiplier);
  resetRunXP(draft);
  rebindLiveRunMeta(draft);
}

const createProfileFieldSetter = createDraftFieldSetter<ProfileStateFields, GameplayDraft>((draft) => draft.profile);

export const setDiscoveredCardIds = createProfileFieldSetter("discoveredCardIds");
export const setEncounteredEnemyIds = createProfileFieldSetter("encounteredEnemyIds");
export const setDiscoveredTrinketIds = createProfileFieldSetter("discoveredTrinketIds");
export const setDiscoveredUniqueIds = createProfileFieldSetter("discoveredUniqueIds");
export const setCompletedDifficulties = createProfileFieldSetter("completedDifficulties");
export const setFinishedRunCharacters = createProfileFieldSetter("finishedRunCharacters");

export function setCollectionPage(draft: GameplayDraft, tab: CollectionTab, page: number): void {
  draft.profile.collectionPages[tab] = Math.max(0, page);
}

export function handleCollectionTabChange(draft: GameplayDraft, tab: CollectionTab): void {
  draft.profile.collectionTab = tab;
  draft.profile.collectionPages[tab] ??= 0;
}

export function resetToDefaults(draft: GameplayDraft): void {
  Object.assign(draft.profile, createInitialProfileState());
}

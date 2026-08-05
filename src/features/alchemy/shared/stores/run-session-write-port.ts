// Public gameplay write capability for feature code.
// All write functions are grouped by domain in this single barrel — import from here only.
import { getDifficultyXPMultiplier } from "@/lib/game-data";
import type { BattleCard, CharacterId, CompanionId, KeywordId } from "@/lib/game-data";
import type { BattleState } from "@/lib/battle";
import type {
  AlchemistState,
  EquipmentShopState,
  PersistedBattleTransition,
  RewardState,
  ShopState,
  TrinketShopState,
} from "@/lib/active-run-session";
import type { ContentSystemId } from "@/lib/content-systems/types";
import type { EncounterCombatTraitId, EncounterRewardTraitId, LabyrinthMap } from "@/lib/content-systems/types";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import type { WildwoodDraftState } from "@/lib/content-systems/wildwood/gauntlet";
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import type { BuildingId, FarmId, MaterialInventory, ResearchId } from "@/lib/homestead/types";
import type { RunRngStream } from "@/lib/run-rng";
import type { Destination, Screen } from "@/features/alchemy/shared/types";
import type { CorruptionResult } from "@/lib/corruption";
import { dispatchRunSessionCommand } from "./run-session-command";
import { readGameplayState, type GameplayState } from "./gameplay-state-store";
import type { DisplayOverrides } from "./run-domain-types";

// ---------------------------------------------------------------------------
// Exported types (part of the public API surface)
// ---------------------------------------------------------------------------

type RunValueUpdate<T> = T | ((previous: T) => T);
type RunActions = GameplayState["runActions"];
export type RunTrinketsUpdate = Parameters<RunActions["setRunTrinkets"]>[0];
export type RunDeckUpdate = Parameters<RunActions["setRunDeck"]>[0];

// ---------------------------------------------------------------------------
// Active-run progression
// ---------------------------------------------------------------------------

export function setRunDeck(value: RunDeckUpdate): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setRunDeck(value));
}

export function setRunGold(value: Parameters<RunActions["setRunGold"]>[0]): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setRunGold(value));
}

export function addRunGold(amount: number): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.addRunGold(amount));
}

export function setRunPlayerHealth(value: Parameters<RunActions["setRunPlayerHealth"]>[0]): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setRunPlayerHealth(value));
}

export function setRunMaxHealth(value: RunValueUpdate<number>): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setRunMaxHealth(value));
}

export function setRoomsEncountered(value: RunValueUpdate<number>): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setRoomsEncountered(value));
}

export function setCurrentAct(value: RunValueUpdate<number>): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setCurrentAct(value));
}

export function setDestinationIndexInAct(value: RunValueUpdate<number>): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setDestinationIndexInAct(value));
}

export function setCompletedDestinations(
  value: RunValueUpdate<GameplayState["run"]["activeRun"]["completedDestinations"]>,
): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setCompletedDestinations(value));
}

export function setDestinationOfferState(value: Parameters<RunActions["setDestinationOfferState"]>[0]): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setDestinationOfferState(value));
}

export function setRunTrinkets(value: RunTrinketsUpdate): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setRunTrinkets(value));
}

export function setEncounteredRunEnemyIds(value: RunValueUpdate<string[]>): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setEncounteredRunEnemyIds(value));
}

export function setScreen(screen: Screen): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.setScreen(screen));
}

export function awardCardXP(card: BattleCard): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.awardCardXP(card));
}

export function awardMysteryXP(keywordId: KeywordId, amount: number): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.awardMysteryXP(keywordId, amount));
}

export function addRunMaterialsEarned(materials: MaterialInventory): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.addRunMaterialsEarned(materials));
}

export function clearRunMaterialsEarned(): void {
  dispatchRunSessionCommand(() => readGameplayState().runActions.clearRunMaterialsEarned());
}

/** Draw from a persisted run stream without exposing the aggregate action. */
export function createRunRandomSource(stream: RunRngStream): () => number {
  return () => dispatchRunSessionCommand(() => readGameplayState().runActions.nextRunRandom(stream));
}

// ---------------------------------------------------------------------------
// Permanent profile (homestead, talents)
// ---------------------------------------------------------------------------

/** Persist homestead materials and track totals for the run-end summary screen. */
export function awardMaterialsDuringRun(materials: MaterialInventory) {
  dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    session.runProfileActions.addMaterials(materials);
    session.runActions.addRunMaterialsEarned(materials);
  });
}

/** Dev / unlock-all: overwrite homestead materials. */
export function setMaterials(materials: MaterialInventory) {
  return dispatchRunSessionCommand(() => readGameplayState().runProfileActions.setMaterials(materials));
}

export function addMaterials(materials: MaterialInventory): void {
  dispatchRunSessionCommand(() => readGameplayState().runProfileActions.addMaterials(materials));
}

export function constructBuilding(id: BuildingId): boolean {
  return dispatchRunSessionCommand(() => readGameplayState().runProfileActions.constructBuilding(id));
}

export function plantFarm(id: FarmId): boolean {
  return dispatchRunSessionCommand(() => readGameplayState().runProfileActions.plantFarm(id));
}

export function completeResearch(id: ResearchId): boolean {
  return dispatchRunSessionCommand(() => readGameplayState().runProfileActions.completeResearch(id));
}

export function bondCompanion(id: CompanionId): boolean {
  return dispatchRunSessionCommand(() => readGameplayState().runProfileActions.bondCompanion(id));
}

export function unlockTalent(keywordId: KeywordId, talentId: string): void {
  dispatchRunSessionCommand(() => readGameplayState().runProfileActions.unlockTalent(keywordId, talentId));
}

export function resetUnlockedTalents(): void {
  dispatchRunSessionCommand(() => readGameplayState().runProfileActions.resetUnlockedTalents());
}

/** Dev unlock-all: max every talent and drop pending run XP so run-end cannot merge on top. */
export function unlockAllTalents() {
  dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    session.runProfileActions.unlockAllTalents();
    session.runActions.resetRunXP();
  });
}

/**
 * Merge the finished run's talent XP into permanent progression and publish the
 * run-end snapshot the game-over / victory screens read. Idempotent: a second
 * call with no run XP left clears the snapshot instead of double-counting.
 */
export function finalizeRunXP(): void {
  dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    const runTalentXP = session.run.activeRun.runTalentXP;
    if (Object.keys(runTalentXP).length === 0) {
      session.sessionActions.setRunEndTalentXP({});
      return;
    }
    const multiplier = getDifficultyXPMultiplier(session.run.activeRun.selectedDifficulty);
    session.sessionActions.setRunEndTalentXP(
      session.runProfileActions.mergeRunTalentXPIntoProfile(runTalentXP, multiplier),
    );
    session.runActions.resetRunXP();
  });
}

// ---------------------------------------------------------------------------
// Battle
// ---------------------------------------------------------------------------

type BattleStateUpdate = BattleState | ((previous: BattleState) => BattleState);
type BattleActions = GameplayState["battleActions"];

function dispatchBattleCommand<T>(work: (battle: BattleActions) => T): T {
  return dispatchRunSessionCommand(() => work(readGameplayState().battleActions));
}

function rebindBattleWorldRng(battleState: BattleState): BattleState {
  return { ...battleState, rng: createRunRandomSource("world") };
}

function rebindPendingTransitionWorldRng(
  pendingBattleTransition: PersistedBattleTransition | null,
): PersistedBattleTransition | null {
  if (!pendingBattleTransition || pendingBattleTransition.kind !== "enemy-turn") return pendingBattleTransition;
  return {
    ...pendingBattleTransition,
    resultState: rebindBattleWorldRng(pendingBattleTransition.resultState),
  };
}

export function setBattleState(action: BattleStateUpdate): void {
  dispatchBattleCommand((battle) => battle.setSyncedBattleState(action));
}

export function setBattleStartState(state: BattleState | null): void {
  dispatchBattleCommand((battle) => battle.setBattleStartState(state));
}

export function setHasActiveBattle(active: boolean | ((previous: boolean) => boolean)): void {
  dispatchBattleCommand((battle) => battle.setHasActiveBattle(active));
}

export function initializeActiveBattle(
  battleState: BattleState | null,
  pendingBattleTransition: PersistedBattleTransition | null = null,
): void {
  if (!battleState) {
    dispatchBattleCommand((battle) => battle.initializeActiveBattle(null, null));
    return;
  }
  dispatchBattleCommand((battle) =>
    battle.initializeActiveBattle(
      rebindBattleWorldRng(battleState),
      rebindPendingTransitionWorldRng(pendingBattleTransition),
    ),
  );
}

/** Commit the logical state and its async continuation as one durable revision. */
export function commitBattleTransition(
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition | null,
): void {
  dispatchBattleCommand((battle) => {
    battle.setSyncedBattleState(battleState);
    battle.setPendingBattleTransition(pendingBattleTransition);
    battle.clearPendingTransitionResumeRequired();
  });
}

/** Start a visible async transition while keeping its continuation in the save. */
export function beginBattleTransition(
  battleState: BattleState,
  pendingBattleTransition: PersistedBattleTransition,
  displayOverrides: DisplayOverrides,
): void {
  dispatchBattleCommand((battle) => {
    battle.setSyncedBattleState(battleState);
    battle.setPendingBattleTransition(pendingBattleTransition);
    battle.setDisplayOverrides(displayOverrides);
  });
}

export function clearBattleTransition(): void {
  dispatchBattleCommand((battle) => {
    battle.setPendingBattleTransition(null);
    battle.clearPendingTransitionResumeRequired();
  });
}

// ---------------------------------------------------------------------------
// Run setup (pending selections, draft, run-start application)
// ---------------------------------------------------------------------------

export function setPendingCharacterId(id: CharacterId | null) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setPendingCharacterId(id));
}

export function setPendingContentSystemType(type: ContentSystemId) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setPendingContentSystemType(type));
}

export function setWildwoodDraft(
  state: WildwoodDraftState | null | ((prev: WildwoodDraftState | null) => WildwoodDraftState | null),
) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setWildwoodDraft(state));
}

/** Start a fresh run: seed active-run progress, drop the previous run-end XP snapshot, flag the run active. */
export function applyRunStartSnapshot(snapshot: RunStartSnapshot): void {
  dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    session.runActions.hydrateFromSnapshot(snapshot);
    session.sessionActions.setRunEndTalentXP({});
    session.sessionActions.setHasActiveRun(snapshot.hasActiveRun);
  });
}

// ---------------------------------------------------------------------------
// Rewards / claims
// ---------------------------------------------------------------------------

export function setRewardState(state: RewardState | ((prev: RewardState) => RewardState)) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setRewardState(state));
}

export function setCompanionRewardCards(cards: BattleCard[] | null) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setCompanionRewardCards(cards));
}

export function beginRewardClaim(): boolean {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.beginRewardClaim());
}

export function releaseRewardClaim(): void {
  dispatchRunSessionCommand(() => readGameplayState().sessionActions.releaseRewardClaim());
}

export function beginDestinationClaim(destination: Destination): boolean {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.beginDestinationClaim(destination));
}

/** Commit destination claim across session + active-run progress (cross-lifetime). */
export function commitDestinationClaim(destination: Destination): boolean {
  return dispatchRunSessionCommand(() => {
    const session = readGameplayState();
    const transient = session.session;
    if (transient.pendingDestinationClaim !== destination) return false;
    if (!transient.rewardState.destinations.includes(destination)) {
      session.sessionActions.cancelDestinationClaim();
      return false;
    }
    session.sessionActions.setRewardState((prev) => ({ ...prev, destinations: [] }));
    session.sessionActions.cancelDestinationClaim();
    session.runActions.setCompletedDestinations((prev) => [...prev, destination]);
    session.runActions.setDestinationIndexInAct((prev) => prev + 1);
    return true;
  });
}

export function cancelDestinationClaim(): void {
  dispatchRunSessionCommand(() => readGameplayState().sessionActions.cancelDestinationClaim());
}

export function setRunEndMaterials(materials: MaterialInventory) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setRunEndMaterials(materials));
}

export function setCorruptionResult(result: CorruptionResult | null) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setCorruptionResult(result));
}

// ---------------------------------------------------------------------------
// Shop / alchemist
// ---------------------------------------------------------------------------

export function setShopState(state: ShopState | ((prev: ShopState) => ShopState)) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setShopState(state));
}

export function setAlchemistState(state: AlchemistState | ((prev: AlchemistState) => AlchemistState)) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setAlchemistState(state));
}

export function setTrinketShopState(state: TrinketShopState | ((prev: TrinketShopState) => TrinketShopState)) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setTrinketShopState(state));
}

export function setEquipmentShopState(state: EquipmentShopState | ((prev: EquipmentShopState) => EquipmentShopState)) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setEquipmentShopState(state));
}

// ---------------------------------------------------------------------------
// Mystery
// ---------------------------------------------------------------------------

export function setMysteryEvent(event: import("@/lib/mystery").MysteryEvent | null) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setMysteryEvent(event));
}

export function setMysteryCardChoices(
  choices: BattleCard[] | null | ((prev: BattleCard[] | null) => BattleCard[] | null),
) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setMysteryCardChoices(choices));
}

// ---------------------------------------------------------------------------
// Labyrinth
// ---------------------------------------------------------------------------

export function setActiveLabyrinthModifiers(modifiers: EncounterCombatTraitId[]) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setActiveLabyrinthModifiers(modifiers));
}

export function setActiveLabyrinthRewardModifiers(modifiers: EncounterRewardTraitId[]) {
  return dispatchRunSessionCommand(() =>
    readGameplayState().sessionActions.setActiveLabyrinthRewardModifiers(modifiers),
  );
}

export function setActiveLabyrinthPendingNode(node: LabyrinthNodePosition | null) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setActiveLabyrinthPendingNode(node));
}

export function setLabyrinthMap(map: LabyrinthMap | ((prev: LabyrinthMap) => LabyrinthMap)) {
  return dispatchRunSessionCommand(() => readGameplayState().sessionActions.setLabyrinthMap(map));
}

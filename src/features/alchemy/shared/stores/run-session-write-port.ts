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

function dispatchRunAction<T>(work: (session: GameplayState) => T): T {
  return dispatchRunSessionCommand(() => work(readGameplayState()));
}

// ---------------------------------------------------------------------------
// Active-run progression
// ---------------------------------------------------------------------------

export function setRunDeck(value: RunDeckUpdate): void {
  dispatchRunAction((session) => session.runActions.setRunDeck(value));
}

export function setRunGold(value: Parameters<RunActions["setRunGold"]>[0]): void {
  dispatchRunAction((session) => session.runActions.setRunGold(value));
}

export function addRunGold(amount: number): void {
  dispatchRunAction((session) => session.runActions.addRunGold(amount));
}

export function setRunPlayerHealth(value: Parameters<RunActions["setRunPlayerHealth"]>[0]): void {
  dispatchRunAction((session) => session.runActions.setRunPlayerHealth(value));
}

export function setRunMaxHealth(value: RunValueUpdate<number>): void {
  dispatchRunAction((session) => session.runActions.setRunMaxHealth(value));
}

export function setRoomsEncountered(value: RunValueUpdate<number>): void {
  dispatchRunAction((session) => session.runActions.setRoomsEncountered(value));
}

export function setCurrentAct(value: RunValueUpdate<number>): void {
  dispatchRunAction((session) => session.runActions.setCurrentAct(value));
}

export function setDestinationIndexInAct(value: RunValueUpdate<number>): void {
  dispatchRunAction((session) => session.runActions.setDestinationIndexInAct(value));
}

export function setCompletedDestinations(
  value: RunValueUpdate<GameplayState["run"]["activeRun"]["completedDestinations"]>,
): void {
  dispatchRunAction((session) => session.runActions.setCompletedDestinations(value));
}

export function setDestinationOfferState(value: Parameters<RunActions["setDestinationOfferState"]>[0]): void {
  dispatchRunAction((session) => session.runActions.setDestinationOfferState(value));
}

export function setRunTrinkets(value: RunTrinketsUpdate): void {
  dispatchRunAction((session) => session.runActions.setRunTrinkets(value));
}

export function setEncounteredRunEnemyIds(value: RunValueUpdate<string[]>): void {
  dispatchRunAction((session) => session.runActions.setEncounteredRunEnemyIds(value));
}

export function setScreen(screen: Screen): void {
  dispatchRunAction((session) => session.runActions.setScreen(screen));
}

export function awardCardXP(card: BattleCard): void {
  dispatchRunAction((session) => session.runActions.awardCardXP(card));
}

export function awardMysteryXP(keywordId: KeywordId, amount: number): void {
  dispatchRunAction((session) => session.runActions.awardMysteryXP(keywordId, amount));
}

export function addRunMaterialsEarned(materials: MaterialInventory): void {
  dispatchRunAction((session) => session.runActions.addRunMaterialsEarned(materials));
}

export function clearRunMaterialsEarned(): void {
  dispatchRunAction((session) => session.runActions.clearRunMaterialsEarned());
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
  return dispatchRunAction((session) => session.runProfileActions.setMaterials(materials));
}

export function addMaterials(materials: MaterialInventory): void {
  dispatchRunAction((session) => session.runProfileActions.addMaterials(materials));
}

export function constructBuilding(id: BuildingId): boolean {
  return dispatchRunAction((session) => session.runProfileActions.constructBuilding(id));
}

export function plantFarm(id: FarmId): boolean {
  return dispatchRunAction((session) => session.runProfileActions.plantFarm(id));
}

export function completeResearch(id: ResearchId): boolean {
  return dispatchRunAction((session) => session.runProfileActions.completeResearch(id));
}

export function bondCompanion(id: CompanionId): boolean {
  return dispatchRunAction((session) => session.runProfileActions.bondCompanion(id));
}

export function unlockTalent(keywordId: KeywordId, talentId: string): void {
  dispatchRunAction((session) => session.runProfileActions.unlockTalent(keywordId, talentId));
}

export function resetUnlockedTalents(): void {
  dispatchRunAction((session) => session.runProfileActions.resetUnlockedTalents());
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
  return dispatchRunAction((session) => session.sessionActions.setPendingCharacterId(id));
}

export function setPendingContentSystemType(type: ContentSystemId) {
  return dispatchRunAction((session) => session.sessionActions.setPendingContentSystemType(type));
}

export function setWildwoodDraft(
  state: WildwoodDraftState | null | ((prev: WildwoodDraftState | null) => WildwoodDraftState | null),
) {
  return dispatchRunAction((session) => session.sessionActions.setWildwoodDraft(state));
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
  return dispatchRunAction((session) => session.sessionActions.setRewardState(state));
}

export function setCompanionRewardCards(cards: BattleCard[] | null) {
  return dispatchRunAction((session) => session.sessionActions.setCompanionRewardCards(cards));
}

export function beginRewardClaim(): boolean {
  return dispatchRunAction((session) => session.sessionActions.beginRewardClaim());
}

export function releaseRewardClaim(): void {
  dispatchRunAction((session) => session.sessionActions.releaseRewardClaim());
}

export function beginDestinationClaim(destination: Destination): boolean {
  return dispatchRunAction((session) => session.sessionActions.beginDestinationClaim(destination));
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
  dispatchRunAction((session) => session.sessionActions.cancelDestinationClaim());
}

export function setRunEndMaterials(materials: MaterialInventory) {
  return dispatchRunAction((session) => session.sessionActions.setRunEndMaterials(materials));
}

export function setCorruptionResult(result: CorruptionResult | null) {
  return dispatchRunAction((session) => session.sessionActions.setCorruptionResult(result));
}

// ---------------------------------------------------------------------------
// Shop / alchemist
// ---------------------------------------------------------------------------

export function setShopState(state: ShopState | ((prev: ShopState) => ShopState)) {
  return dispatchRunAction((session) => session.sessionActions.setShopState(state));
}

export function setAlchemistState(state: AlchemistState | ((prev: AlchemistState) => AlchemistState)) {
  return dispatchRunAction((session) => session.sessionActions.setAlchemistState(state));
}

export function setTrinketShopState(state: TrinketShopState | ((prev: TrinketShopState) => TrinketShopState)) {
  return dispatchRunAction((session) => session.sessionActions.setTrinketShopState(state));
}

export function setEquipmentShopState(state: EquipmentShopState | ((prev: EquipmentShopState) => EquipmentShopState)) {
  return dispatchRunAction((session) => session.sessionActions.setEquipmentShopState(state));
}

// ---------------------------------------------------------------------------
// Mystery
// ---------------------------------------------------------------------------

export function setMysteryEvent(event: import("@/lib/mystery").MysteryEvent | null) {
  return dispatchRunAction((session) => session.sessionActions.setMysteryEvent(event));
}

export function setMysteryCardChoices(
  choices: BattleCard[] | null | ((prev: BattleCard[] | null) => BattleCard[] | null),
) {
  return dispatchRunAction((session) => session.sessionActions.setMysteryCardChoices(choices));
}

// ---------------------------------------------------------------------------
// Labyrinth
// ---------------------------------------------------------------------------

export function setActiveLabyrinthModifiers(modifiers: EncounterCombatTraitId[]) {
  return dispatchRunAction((session) => session.sessionActions.setActiveLabyrinthModifiers(modifiers));
}

export function setActiveLabyrinthRewardModifiers(modifiers: EncounterRewardTraitId[]) {
  return dispatchRunSessionCommand(() =>
    readGameplayState().sessionActions.setActiveLabyrinthRewardModifiers(modifiers),
  );
}

export function setActiveLabyrinthPendingNode(node: LabyrinthNodePosition | null) {
  return dispatchRunAction((session) => session.sessionActions.setActiveLabyrinthPendingNode(node));
}

export function setLabyrinthMap(map: LabyrinthMap | ((prev: LabyrinthMap) => LabyrinthMap)) {
  return dispatchRunAction((session) => session.sessionActions.setLabyrinthMap(map));
}

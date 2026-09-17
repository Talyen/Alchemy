// Canonical gameplay write seam: every GameplayDraft mutator lives here.
//
// Feature code imports these mutators from this module (never a `write-port-*`
// module — those files are deleted). Each mutator takes the draft first and
// composes inside one `dispatchRunSessionCommand`; see ARCHITECTURE.md Run state.
//
// Dual-write invariants (kept, documented where they apply):
// - Gold: `runProfile.gold` is the purse; `battleState.gold` mirrors it while a
//   battle is live. `setGold` syncs purse→battle; `setBattleState` commits
//   battle→purse via `syncPurseFromBattleGold`.
// - Materials: `runProfile.materialInventory` is the stockpile;
//   `run.activeRun.runMaterialsEarned` tallies what the live run earned.
//   `awardMaterialsDuringRun` writes both; `addMaterialsToStockpile` writes the
//   stockpile only (homestead end-of-run bonuses, meta salvage). Salvaged
//   crafting currencies mirror this via `run.activeRun.runCurrenciesEarned`,
//   tallied alongside the material grant in `dispatchGearSalvageWithMaterialGrant`.
// - Talent XP: `run.activeRun.runTalentXP` accrues during the run;
//   `finalizeRunXP` merges it into `runProfile.talentXP` once at run end.
import type { RunStartSnapshot } from "@/features/alchemy/shared/run-flow/run-start";
import type { CollectionTab } from "@/features/alchemy/shared/types";
import type {
  ActiveRunData,
  HydratedMysteryVisit,
  PersistedBattleTransition,
  RunActivityData,
  RunObtainedItem,
} from "@/lib/active-run-session";
import { emptyHydratedMysteryVisit, readActivityData, transitionRunActivity } from "@/lib/active-run-session";
import { battleSnapshot, type BattleSnapshot, type BattleState } from "@/lib/battle";
import { enterWildwoodReward } from "@/lib/content-systems/wildwood/gauntlet";
import type { BattleCard, CharacterId, CompanionId, KeywordId, TalentXP, UnlockedTalents } from "@/lib/game-data";
import {
  addTalentXP,
  computeRunEndTalentXPSnapshot,
  computeTalentEffects,
  filterKeywordsForTalentXP,
  getCardKeywords,
  getDifficultyXPMultiplier,
  getGoldMultiplier,
  isTalentPlaceholder,
  mergeRunTalentXPIntoPermanent,
  talentPool,
  tryUnlockTalent,
  xpThresholdForPoints,
  type TalentEffectManifest,
} from "@/lib/game-data";
import { computeGearManifest, flattenGearInventories, type GearEffectManifest } from "@/lib/gear";
import { addCraftingCurrencies, EMPTY_CRAFTING_CURRENCIES, type CraftingCurrencyId } from "@/lib/gear";
import { combineTrinketEffectIds, computeTrinketManifest } from "@/lib/trinkets";
import { mergeIntoManifest } from "@/lib/homestead/effects";
import { computeRunMaxHealth } from "../run-flow/run-max-health";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import type {
  BuildingId,
  FarmId,
  MaterialInventory as ProfileMaterialInventory,
  ResearchId,
} from "@/lib/homestead/types";
import { stepRunRng, type RunRngStream } from "@/lib/rng";
import { DESTINATIONS, type Destination, type Screen } from "@/lib/routing";
import { current, isDraft, type Draft } from "immer";
import * as homestead from "./homestead-actions";
import { createInitialProfileState, type ProfileStateFields } from "./profile-store-types";
import {
  createInitialBattleFields,
  createInitialSessionFields,
  type RunDomainBattleState,
  type RunRewardFlow,
  type RunSessionFields,
} from "./run-domain-types";
import type { GameplayDraft } from "./run-session-command";
import {
  createInitialActiveRunFields,
  createInitialPermanentFields,
  runFieldsFromSnapshot,
  type ActiveRunProgressFields,
} from "./run-state-init";

type FieldUpdate<T> = T | ((previous: T) => T);

function setField<T extends object, K extends keyof T>(target: T, field: K, action: FieldUpdate<T[K]>): void {
  target[field] = typeof action === "function" ? (action as (previous: T[K]) => T[K])(target[field]) : action;
}

// ── Run progress ─────────────────────────────────────────────────────────────

function setRunProgressField<K extends keyof ActiveRunProgressFields>(
  draft: GameplayDraft,
  field: K,
  action: FieldUpdate<ActiveRunProgressFields[K]>,
): void {
  setField(draft.run.activeRun, field, action);
}

export function setRunDeck(draft: GameplayDraft, action: FieldUpdate<ActiveRunProgressFields["runDeck"]>): void {
  setRunProgressField(draft, "runDeck", action);
}

export function setRunPlayerHealth(
  draft: GameplayDraft,
  action: FieldUpdate<ActiveRunProgressFields["runPlayerHealth"]>,
): void {
  setRunProgressField(draft, "runPlayerHealth", action);
}

export function setRunMaxHealth(
  draft: GameplayDraft,
  action: FieldUpdate<ActiveRunProgressFields["runMaxHealth"]>,
): void {
  setRunProgressField(draft, "runMaxHealth", action);
}

export function setRoomsEncountered(
  draft: GameplayDraft,
  action: FieldUpdate<ActiveRunProgressFields["roomsEncountered"]>,
): void {
  setRunProgressField(draft, "roomsEncountered", action);
}

export function setCurrentAct(draft: GameplayDraft, action: FieldUpdate<ActiveRunProgressFields["currentAct"]>): void {
  setRunProgressField(draft, "currentAct", action);
}

export function setDestinationIndexInAct(
  draft: GameplayDraft,
  action: FieldUpdate<ActiveRunProgressFields["destinationIndexInAct"]>,
): void {
  setRunProgressField(draft, "destinationIndexInAct", action);
}

export function setCompletedDestinations(
  draft: GameplayDraft,
  action: FieldUpdate<ActiveRunProgressFields["completedDestinations"]>,
): void {
  setRunProgressField(draft, "completedDestinations", action);
}

export function setDestinationOfferState(
  draft: GameplayDraft,
  offerState: {
    lastOfferedDestinations: ActiveRunProgressFields["lastOfferedDestinations"];
    roundsSinceOffered: ActiveRunProgressFields["destinationRoundsSinceOffered"];
  },
): void {
  draft.run.activeRun.lastOfferedDestinations = [...offerState.lastOfferedDestinations];
  draft.run.activeRun.destinationRoundsSinceOffered = { ...offerState.roundsSinceOffered };
}

export function setRunBoons(draft: GameplayDraft, action: FieldUpdate<ActiveRunProgressFields["runBoons"]>): void {
  setRunProgressField(draft, "runBoons", action);
}

export function setEncounteredRunEnemyIds(
  draft: GameplayDraft,
  action: FieldUpdate<ActiveRunProgressFields["encounteredRunEnemyIds"]>,
): void {
  setRunProgressField(draft, "encounteredRunEnemyIds", action);
}

export function resetProgress(draft: GameplayDraft): void {
  draft.run.activeRun = {
    ...createInitialActiveRunFields(null, draft.run.activeRun.characterId),
    runTalentXP: {},
  };
  draft.run.initialized = false;
}

export function nextRunRandom(draft: GameplayDraft, stream: RunRngStream): number {
  return stepRunRng(draft.run.activeRun.rng, stream);
}

export function resetRunXP(draft: GameplayDraft): void {
  draft.run.activeRun.runTalentXP = {};
}

export function awardCardXP(draft: GameplayDraft, card: BattleCard): void {
  const keywords = filterKeywordsForTalentXP(getCardKeywords(card));
  if (keywords.length === 0) return;
  draft.run.activeRun.runTalentXP = addTalentXP(draft.run.activeRun.runTalentXP, keywords);
}

export function awardBattleDodgeXP(
  draft: GameplayDraft,
  previousState: BattleSnapshot,
  resultState: BattleSnapshot,
): void {
  const amount = resultState.playerDodgeCount - previousState.playerDodgeCount;
  if (amount <= 0) return;
  draft.run.activeRun.runTalentXP = addTalentXP(draft.run.activeRun.runTalentXP, ["dodge"], amount);
}

export function awardMysteryXP(draft: GameplayDraft, keywordId: KeywordId, amount: number): void {
  const keywords = filterKeywordsForTalentXP([keywordId]);
  if (keywords.length === 0) return;
  draft.run.activeRun.runTalentXP = addTalentXP(draft.run.activeRun.runTalentXP, keywords, amount);
}

export function addRunMaterialsEarned(draft: GameplayDraft, materials: ProfileMaterialInventory): void {
  draft.run.activeRun.runMaterialsEarned = addInventory(draft.run.activeRun.runMaterialsEarned, materials);
}

export function addRunCurrenciesEarned(
  draft: GameplayDraft,
  currencies: Partial<Record<CraftingCurrencyId, number>>,
): void {
  draft.run.activeRun.runCurrenciesEarned = addCraftingCurrencies(draft.run.activeRun.runCurrenciesEarned, currencies);
}

export function clearRunMaterialsEarned(draft: GameplayDraft): void {
  draft.run.activeRun.runMaterialsEarned = emptyInventory();
}

export function clearRunCurrenciesEarned(draft: GameplayDraft): void {
  draft.run.activeRun.runCurrenciesEarned = { ...EMPTY_CRAFTING_CURRENCIES };
}

export function cloneRunObtainedItem(item: RunObtainedItem): RunObtainedItem {
  if (item.kind === "trinket") return { kind: "trinket", trinketId: item.trinketId };
  return {
    kind: "gear",
    instance: { ...item.instance, affixes: item.instance.affixes.map((affix) => ({ ...affix })) },
  };
}

export function recordRunObtainedItem(draft: GameplayDraft, item: RunObtainedItem): void {
  draft.run.activeRun.runObtainedItems = [...draft.run.activeRun.runObtainedItems, cloneRunObtainedItem(item)];
}

export function initializeActiveRun(
  draft: GameplayDraft,
  activeRun: ActiveRunData | null,
  fallbackCharacterId: CharacterId = "knight",
): void {
  draft.run.activeRun = createInitialActiveRunFields(activeRun, fallbackCharacterId);
  draft.run.initialized = true;
}

export function initializeFromResumeSnapshot(draft: GameplayDraft, activeRun: ActiveRunProgressFields): void {
  draft.run.activeRun = activeRun;
  draft.run.initialized = true;
}

function hydrateFromSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void {
  draft.session.activity = { kind: "idle" };
  Object.assign(draft.run.activeRun, runFieldsFromSnapshot(snapshot), {
    runTalentXP: {},
    runMaterialsEarned: emptyInventory(),
    runCurrenciesEarned: { ...EMPTY_CRAFTING_CURRENCIES },
    runObtainedItems: [],
  });
}

// ── Gold (purse ⇄ battle mirror) ─────────────────────────────────────────────

export function readDraftGold(draft: GameplayDraft): number {
  return draft.runProfile.gold;
}

function syncBattleGoldFromPurse(draft: GameplayDraft): void {
  if (!draft.battle.hasActiveBattle) return;
  const pending = draft.battle.pendingBattleTransition;
  if (pending && "resultState" in pending) {
    const pendingGoldChange = pending.resultState.gold - draft.battle.battleState.gold;
    pending.resultState.gold = draft.runProfile.gold + pendingGoldChange;
  }
  draft.battle.battleState.gold = draft.runProfile.gold;
}

function syncPurseFromBattleGold(draft: GameplayDraft): void {
  if (!draft.battle.hasActiveBattle) return;
  draft.runProfile.gold = Math.max(0, draft.battle.battleState.gold);
}

export function setGold(draft: GameplayDraft, action: number | ((previous: number) => number)): void {
  const next = typeof action === "function" ? action(draft.runProfile.gold) : action;
  draft.runProfile.gold = Math.max(0, next);
  syncBattleGoldFromPurse(draft);
}

export function addGold(draft: GameplayDraft, amount: number): void {
  const multiplier = getGoldMultiplier(draft.run.activeRun.characterId, draft.run.activeRun.selectedDifficulty);
  setGold(draft, (gold) => gold + Math.round(amount * multiplier));
}

export function grantStartGold(draft: GameplayDraft, amount: number): void {
  if (amount <= 0) return;
  setGold(draft, (gold) => gold + amount);
}

export function deductGold(draft: GameplayDraft, amount: number): void {
  if (amount <= 0) return;
  setGold(draft, (gold) => Math.max(0, gold - amount));
}

// ── Navigation ───────────────────────────────────────────────────────────────

export function setScreen(draft: GameplayDraft, action: Screen | ((previous: Screen) => Screen)): void {
  const screen = typeof action === "function" ? action(draft.run.navigation.screen) : action;
  draft.run.navigation.screen = screen;
  prepareRunNavigation(draft, screen);
}

export function prepareRunNavigation(draft: GameplayDraft, screen: Screen): void {
  if (draft.session.activity.kind !== "inactive")
    draft.session.activity = transitionRunActivity(draft.session.activity, screen);
}

export function resetNavigation(draft: GameplayDraft): void {
  draft.run.navigation.screen = "menu";
  draft.session.activity = { kind: "idle" };
}

// ── Seeded run RNG ───────────────────────────────────────────────────────────

export function createDraftRunRandomSource(draft: GameplayDraft, stream: RunRngStream): () => number {
  return () => nextRunRandom(draft, stream);
}

export function withDraftWorldBattleRng(draft: GameplayDraft, battleState: BattleSnapshot): BattleState {
  const snapshot = isDraft(battleState) ? current(battleState) : battleState;
  return { ...snapshot, rng: createDraftRunRandomSource(draft, "world") };
}

// ── Battle ───────────────────────────────────────────────────────────────────

function hydrateBattleState(battleState: BattleSnapshot): BattleSnapshot {
  // Piles are re-hydrated against the card catalog so resumed battles pick up
  // catalog fixes. `pendingTurnStartEffects` (queued card effects + sourceCard)
  // is intentionally preserved as saved: those effects were already rolled and
  // mid-flight when the save was written, so re-hydrating them to the current
  // catalog would change the outcome of an in-flight turn.
  return {
    ...battleState,
    deck: battleState.deck.map(hydrateCard),
    hand: battleState.hand.map(hydrateCard),
    discard: battleState.discard.map(hydrateCard),
    exhausted: battleState.exhausted.map(hydrateCard),
    wishOptions: battleState.wishOptions ? battleState.wishOptions.map(hydrateCard) : null,
    wishQueue: battleState.wishQueue ? battleState.wishQueue.map((list) => list.map(hydrateCard)) : [],
  };
}

function hydratePersistedTransition(transition: PersistedBattleTransition | null): PersistedBattleTransition | null {
  // battleSnapshot strips runtime-only fields (live rng fns) so the committed
  // pending transition stays serializable; hydrateBattleState revives cards.
  if (!transition || !("resultState" in transition)) return transition;
  return {
    ...transition,
    resultState: battleSnapshot(hydrateBattleState(transition.resultState)),
  };
}

export const snapshotBattleState = battleSnapshot;

export function setSyncedBattleState(
  draft: GameplayDraft,
  action: BattleSnapshot | ((previous: BattleSnapshot) => BattleSnapshot),
): void {
  const previous = draft.battle.battleState;
  draft.battle.battleState = battleSnapshot(typeof action === "function" ? action(previous) : action);
}

export function setBattleState(
  draft: GameplayDraft,
  action: BattleSnapshot | ((previous: BattleSnapshot) => BattleSnapshot),
): void {
  // setSyncedBattleState already strips runtime-only fields via battleSnapshot;
  // do not snapshot twice.
  setSyncedBattleState(draft, action);
  syncPurseFromBattleGold(draft);
}

export function clearPendingTransitionResumeRequired(draft: GameplayDraft): void {
  draft.battle.pendingTransitionResumeRequired = false;
}

export function setBattleStartState(draft: GameplayDraft, state: BattleSnapshot | null): void {
  draft.battle.battleStartState = state ? battleSnapshot(state) : null;
}

export function setHasActiveBattle(draft: GameplayDraft, active: boolean | ((previous: boolean) => boolean)): void {
  draft.battle.hasActiveBattle = typeof active === "function" ? active(draft.battle.hasActiveBattle) : active;
}

export function initializeActiveBattle(
  draft: GameplayDraft,
  battleState: BattleSnapshot | null,
  pendingBattleTransition?: PersistedBattleTransition | null,
): void {
  if (!battleState) {
    Object.assign(draft.battle, createInitialBattleFields());
    return;
  }
  const hydrated = battleSnapshot(hydrateBattleState(battleState));
  const pending = hydratePersistedTransition(pendingBattleTransition ?? null);
  const battle: Draft<RunDomainBattleState> = draft.battle;
  battle.battleState = hydrated;
  battle.pendingBattleTransition = pending;
  battle.pendingTransitionResumeRequired = pending != null;
  battle.battleStartState = hydrated;
  battle.hasActiveBattle = true;
  prepareRunNavigation(draft, "battle");
  syncBattleGoldFromPurse(draft);
}

export function commitBattleTransition(
  draft: GameplayDraft,
  battleState: BattleSnapshot,
  pendingBattleTransition: PersistedBattleTransition | null,
): void {
  setSyncedBattleState(draft, battleState);
  draft.battle.pendingBattleTransition = hydratePersistedTransition(pendingBattleTransition);
  clearPendingTransitionResumeRequired(draft);
  syncPurseFromBattleGold(draft);
}

// ── Session ──────────────────────────────────────────────────────────────────

function setSessionField<K extends keyof RunSessionFields>(
  draft: GameplayDraft,
  field: K,
  action: FieldUpdate<RunSessionFields[K]>,
): void {
  setField(draft.session, field, action);
}

export function setPendingCharacterId(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["pendingCharacterId"]>,
): void {
  setSessionField(draft, "pendingCharacterId", action);
}

export function setPendingContentSystemType(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["pendingContentSystemType"]>,
): void {
  setSessionField(draft, "pendingContentSystemType", action);
}

export function setWildwoodDraft(draft: GameplayDraft, action: FieldUpdate<RunSessionFields["wildwoodDraft"]>): void {
  setSessionField(draft, "wildwoodDraft", action);
}

export function setStarterDraftChoices(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["starterDraftChoices"]>,
): void {
  setSessionField(draft, "starterDraftChoices", action);
}

export function setHasActiveRun(draft: GameplayDraft, active: boolean): void {
  if (!active) draft.session.activity = { kind: "inactive" };
  else if (draft.session.activity.kind === "inactive") draft.session.activity = { kind: "idle" };
}

export function clearTransientSession(draft: GameplayDraft): void {
  Object.assign(draft.session, createInitialSessionFields());
}

export function applyRunStartSnapshot(draft: GameplayDraft, snapshot: RunStartSnapshot): void {
  hydrateFromSnapshot(draft, snapshot);
  draft.session.runEndMaterials = emptyInventory();
  draft.session.runEndCurrencies = { ...EMPTY_CRAFTING_CURRENCIES };
  draft.session.runEndTalentXP = {};
  draft.session.runEndItems = [];
  draft.session.runEndLabyrinthFloor = null;
  setHasActiveRun(draft, snapshot.hasActiveRun);
}

function setRewardFlowField<K extends keyof RunRewardFlow>(
  draft: GameplayDraft,
  field: K,
  action: FieldUpdate<RunRewardFlow[K]>,
): void {
  setField(draft.session.rewardFlow, field, action);
}

export function setRewardState(draft: GameplayDraft, action: FieldUpdate<RunRewardFlow["state"]>): void {
  setRewardFlowField(draft, "state", action);
}

export function setCompanionRewardCards(
  draft: GameplayDraft,
  action: FieldUpdate<RunRewardFlow["companionCards"]>,
): void {
  setRewardFlowField(draft, "companionCards", action);
}

export function setRunEndMaterials(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["runEndMaterials"]>,
): void {
  setSessionField(draft, "runEndMaterials", action);
}

export function setRunEndCurrencies(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["runEndCurrencies"]>,
): void {
  setSessionField(draft, "runEndCurrencies", action);
}

export function setRunEndItems(draft: GameplayDraft, action: FieldUpdate<RunSessionFields["runEndItems"]>): void {
  setSessionField(draft, "runEndItems", action);
}

export function setCorruptionResult(draft: GameplayDraft, result: RunActivityData["corruption"]): void {
  if (result === null && draft.session.activity.kind !== "corruption") return;
  draft.session.activity = { kind: "corruption", data: result };
}

export function beginRewardClaim(draft: GameplayDraft): boolean {
  if (draft.session.rewardFlow.claim.kind !== "idle") return false;
  draft.session.rewardFlow.claim = { kind: "reward" };
  return true;
}

export function releaseRewardClaim(draft: GameplayDraft): void {
  if (draft.session.rewardFlow.claim.kind === "reward") draft.session.rewardFlow.claim = { kind: "idle" };
}

export function beginDestinationClaim(draft: GameplayDraft, destination: Destination): boolean {
  const flow = draft.session.rewardFlow;
  if (flow.claim.kind !== "idle" || !flow.state.destinations.includes(destination)) return false;
  flow.claim = { kind: "destination", destination };
  return true;
}

export function cancelDestinationClaim(draft: GameplayDraft): void {
  if (draft.session.rewardFlow.claim.kind === "destination") draft.session.rewardFlow.claim = { kind: "idle" };
}

export function commitDestinationClaim(draft: GameplayDraft, destination: Destination): boolean {
  const transient = draft.session;
  if (transient.rewardFlow.claim.kind !== "destination" || transient.rewardFlow.claim.destination !== destination)
    return false;
  if (!transient.rewardFlow.state.destinations.includes(destination)) {
    cancelDestinationClaim(draft);
    return false;
  }
  if (draft.run.activeRun.lastOfferedDestinations.length === 0) {
    setDestinationOfferState(draft, {
      lastOfferedDestinations: [...transient.rewardFlow.state.destinations],
      roundsSinceOffered: { ...draft.run.activeRun.destinationRoundsSinceOffered },
    });
  }
  setRewardState(draft, (previous) => ({ ...previous, destinations: [] }));
  cancelDestinationClaim(draft);
  setCompletedDestinations(draft, (previous) => [...previous, destination]);
  setDestinationIndexInAct(draft, (previous) => previous + 1);
  return true;
}

function abandonDestinationVisit(draft: GameplayDraft, destination: Destination): void {
  const transient = draft.session;

  if (transient.rewardFlow.claim.kind === "destination" && transient.rewardFlow.claim.destination === destination) {
    cancelDestinationClaim(draft);
  } else if (draft.run.activeRun.completedDestinations.at(-1) === destination) {
    setCompletedDestinations(draft, (previous) => previous.slice(0, -1));
    setDestinationIndexInAct(draft, (previous) => Math.max(0, previous - 1));
  }

  if (transient.rewardFlow.state.destinations.length === 0) {
    const restored = [...draft.run.activeRun.lastOfferedDestinations];
    if (restored.length > 0) {
      setRewardState(draft, (previous) => ({ ...previous, destinations: restored }));
    }
  }

  if (destination === DESTINATIONS.CORRUPTION) {
    setCorruptionResult(draft, null);
  }
}

export function abandonCorruptionDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.CORRUPTION);
}

export function abandonLabyrinthCorruptionVisit(draft: GameplayDraft): void {
  setCorruptionResult(draft, null);
  draft.session.activeLabyrinthPendingNode = null;
  draft.session.selectedLabyrinthNodeId = null;
}

export function abandonMysteryDestinationVisit(draft: GameplayDraft): void {
  abandonDestinationVisit(draft, DESTINATIONS.MYSTERY);
}

type ActivityUpdate<K extends keyof RunActivityData> = FieldUpdate<RunActivityData[K]>;

function readVisit<K extends keyof RunActivityData>(draft: GameplayDraft, kind: K): RunActivityData[K] {
  return readActivityData(draft.session.activity, kind);
}

function setVisitState<K extends keyof RunActivityData>(
  draft: GameplayDraft,
  kind: K,
  action: ActivityUpdate<K>,
): void {
  const data = typeof action === "function" ? action(readVisit(draft, kind)) : action;
  draft.session.activity = { kind, data } as GameplayDraft["session"]["activity"];
}

export function setShopState(draft: GameplayDraft, action: ActivityUpdate<"shop">): void {
  setVisitState(draft, "shop", action);
}

export function setAlchemistState(draft: GameplayDraft, action: ActivityUpdate<"alchemist">): void {
  setVisitState(draft, "alchemist", action);
}

export function setTrinketShopState(draft: GameplayDraft, action: ActivityUpdate<"trinket-shop">): void {
  setVisitState(draft, "trinket-shop", action);
}

export function setEquipmentShopState(draft: GameplayDraft, action: ActivityUpdate<"equipment-shop">): void {
  setVisitState(draft, "equipment-shop", action);
}

export function clearShopOfferings(draft: GameplayDraft): void {
  if (["shop", "alchemist", "trinket-shop", "equipment-shop"].includes(draft.session.activity.kind)) {
    draft.session.activity = { kind: "idle" };
  }
}

export function setActiveLabyrinthModifiers(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["activeLabyrinthModifiers"]>,
): void {
  setSessionField(draft, "activeLabyrinthModifiers", action);
}

export function setActiveLabyrinthRewardModifiers(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["activeLabyrinthRewardModifiers"]>,
): void {
  setSessionField(draft, "activeLabyrinthRewardModifiers", action);
}

export function setActiveLabyrinthPendingNode(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["activeLabyrinthPendingNode"]>,
): void {
  setSessionField(draft, "activeLabyrinthPendingNode", action);
}

export function setSelectedLabyrinthNodeId(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["selectedLabyrinthNodeId"]>,
): void {
  setSessionField(draft, "selectedLabyrinthNodeId", action);
}

export function setRunEndLabyrinthFloor(
  draft: GameplayDraft,
  action: FieldUpdate<RunSessionFields["runEndLabyrinthFloor"]>,
): void {
  setSessionField(draft, "runEndLabyrinthFloor", action);
}

export function setLabyrinthMap(draft: GameplayDraft, action: FieldUpdate<RunSessionFields["labyrinthMap"]>): void {
  setSessionField(draft, "labyrinthMap", action);
}

function setMysteryVisitField<K extends keyof HydratedMysteryVisit>(
  draft: GameplayDraft,
  field: K,
  action: FieldUpdate<HydratedMysteryVisit[K]>,
): void {
  if (draft.session.activity.kind !== "mystery") {
    draft.session.activity = { kind: "mystery", data: emptyHydratedMysteryVisit() };
  }
  const visit = draft.session.activity.data;
  visit[field] = typeof action === "function" ? action(visit[field]) : action;
}

export function setMysteryEvent(draft: GameplayDraft, action: FieldUpdate<HydratedMysteryVisit["mysteryEvent"]>): void {
  setMysteryVisitField(draft, "mysteryEvent", action);
}

export function setMysteryChosenChoice(
  draft: GameplayDraft,
  action: FieldUpdate<HydratedMysteryVisit["mysteryChosenChoice"]>,
): void {
  setMysteryVisitField(draft, "mysteryChosenChoice", action);
}

export function setMysteryPendingRemoval(
  draft: GameplayDraft,
  action: FieldUpdate<HydratedMysteryVisit["mysteryPendingRemoval"]>,
): void {
  // Legacy: only stale-visit clearing and tests write this; no live navigation sets it.
  setMysteryVisitField(draft, "mysteryPendingRemoval", action);
}

export function setMysteryCardChoices(
  draft: GameplayDraft,
  action: FieldUpdate<HydratedMysteryVisit["mysteryCardChoices"]>,
): void {
  setMysteryVisitField(draft, "mysteryCardChoices", action);
}

export function setMysteryGrantedTrinketIds(
  draft: GameplayDraft,
  action: FieldUpdate<HydratedMysteryVisit["mysteryGrantedTrinketIds"]>,
): void {
  setMysteryVisitField(draft, "mysteryGrantedTrinketIds", action);
}

export function setMysteryGrantedGearInstances(
  draft: GameplayDraft,
  action: FieldUpdate<HydratedMysteryVisit["mysteryGrantedGearInstances"]>,
): void {
  setMysteryVisitField(draft, "mysteryGrantedGearInstances", action);
}

export function setMysteryChosenCardId(
  draft: GameplayDraft,
  action: FieldUpdate<HydratedMysteryVisit["mysteryChosenCardId"]>,
): void {
  setMysteryVisitField(draft, "mysteryChosenCardId", action);
}

export function clearMysteryVisitState(draft: GameplayDraft): void {
  if (draft.session.activity.kind === "mystery") draft.session.activity = { kind: "idle" };
}

export function enterWildwoodVictory(draft: GameplayDraft): void {
  const wildwood = draft.session.wildwoodDraft;
  if (!wildwood) return;
  const reward = enterWildwoodReward(wildwood);
  if (reward) setWildwoodDraft(draft, reward);
}

// ── Meta (talents, XP merge, collection) ─────────────────────────────────────

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
    if (isTalentPlaceholder(talent)) continue;
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

export function clearPermanentData(draft: GameplayDraft): void {
  Object.assign(draft.runProfile, createInitialPermanentFields());
}

// Run talent XP merges into the permanent profile exactly once at run end;
// `finalizeRunXP` also records the merged snapshot for the run recap screen.
export function finalizeRunXP(draft: GameplayDraft): void {
  const runTalentXP = draft.run.activeRun.runTalentXP;
  if (Object.keys(runTalentXP).length === 0) {
    draft.session.runEndTalentXP = {};
    return;
  }
  const multiplier = getDifficultyXPMultiplier(draft.run.activeRun.selectedDifficulty);
  draft.session.runEndTalentXP = computeRunEndTalentXPSnapshot(runTalentXP, multiplier);
  draft.runProfile.talentXP = mergeRunTalentXPIntoPermanent(runTalentXP, draft.runProfile.talentXP, multiplier);
  resetRunXP(draft);
  rebindLiveRunMeta(draft);
}

function setProfileField<K extends keyof ProfileStateFields>(
  draft: GameplayDraft,
  field: K,
  action: FieldUpdate<ProfileStateFields[K]>,
): void {
  setField(draft.profile, field, action);
}

export function setDiscoveredCardIds(
  draft: GameplayDraft,
  action: FieldUpdate<ProfileStateFields["discoveredCardIds"]>,
): void {
  setProfileField(draft, "discoveredCardIds", action);
}

export function setEncounteredEnemyIds(
  draft: GameplayDraft,
  action: FieldUpdate<ProfileStateFields["encounteredEnemyIds"]>,
): void {
  setProfileField(draft, "encounteredEnemyIds", action);
}

export function setDiscoveredTrinketIds(
  draft: GameplayDraft,
  action: FieldUpdate<ProfileStateFields["discoveredTrinketIds"]>,
): void {
  setProfileField(draft, "discoveredTrinketIds", action);
}

export function setDiscoveredUniqueIds(
  draft: GameplayDraft,
  action: FieldUpdate<ProfileStateFields["discoveredUniqueIds"]>,
): void {
  setProfileField(draft, "discoveredUniqueIds", action);
}

export function setCompletedDifficulties(
  draft: GameplayDraft,
  action: FieldUpdate<ProfileStateFields["completedDifficulties"]>,
): void {
  setProfileField(draft, "completedDifficulties", action);
}

export function setFinishedRunCharacters(
  draft: GameplayDraft,
  action: FieldUpdate<ProfileStateFields["finishedRunCharacters"]>,
): void {
  setProfileField(draft, "finishedRunCharacters", action);
}

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

// ── Homestead ────────────────────────────────────────────────────────────────

function grantMaterials(
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

// Stockpile-only grant: homestead end-of-run bonuses and meta salvage. Run-earned
// materials must use `awardMaterialsDuringRun` so the run tally stays accurate
// (enforced by `alchemy/no-run-earned-add-materials`).
export function addMaterialsToStockpile(draft: GameplayDraft, materials: ProfileMaterialInventory): void {
  grantMaterials(draft, materials);
}

function rebindOnSuccess(ok: boolean, draft: GameplayDraft): boolean {
  if (ok) rebindLiveRunMeta(draft);
  return ok;
}

export function constructBuilding(draft: GameplayDraft, id: BuildingId): boolean {
  return rebindOnSuccess(homestead.constructBuilding(draft.runProfile, id), draft);
}

export function plantFarm(draft: GameplayDraft, id: FarmId): boolean {
  return rebindOnSuccess(homestead.plantFarm(draft.runProfile, id), draft);
}

export function completeResearch(draft: GameplayDraft, id: ResearchId): boolean {
  return rebindOnSuccess(homestead.completeResearch(draft.runProfile, id), draft);
}

export function bondCompanion(draft: GameplayDraft, id: CompanionId): boolean {
  return rebindOnSuccess(homestead.bondCompanion(draft.runProfile, id), draft);
}

// ── Live meta rebind ─────────────────────────────────────────────────────────
// After gear/talent/homestead changes, refresh derived run Health and the live
// battle manifest in the same command. Skipped when no run is active.

export interface CombatMeta {
  talentEffects: TalentEffectManifest;
  gearEffects: GearEffectManifest;
  activeTrinketIds: string[];
}

export function deriveCombatMeta(draft: GameplayDraft): CombatMeta {
  const run = draft.run.activeRun;
  const characterId = run.characterId;
  return {
    talentEffects: mergeIntoManifest(computeTalentEffects(draft.runProfile.unlockedTalents), draft.runProfile.effects),
    gearEffects: computeGearManifest(characterId, flattenGearInventories(draft.gear.inventories), draft.gear.loadouts),
    activeTrinketIds: combineTrinketEffectIds(run.runBoons, draft.gear.equippedTrinkets[characterId]),
  };
}

function applyDerivedMaxHealth(draft: GameplayDraft, gearBonus: number): void {
  const derived = computeRunMaxHealth(draft.runProfile.talentXP, gearBonus, draft.runProfile.effects.runMaxHealthBonus);

  const metaBaseline = draft.run.activeRun.runMetaMaxHealth;
  const combatBonus = Math.max(0, draft.run.activeRun.runMaxHealth - metaBaseline);
  draft.run.activeRun.runMetaMaxHealth = derived;
  draft.run.activeRun.runMaxHealth = Math.max(1, derived + combatBonus);
  draft.run.activeRun.runPlayerHealth = Math.min(draft.run.activeRun.runMaxHealth, draft.run.activeRun.runPlayerHealth);
}

function rebindBattleState(draft: GameplayDraft, combatMeta: CombatMeta): void {
  if (!draft.battle.hasActiveBattle) return;
  const battle = draft.battle.battleState;
  battle.gearEffects = combatMeta.gearEffects;
  battle.trinketEffects = computeTrinketManifest(combatMeta.activeTrinketIds);
  battle.talentEffects = combatMeta.talentEffects;
  battle.playerMaxHealth = draft.run.activeRun.runMaxHealth;
  battle.playerHealth = Math.min(battle.playerMaxHealth, battle.playerHealth);
  syncBattleGoldFromPurse(draft);
}

export function rebindLiveRunMeta(draft: GameplayDraft): void {
  if (draft.session.activity.kind === "inactive") return;
  const combatMeta = deriveCombatMeta(draft);
  applyDerivedMaxHealth(draft, combatMeta.gearEffects.maxHealth);
  rebindBattleState(draft, combatMeta);
}

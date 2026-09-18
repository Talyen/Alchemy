import type { RunObtainedItem } from "@/lib/active-run-session";
import type { BattleSnapshot } from "@/lib/battle";
import type { BattleCard, KeywordId } from "@/lib/game-data";
import { addTalentXP, filterKeywordsForTalentXP, getCardKeywords } from "@/lib/game-data";
import { addCraftingCurrencies, EMPTY_CRAFTING_CURRENCIES, type CraftingCurrencyId } from "@/lib/gear";
import { addInventory, emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory as ProfileMaterialInventory } from "@/lib/homestead/types";
import { stepRunRng, type RunRngStream } from "@/lib/rng";
import type { GameplayDraft } from "../run-session-command";
import type { ActiveRunProgressFields } from "../run-state-init";
import { type FieldUpdate, setField } from "./write-field";

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

// ── Talent XP awards ─────────────────────────────────────────────────────────

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

// ── Run-earned tallies (mirrors of the permanent stockpiles) ─────────────────
// See the dual-write invariants on the barrel: the earned tallies live here,
// the stockpile grants live in run-homestead.

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

// ── Obtained-item record ─────────────────────────────────────────────────────

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

// ── Seeded run RNG ───────────────────────────────────────────────────────────

export function nextRunRandom(draft: GameplayDraft, stream: RunRngStream): number {
  return stepRunRng(draft.run.activeRun.rng, stream);
}

export function createDraftRunRandomSource(draft: GameplayDraft, stream: RunRngStream): () => number {
  return () => nextRunRandom(draft, stream);
}

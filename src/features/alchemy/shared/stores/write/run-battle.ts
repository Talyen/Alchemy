import { awardMaterialsDuringRun } from "./run-homestead";
import { emptyInventory } from "@/lib/homestead/inventory";
import { addRunGoldEarned } from "./run-recap";
import { battleSnapshot, type BattleSnapshot, type BattleState } from "@/lib/battle";
import { current, isDraft } from "immer";
import type { GameplayDraft } from "../gameplay-command";
import type { RewardState } from "@/lib/active-run-session";
import type { BattleCard } from "@/lib/game-data";
import { createDraftRunRandomSource } from "./run-progress";
import { syncBattleGoldFromPurse } from "./run-gold";

export function withDraftWorldBattleRng(draft: GameplayDraft, battleState: BattleSnapshot): BattleState {
  const snapshot = isDraft(battleState) ? current(battleState) : battleState;
  return { ...snapshot, rng: createDraftRunRandomSource(draft, "world") };
}

function activeBattle(draft: GameplayDraft) {
  if (draft.session.activity.kind !== "battle") throw new Error("Battle mutation requires an active battle");
  return draft.session.activity.data;
}

function setSyncedBattleState(
  draft: GameplayDraft,
  action: BattleSnapshot | ((previous: BattleSnapshot) => BattleSnapshot),
): void {
  const battle = activeBattle(draft);
  battle.battleState = battleSnapshot(typeof action === "function" ? action(battle.battleState) : action);
}

export function setBattleState(
  draft: GameplayDraft,
  action: BattleSnapshot | ((previous: BattleSnapshot) => BattleSnapshot),
): void {
  setSyncedBattleState(draft, action);
  const gold = Math.max(0, activeBattle(draft).battleState.gold);
  addRunGoldEarned(draft, Math.max(0, gold - draft.runProfile.gold));
  draft.runProfile.gold = gold;
}

/** Enter combat only from a live non-combat activity; hydration sets its validated activity directly. */
export function enterBattle(draft: GameplayDraft, state: BattleSnapshot): boolean {
  if (draft.session.activity.kind === "inactive" || draft.session.activity.kind === "battle") return false;
  const snapshot = battleSnapshot(state);
  draft.session.activity = { kind: "battle", data: { battleState: snapshot } };
  syncBattleGoldFromPurse(draft);
  return true;
}

/** Rewards replace combat in one operation; no independently writable active flag remains. */
export function settleBattleVictory(
  draft: GameplayDraft,
  state: RewardState,
  companionCards: BattleCard[] | null,
): void {
  activeBattle(draft);
  draft.session.rewardFlow = { state, companionCards, claim: { kind: "idle" } };
  draft.session.activity = { kind: "rewards" };
}

/** Commit engine output as a resource change, never as a replacement of the live purse. */
export function commitResolvedBattle(draft: GameplayDraft, before: BattleSnapshot, after: BattleSnapshot): void {
  const goldDelta = after.gold - before.gold;
  const gold = Math.max(0, draft.runProfile.gold + goldDelta);
  setSyncedBattleState(draft, { ...after, gold });
  addRunGoldEarned(draft, Math.max(0, goldDelta));
  draft.runProfile.gold = gold;
}

export function settlePendingBattleMaterials(draft: GameplayDraft): void {
  const battle = activeBattle(draft);
  const materials = battle.battleState.pendingMaterials;
  if (Object.values(materials).some((amount) => amount > 0)) awardMaterialsDuringRun(draft, materials);
  battle.battleState.pendingMaterials = emptyInventory();
}

// Imperative session-store writes — prefer over direct getRunSessionStore() at call sites.
import type { BattleCard, CharacterId } from "@/lib/game-data";
import type { LabyrinthMap, LabyrinthModifierKind, ContentSystemId } from "@/lib/content-systems/types";
import type { CorruptionResult } from "@/lib/corruption";
import type { MysteryEvent } from "@/lib/mystery";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { TalentXP } from "@/lib/talents";
import type { LabyrinthNodePosition } from "@/features/alchemy/run/types";
import type { RewardState } from "@/features/alchemy/navigation/reward-flow";
import type { ShopState, AlchemistState } from "@/features/alchemy/shop/shop-state-init";
import type { Destination } from "@/features/alchemy/types";
import { createEmptyRewardState } from "@/features/alchemy/navigation/reward-flow";
import { getRunSessionStore } from "./store-access";

export function setHasActiveRun(hasActiveRun: boolean) {
  getRunSessionStore().setHasActiveRun(hasActiveRun);
}

export function setActiveLabyrinthModifiers(modifiers: LabyrinthModifierKind[]) {
  getRunSessionStore().setActiveLabyrinthModifiers(modifiers);
}

export function setActiveLabyrinthRewardModifiers(modifiers: LabyrinthModifierKind[]) {
  getRunSessionStore().setActiveLabyrinthRewardModifiers(modifiers);
}

export function setActiveLabyrinthPendingNode(node: LabyrinthNodePosition | null) {
  getRunSessionStore().setActiveLabyrinthPendingNode(node);
}

export function setLabyrinthMap(map: LabyrinthMap | ((prev: LabyrinthMap) => LabyrinthMap)) {
  getRunSessionStore().setLabyrinthMap(map);
}

export function setRewardState(state: RewardState | ((prev: RewardState) => RewardState)) {
  getRunSessionStore().setRewardState(state);
}

export function applyDestinationChoices(choices: Destination[]) {
  setRewardState((prev) => ({ ...prev, destinations: choices }));
}

export function setMysteryEvent(event: MysteryEvent | null) {
  getRunSessionStore().setMysteryEvent(event);
}

export function setMysteryCardChoices(
  choices: BattleCard[] | null | ((prev: BattleCard[] | null) => BattleCard[] | null),
) {
  getRunSessionStore().setMysteryCardChoices(choices);
}

export function setShopState(state: ShopState | ((prev: ShopState) => ShopState)) {
  getRunSessionStore().setShopState(state);
}

export function setAlchemistState(state: AlchemistState | ((prev: AlchemistState) => AlchemistState)) {
  getRunSessionStore().setAlchemistState(state);
}

export function setRunEndMaterials(materials: MaterialInventory) {
  getRunSessionStore().setRunEndMaterials(materials);
}

export function setRunEndTalentXP(xp: TalentXP) {
  getRunSessionStore().setRunEndTalentXP(xp);
}

export function setCorruptionResult(result: CorruptionResult | null) {
  getRunSessionStore().setCorruptionResult(result);
}

export function setPendingCharacterId(id: CharacterId | null) {
  getRunSessionStore().setPendingCharacterId(id);
}

export function setPendingContentSystemType(type: ContentSystemId) {
  getRunSessionStore().setPendingContentSystemType(type);
}

export function setCompanionRewardCards(cards: BattleCard[] | null) {
  getRunSessionStore().setCompanionRewardCards(cards);
}

/** Clears transient run-session fields during teardown (battle/run stores reset separately). */
export function clearTransientRunSessionState() {
  setPendingContentSystemType("campaign");
  setRewardState(createEmptyRewardState());
  setMysteryEvent(null);
  setMysteryCardChoices(null);
  setRunEndTalentXP({});
  setHasActiveRun(false);
}

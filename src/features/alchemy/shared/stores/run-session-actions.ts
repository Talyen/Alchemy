// Imperative session writes — prefer over direct domain store access at call sites.
import type { BattleCard, CharacterId } from "@/lib/game-data";
import type { LabyrinthMap, LabyrinthModifierKind, ContentSystemId } from "@/lib/content-systems/types";
import type { CorruptionResult } from "@/lib/corruption";
import type { MysteryEvent } from "@/lib/mystery";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { LabyrinthNodePosition } from "@/lib/active-run-session";
import type { RewardState } from "@/features/alchemy/navigation/reward-flow";
import type { ShopState, AlchemistState } from "@/features/alchemy/shop/shop-state-init";
import type { Destination } from "@/features/alchemy/types";
import { getRunDomainStore } from "./run-domain-store";

export function setHasActiveRun(hasActiveRun: boolean) {
  getRunDomainStore().setHasActiveRun(hasActiveRun);
}

export function setActiveLabyrinthModifiers(modifiers: LabyrinthModifierKind[]) {
  getRunDomainStore().setActiveLabyrinthModifiers(modifiers);
}

export function setActiveLabyrinthRewardModifiers(modifiers: LabyrinthModifierKind[]) {
  getRunDomainStore().setActiveLabyrinthRewardModifiers(modifiers);
}

export function setActiveLabyrinthPendingNode(node: LabyrinthNodePosition | null) {
  getRunDomainStore().setActiveLabyrinthPendingNode(node);
}

export function setLabyrinthMap(map: LabyrinthMap | ((prev: LabyrinthMap) => LabyrinthMap)) {
  getRunDomainStore().setLabyrinthMap(map);
}

export function setRewardState(state: RewardState | ((prev: RewardState) => RewardState)) {
  getRunDomainStore().setRewardState(state);
}

export function applyDestinationChoices(choices: Destination[]) {
  setRewardState((prev) => ({ ...prev, destinations: choices }));
}

export function setMysteryEvent(event: MysteryEvent | null) {
  getRunDomainStore().setMysteryEvent(event);
}

export function setMysteryCardChoices(
  choices: BattleCard[] | null | ((prev: BattleCard[] | null) => BattleCard[] | null),
) {
  getRunDomainStore().setMysteryCardChoices(choices);
}

export function setShopState(state: ShopState | ((prev: ShopState) => ShopState)) {
  getRunDomainStore().setShopState(state);
}

export function setAlchemistState(state: AlchemistState | ((prev: AlchemistState) => AlchemistState)) {
  getRunDomainStore().setAlchemistState(state);
}

export function setRunEndMaterials(materials: MaterialInventory) {
  getRunDomainStore().setRunEndMaterials(materials);
}

export function setCorruptionResult(result: CorruptionResult | null) {
  getRunDomainStore().setCorruptionResult(result);
}

export function setPendingCharacterId(id: CharacterId | null) {
  getRunDomainStore().setPendingCharacterId(id);
}

export function setPendingContentSystemType(type: ContentSystemId) {
  getRunDomainStore().setPendingContentSystemType(type);
}

export function setCompanionRewardCards(cards: BattleCard[] | null) {
  getRunDomainStore().setCompanionRewardCards(cards);
}

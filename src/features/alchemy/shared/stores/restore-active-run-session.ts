import {
  repairShopOfferings,
  shopItemSlotKey,
  type EquipmentShopState,
  type TrinketShopState,
} from "@/lib/active-run-session";
import { gearDefinitions, getOwnedUniqueDefinitionIds } from "@/lib/gear";
import type { DecodedRunResumeSession } from "./run-resume-codec";
import type { GameplayDraft } from "./run-session-command";
import {
  setActiveLabyrinthModifiers,
  setActiveLabyrinthPendingNode,
  setActiveLabyrinthRewardModifiers,
  setAlchemistState,
  setCompanionRewardCards,
  setCorruptionResult,
  setEquipmentShopState,
  setLabyrinthMap,
  setMysteryCardChoices,
  setMysteryChosenCardId,
  setMysteryChosenChoice,
  setMysteryEvent,
  setMysteryGrantedGearInstances,
  setMysteryGrantedTrinketIds,
  setMysteryPendingRemoval,
  setRewardState,
  setShopState,
  setStarterDraftChoices,
  setTrinketShopState,
  setWildwoodDraft,
} from "./write-port-session";

export function restoreRunSession(draft: GameplayDraft, decoded: DecodedRunResumeSession): void {
  if (decoded.labyrinthMap) setLabyrinthMap(draft, decoded.labyrinthMap);
  setActiveLabyrinthModifiers(draft, decoded.activeLabyrinthModifiers);
  setActiveLabyrinthRewardModifiers(draft, decoded.activeLabyrinthRewardModifiers);
  setActiveLabyrinthPendingNode(draft, decoded.labyrinthPendingNode);
  setWildwoodDraft(draft, decoded.wildwoodDraft);
  setStarterDraftChoices(draft, decoded.starterDraftChoices);
  if (decoded.rewardState) setRewardState(draft, decoded.rewardState);
  setCompanionRewardCards(draft, decoded.companionRewardCards);
  if (decoded.shopState) setShopState(draft, decoded.shopState);
  if (decoded.alchemistState) setAlchemistState(draft, decoded.alchemistState);
  if (decoded.trinketShopState) {
    setTrinketShopState(draft, repairRestoredTrinketShop(decoded.trinketShopState, draft.gear.ownedTrinketIds));
  }
  if (decoded.equipmentShopState) {
    setEquipmentShopState(draft, repairRestoredEquipmentShop(decoded.equipmentShopState, draft.gear.inventories));
  }
  setMysteryEvent(draft, decoded.mysteryEvent);
  setMysteryChosenChoice(draft, decoded.mysteryChosenChoice);
  setMysteryPendingRemoval(draft, decoded.mysteryPendingRemoval);
  setMysteryCardChoices(draft, decoded.mysteryCardChoices);
  setMysteryGrantedTrinketIds(draft, decoded.mysteryGrantedTrinketIds);
  setMysteryGrantedGearInstances(draft, decoded.mysteryGrantedGearInstances);
  setMysteryChosenCardId(draft, decoded.mysteryChosenCardId);
  setCorruptionResult(draft, decoded.corruptionResult);
}

function repairRestoredTrinketShop(state: TrinketShopState, ownedIds: readonly string[]): TrinketShopState {
  const owned = new Set(ownedIds);
  const repaired = repairShopOfferings(
    state.trinkets,
    state.purchasedSlotKeys,
    (trinket) => !owned.has(trinket.id),
    (trinket, index) => shopItemSlotKey(trinket.id, index),
  );
  return { ...state, trinkets: repaired.items, purchasedSlotKeys: repaired.purchasedSlotKeys };
}

function repairRestoredEquipmentShop(
  state: EquipmentShopState,
  inventories: GameplayDraft["gear"]["inventories"],
): EquipmentShopState {
  const ownedUniques = getOwnedUniqueDefinitionIds(inventories);
  const repaired = repairShopOfferings(
    state.gear,
    state.purchasedSlotKeys,
    (instance) =>
      gearDefinitions[instance.definitionId]?.rarity !== "unique" || !ownedUniques.has(instance.definitionId),
    (instance) => instance.instanceId,
  );
  return { ...state, gear: repaired.items, purchasedSlotKeys: repaired.purchasedSlotKeys };
}

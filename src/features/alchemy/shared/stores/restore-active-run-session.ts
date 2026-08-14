// Apply the decoded resume session to the aggregate's session region.
import type { DecodedRunResumeSession } from "./run-resume-codec";
import type { SessionActions } from "./slices/session-slice";

/** Session-region writers needed to rehydrate a persisted run. */
type SessionStore = Pick<
  SessionActions,
  | "setLabyrinthMap"
  | "setActiveLabyrinthModifiers"
  | "setActiveLabyrinthRewardModifiers"
  | "setActiveLabyrinthPendingNode"
  | "setRewardState"
  | "setCompanionRewardCards"
  | "setWildwoodDraft"
  | "setShopState"
  | "setAlchemistState"
  | "setTrinketShopState"
  | "setEquipmentShopState"
  | "setMysteryEvent"
  | "setMysteryChosenChoice"
  | "setMysteryPendingRemoval"
  | "setMysteryCardChoices"
  | "setMysteryGrantedTrinketIds"
  | "setMysteryChosenCardId"
  | "setCorruptionResult"
>;

export function restoreRunSession(store: SessionStore, decoded: DecodedRunResumeSession): void {
  if (decoded.labyrinthMap) store.setLabyrinthMap(decoded.labyrinthMap);
  store.setActiveLabyrinthModifiers(decoded.activeLabyrinthModifiers);
  store.setActiveLabyrinthRewardModifiers(decoded.activeLabyrinthRewardModifiers);
  store.setActiveLabyrinthPendingNode(decoded.labyrinthPendingNode);
  store.setWildwoodDraft(decoded.wildwoodDraft);
  if (decoded.rewardState) store.setRewardState(decoded.rewardState);
  store.setCompanionRewardCards(decoded.companionRewardCards);
  if (decoded.shopState) store.setShopState(decoded.shopState);
  if (decoded.alchemistState) store.setAlchemistState(decoded.alchemistState);
  if (decoded.trinketShopState) store.setTrinketShopState(decoded.trinketShopState);
  if (decoded.equipmentShopState) store.setEquipmentShopState(decoded.equipmentShopState);
  store.setMysteryEvent(decoded.mysteryEvent);
  store.setMysteryChosenChoice(decoded.mysteryChosenChoice);
  store.setMysteryPendingRemoval(decoded.mysteryPendingRemoval);
  store.setMysteryCardChoices(decoded.mysteryCardChoices);
  store.setMysteryGrantedTrinketIds(decoded.mysteryGrantedTrinketIds);
  store.setMysteryChosenCardId(decoded.mysteryChosenCardId);
  store.setCorruptionResult(decoded.corruptionResult);
}

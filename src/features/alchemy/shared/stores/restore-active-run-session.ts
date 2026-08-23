// Apply the decoded resume session to the aggregate's session region.
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

/** Rehydrate a persisted run's transient session fields onto the command draft. */
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
  if (decoded.trinketShopState) setTrinketShopState(draft, decoded.trinketShopState);
  if (decoded.equipmentShopState) setEquipmentShopState(draft, decoded.equipmentShopState);
  setMysteryEvent(draft, decoded.mysteryEvent);
  setMysteryChosenChoice(draft, decoded.mysteryChosenChoice);
  setMysteryPendingRemoval(draft, decoded.mysteryPendingRemoval);
  setMysteryCardChoices(draft, decoded.mysteryCardChoices);
  setMysteryGrantedTrinketIds(draft, decoded.mysteryGrantedTrinketIds);
  setMysteryGrantedGearInstances(draft, decoded.mysteryGrantedGearInstances);
  setMysteryChosenCardId(draft, decoded.mysteryChosenCardId);
  setCorruptionResult(draft, decoded.corruptionResult);
}

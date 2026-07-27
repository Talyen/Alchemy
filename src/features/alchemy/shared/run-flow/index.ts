// Neutral run-flow seam: destination sampling and campaign start helpers shared by
// run-setup and run-loop without cross-phase imports.
export {
  createEmptyDestinationOfferState,
  getRunAvailableDestinations,
  lastOfferedIncludesCombat,
  computeDestinationWeight,
  advanceDestinationOfferState,
  sampleDestinationChoices,
  restoreOrCreateDestinationRewardState,
  withSelectedBossForDestinations,
  createDestinationRewardState,
  type DestinationOptionsInput,
  type DestinationOfferState,
  type DestinationWeightContext,
  type SampleDestinationChoicesResult,
} from "./destination-flow";

export { getPreviousDestination, tryStartNoviceCampaignBattle, afterCampaignCharacterResolved } from "./campaign-start";

export { resolveAvailableDestinations, type ResolveAvailableDestinationsInput } from "./resolve-available-destinations";

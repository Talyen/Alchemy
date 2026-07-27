// Re-export from shared/run-flow — destination sampling lives in the neutral seam.
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
  type DestinationOfferState,
} from "@/features/alchemy/shared/run-flow/destination-flow";

import type { BattleCard } from "../../types";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const companionCards: BattleCard[] = [
  cardBuilders.summonCompanionCard({ id: "wolf-companion", art: assetRefs.wolfCompanion, companionId: "wolf" }),
  cardBuilders.summonCompanionCard({
    id: "lizard-scout-companion",
    art: assetRefs.lizardScoutCompanion,
    companionId: "lizard-scout",
  }),
  cardBuilders.summonCompanionCard({
    id: "frost-whelp-companion",
    art: assetRefs.frostWhelpCompanion,
    companionId: "frost-whelp",
  }),
  cardBuilders.summonCompanionCard({ id: "bear-companion", art: assetRefs.bearCompanion, companionId: "bear" }),
  cardBuilders.summonCompanionCard({
    id: "panther-companion",
    art: assetRefs.pantherCompanion,
    companionId: "panther",
  }),
  cardBuilders.summonCompanionCard({
    id: "phoenix-companion",
    art: assetRefs.phoenixCompanion,
    companionId: "phoenix",
  }),
  cardBuilders.summonCompanionCard({
    id: "skeleton-companion",
    title: "Risen Skeleton",
    art: assetRefs.risenSkeletonCompanion,
    companionId: "skeleton",
  }),
  cardBuilders.summonCompanionCard({ id: "pixie-companion", art: assetRefs.pixieCompanion, companionId: "pixie" }),
  cardBuilders.summonCompanionCard({
    id: "mana-moth-companion",
    art: assetRefs.manaMothCompanion,
    companionId: "mana-moth",
  }),
  cardBuilders.summonCompanionCard({
    id: "will-o-wisp-companion",
    title: "Will-o'-Wisp",
    art: assetRefs.willOWispCompanion,
    companionId: "will-o-wisp",
  }),
  cardBuilders.summonCompanionCard({
    id: "golden-retriever-companion",
    art: assetRefs.goldenRetrieverCompanion,
    companionId: "golden-retriever",
  }),
  cardBuilders.summonCompanionCard({
    id: "shield-scarab-companion",
    art: assetRefs.shieldScarabCompanion,
    companionId: "shield-scarab",
  }),
  cardBuilders.summonCompanionCard({
    id: "library-owl-companion",
    art: assetRefs.libraryOwlCompanion,
    companionId: "library-owl",
  }),
  cardBuilders.summonCompanionCard({
    id: "fox-companion",
    art: assetRefs.foxCompanion,
    companionId: "fox",
  }),
];

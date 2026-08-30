import {
  bearCompanion,
  goldenRetrieverCompanion,
  libraryOwlCompanion,
  lizardScoutCompanion,
  manaMothCompanion,
  pantherCompanion,
  phoenixCompanion,
  pixieCompanion,
  risenSkeletonCompanion,
  shieldScarabCompanion,
  willOWispCompanion,
  wolfCompanion,
  frostWhelpCompanion,
  foxCompanion,
} from "./assets";
import type { CompanionDefinition, CompanionId } from "./types";

export const companionLibrary: Record<CompanionDefinition["id"], CompanionDefinition> = {
  wolf: {
    id: "wolf",
    title: "Wolf Companion",
    art: wolfCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "bleed", amount: 1 }],
  },
  "lizard-scout": {
    id: "lizard-scout",
    title: "Lizard Scout Companion",
    art: lizardScoutCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "poison", amount: 1 }],
  },
  "frost-whelp": {
    id: "frost-whelp",
    title: "Frost Whelp Companion",
    art: frostWhelpCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "freeze", amount: 1 }],
  },
  bear: {
    id: "bear",
    title: "Bear Companion",
    art: bearCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "stun", amount: 1 }],
  },
  panther: {
    id: "panther",
    title: "Panther Companion",
    art: pantherCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "bleed", amount: 1 }],
  },
  phoenix: {
    id: "phoenix",
    title: "Phoenix Companion",
    art: phoenixCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "burn", amount: 1 }],
  },
  skeleton: {
    id: "skeleton",
    title: "Risen Skeleton Companion",
    art: risenSkeletonCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "physical", amount: 1 }],
  },
  pixie: {
    id: "pixie",
    title: "Pixie Companion",
    art: pixieCompanion,
    turnStartEffects: [{ kind: "heal", amount: 1 }],
  },
  "mana-moth": {
    id: "mana-moth",
    title: "Mana Moth Companion",
    art: manaMothCompanion,
    turnStartEffects: [{ kind: "restore-mana", amount: 1 }],
  },
  "will-o-wisp": {
    id: "will-o-wisp",
    title: "Will-o'-Wisp Companion",
    art: willOWispCompanion,
    turnStartEffects: [{ kind: "remove-harmful-status", amount: 1 }],
  },
  "golden-retriever": {
    id: "golden-retriever",
    title: "Golden Retriever Companion",
    art: goldenRetrieverCompanion,
    turnStartEffects: [{ kind: "gain-gold", amount: 1 }],
  },
  "shield-scarab": {
    id: "shield-scarab",
    title: "Shield Scarab Companion",
    art: shieldScarabCompanion,
    turnStartEffects: [{ kind: "player-status", status: "block", amount: 2 }],
  },
  "library-owl": {
    id: "library-owl",
    title: "Library Owl Companion",
    art: libraryOwlCompanion,
    turnStartEffects: [{ kind: "draw-cards", amount: 1 }],
  },
  fox: {
    id: "fox",
    title: "Fox Companion",
    art: foxCompanion,
    turnStartEffects: [
      {
        kind: "chance",
        probability: 0.5,
        successEffects: [{ kind: "damage", damageType: "bleed", amount: 1 }],
        failureEffects: [{ kind: "gain-gold", amount: 1 }],
      },
    ],
  },
};

export const defaultCompanionBondLevels: Record<CompanionId, number> = Object.fromEntries(
  Object.keys(companionLibrary).map((id) => [id, 0]),
) as Record<CompanionId, number>;

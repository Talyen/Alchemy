// Companion data used by battle state and summon effects; depends on optimized art assets.
import {
  impCompanion,
  lizardScoutCompanion,
  wolfCompanion,
  frostWhelpCompanion,
  bearCompanion,
  pantherCompanion,
  phoenixCompanion,
} from "./assets";
import type { CompanionDefinition } from "./types";

// Companion definitions describe persistent battle allies and the player-originated
// effects they trigger at the beginning of each player turn.
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
  imp: {
    id: "imp",
    title: "Imp Companion",
    art: impCompanion,
    turnStartEffects: [{ kind: "damage", damageType: "burn", amount: 1 }],
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
};

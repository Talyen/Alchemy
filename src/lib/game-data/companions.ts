// Companion data used by battle state and summon effects; depends on optimized art assets.
import { impCompanion, lizardScoutCompanion, wolfCompanion } from "./assets";
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
    turnStartEffects: [{ kind: "damage", damageType: "burn", amount: 2 }],
  },
};

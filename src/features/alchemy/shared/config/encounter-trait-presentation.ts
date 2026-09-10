import { FlaskConical, Gift, Leaf, Pickaxe, Swords, type LucideIcon } from "lucide-react";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { LABYRINTH_TRAITS } from "@/lib/content-systems/labyrinth/trait-catalog";
import type { EncounterCombatTraitId, EncounterRewardTraitId, EncounterTraitId } from "@/lib/content-systems/types";
import type { KeywordId } from "./game-data-catalog";
import { keywordIcons } from "./metadata";

const additionalTraitKeywords = (category: "combat" | "reward") =>
  Object.fromEntries(
    Object.entries(LABYRINTH_TRAITS)
      .filter(([, trait]) => trait.category === category)
      .map(([id, trait]) => [id, [trait.keyword]]),
  );

export const ENCOUNTER_COMBAT_TRAIT_KEYWORDS: Partial<Record<EncounterCombatTraitId, KeywordId[]>> = {
  ...additionalTraitKeywords("combat"),
  tempered: ["forge"],
  plated: ["armor"],
  reinforced: ["block"],
  braced: ["stun"],
  septic: ["poison", "bleed"],
  caustic: ["poison"],
  flesheater: ["bleed", "leech"],
  combustible: ["burn"],
  chilling: ["freeze"],
  thorns: ["physical"],
  zealot: ["holy"],
  insatiable: ["consume"],
  jealous: ["wish"],
  concussive: ["stun"],
  rooted: ["nature"],
  overgrowth: ["health"],
  "holy-retribution": ["holy"],
  "divine-aegis": ["armor"],
};

export const ENCOUNTER_REWARD_TRAIT_KEYWORDS: Partial<Record<EncounterRewardTraitId, KeywordId[]>> = {
  ...additionalTraitKeywords("reward"),
  generous: ["gold"],
  alchemist: ["poison"],
  scavenger: ["forge"],
  companion: ["companion"],
  wealthy: ["gold"],
  herbalist: ["nature"],
  wellProvisioned: ["health"],
};

const traitIcons: Partial<Record<EncounterTraitId, LucideIcon>> = {
  alchemist: FlaskConical,
  scavenger: Pickaxe,
  herbalist: Leaf,
};

const traitKeywords: Partial<Record<EncounterTraitId, KeywordId[]>> = {
  ...ENCOUNTER_COMBAT_TRAIT_KEYWORDS,
  ...ENCOUNTER_REWARD_TRAIT_KEYWORDS,
};

export function getEncounterTraitPresentation(id: string) {
  if (!Object.hasOwn(ENCOUNTER_TRAITS, id)) return undefined;
  const traitId = id as EncounterTraitId;
  const keywords = traitKeywords[traitId] ?? [];
  const primary = keywords[0];
  const Icon =
    traitIcons[traitId] ??
    (primary ? keywordIcons[primary] : ENCOUNTER_TRAITS[traitId].category === "combat" ? Swords : Gift);
  return { keywords, Icon };
}

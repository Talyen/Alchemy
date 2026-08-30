import type { EnemyTrait } from "@/lib/game-data";
import { LABYRINTH_REWARD_CONFIG } from "@/lib/game-constants";
import { sampleItems } from "@/lib/utils";
import type { ContentSystemId } from "./content-system-ids";

const RETIRED_ENCOUNTER_TRAIT_IDS = [
  "armored",
  "sturdy",
  "burning-ground",
  "overwhelming",
  "leeching",
  "null-field",
  "collector",
] as const;

const RETIRED_ENCOUNTER_TRAIT_ID_SET = new Set<string>(RETIRED_ENCOUNTER_TRAIT_IDS);

export type EncounterTraitCategory = "combat" | "reward";
type EncounterMode = Extract<ContentSystemId, "labyrinth" | "wildwood">;

interface EncounterTraitInput {
  category: EncounterTraitCategory;
  label: string;
  description: string;
  modes: readonly EncounterMode[];
}

function defineEncounterTraits<const Catalog extends Record<string, EncounterTraitInput>>(catalog: Catalog) {
  return Object.fromEntries(
    Object.entries(catalog).map(([id, definition]) => [
      id,
      {
        ...definition,
        id,
        enemyTrait: { id, title: definition.label, description: definition.description },
      },
    ]),
  ) as {
    [Id in keyof Catalog & string]: Catalog[Id] & { id: Id; enemyTrait: EnemyTrait };
  };
}

function combat(label: string, description: string): EncounterTraitInput & { category: "combat" } {
  return { category: "combat", label, description, modes: ["labyrinth", "wildwood"] };
}

function reward(
  label: string,
  description: string,
  modes: readonly EncounterMode[],
): EncounterTraitInput & { category: "reward" } {
  return { category: "reward", label, description, modes };
}

export const ENCOUNTER_TRAITS = defineEncounterTraits({
  tempered: combat("Tempered", "Gains 1 Forge each turn"),
  plated: combat("Plated", "Gains 1 Armor each turn"),
  reinforced: combat("Reinforced", "Gains 2 Block each turn"),
  braced: combat("Braced", "Receives half Stun build-up"),
  septic: combat("Septic", "Deals 1 Poison or Bleed damage each turn"),
  caustic: combat("Caustic", "Deals 1 Poison damage and strips 1 Armor each turn"),
  flesheater: combat("Flesheater", "Deals 1 Bleed damage each turn\nLeech"),
  combustible: combat("Combustible", "Deals 1 Burn damage each turn"),
  chilling: combat("Chilling", "Deals 1 Freeze damage each turn"),
  thorns: combat("Thorns", "Deals 1 Physical damage when attacked"),
  zealot: combat("Zealot", "Deals 2 Holy damage each turn"),
  insatiable: combat("Insatiable", "Gains 1 Physical damage each time you Consume a card"),
  jealous: combat("Jealous", "Gains 1 Physical damage each time you Wish"),
  concussive: combat("Concussive", "Deals 1 Stun damage each turn"),
  rooted: combat("Rooted", "Gains 1 Block when you play a Nature card"),
  overgrowth: combat("Overgrowth", "Restores 1 Health each turn"),
  "holy-retribution": combat("Holy Retribution", "Deals 1 Holy damage when attacked"),
  "divine-aegis": combat("Divine Aegis", "Gains 2 Armor and 4 Block the first time reaching 50% Health"),
  generous: reward("Generous", "Victory Gold is increased by 50%", ["labyrinth"]),
  alchemist: reward("Alchemist", "Gain a random Potion alongside the normal reward", ["labyrinth", "wildwood"]),
  scavenger: reward("Scavenger", "Material loot from this encounter is doubled", ["labyrinth"]),
  companion: reward("Companion", "Choose a free Companion card after the battle", ["labyrinth", "wildwood"]),
  wealthy: reward("Wealthy", `Gain ${LABYRINTH_REWARD_CONFIG.wealthyGoldBonus} bonus Gold`, ["labyrinth"]),
  herbalist: reward("Herbalist", `Gain ${LABYRINTH_REWARD_CONFIG.herbalistHerbBonus} bonus Herbs`, ["labyrinth"]),
  wellProvisioned: reward(
    "Well-Provisioned",
    `Restore ${Math.round(LABYRINTH_REWARD_CONFIG.wellProvisionedHealFraction * 100)}% Health after victory`,
    ["labyrinth"],
  ),
});

export type EncounterTraitId = keyof typeof ENCOUNTER_TRAITS;
type EncounterTraitIdFor<Category extends EncounterTraitCategory> = {
  [Id in EncounterTraitId]: (typeof ENCOUNTER_TRAITS)[Id]["category"] extends Category ? Id : never;
}[EncounterTraitId];
export type EncounterCombatTraitId = EncounterTraitIdFor<"combat">;
export type EncounterRewardTraitId = EncounterTraitIdFor<"reward">;

function idsForCategory<Category extends EncounterTraitCategory>(
  category: Category,
): [EncounterTraitIdFor<Category>, ...Array<EncounterTraitIdFor<Category>>] {
  const ids = Object.values(ENCOUNTER_TRAITS)
    .filter((trait) => trait.category === category)
    .map((trait) => trait.id) as Array<EncounterTraitIdFor<Category>>;
  const [first, ...rest] = ids;
  if (!first) throw new Error(`Encounter trait category ${category} must not be empty`);
  return [first, ...rest];
}

export const COMBAT_ENCOUNTER_TRAIT_IDS = idsForCategory("combat");
export const REWARD_ENCOUNTER_TRAIT_IDS = idsForCategory("reward");

const ELIGIBLE_TRAIT_POOLS: Record<
  EncounterMode,
  {
    combat: EncounterCombatTraitId[];
    reward: EncounterRewardTraitId[];
  }
> = {
  labyrinth: {
    combat: Object.values(ENCOUNTER_TRAITS)
      .filter(
        (trait): trait is typeof trait & { category: "combat" } =>
          trait.category === "combat" && trait.modes.includes("labyrinth"),
      )
      .map((trait) => trait.id),
    reward: Object.values(ENCOUNTER_TRAITS)
      .filter(
        (trait): trait is typeof trait & { category: "reward" } =>
          trait.category === "reward" && trait.modes.includes("labyrinth"),
      )
      .map((trait) => trait.id),
  },
  wildwood: {
    combat: Object.values(ENCOUNTER_TRAITS)
      .filter(
        (trait): trait is typeof trait & { category: "combat" } =>
          trait.category === "combat" && trait.modes.includes("wildwood"),
      )
      .map((trait) => trait.id),
    reward: Object.values(ENCOUNTER_TRAITS)
      .filter(
        (trait): trait is typeof trait & { category: "reward" } =>
          trait.category === "reward" && trait.modes.includes("wildwood"),
      )
      .map((trait) => trait.id),
  },
};

export function eligibleEncounterTraitIds<Category extends EncounterTraitCategory>(
  mode: EncounterMode,
  category: Category,
): Array<EncounterTraitIdFor<Category>> {
  return ELIGIBLE_TRAIT_POOLS[mode][category] as Array<EncounterTraitIdFor<Category>>;
}

function isEncounterTraitId(value: string): value is EncounterTraitId {
  return Object.hasOwn(ENCOUNTER_TRAITS, value);
}

export function sanitizeEncounterTraitIds(values: readonly string[], category: "combat"): EncounterCombatTraitId[];
export function sanitizeEncounterTraitIds(values: readonly string[], category: "reward"): EncounterRewardTraitId[];
export function sanitizeEncounterTraitIds(
  values: readonly string[],
  category: EncounterTraitCategory,
): EncounterTraitId[] {
  return [...new Set(values)].filter(
    (value): value is EncounterTraitId => isEncounterTraitId(value) && ENCOUNTER_TRAITS[value].category === category,
  );
}

export function pickEncounterTraits<Category extends EncounterTraitCategory>(
  mode: EncounterMode,
  category: Category,
  count: number,
  rng: () => number,
): Array<EncounterTraitIdFor<Category>> {
  return sampleItems(eligibleEncounterTraitIds(mode, category), count, rng);
}

export function pickEncounterTrait<Category extends EncounterTraitCategory>(
  mode: EncounterMode,
  category: Category,
  rng: () => number,
): EncounterTraitIdFor<Category> {
  const [traitId] = pickEncounterTraits(mode, category, 1, rng);
  if (!traitId) throw new Error(`No ${category} encounter traits are eligible for ${mode}`);
  return traitId;
}

export function appendEncounterTraits<T extends { traits: EnemyTrait[] }>(
  enemy: T,
  ids: readonly EncounterCombatTraitId[],
): T {
  return { ...enemy, traits: [...enemy.traits, ...ids.map((id) => ENCOUNTER_TRAITS[id].enemyTrait)] };
}

export function sanitizePersistedEnemyTraits(traits: readonly EnemyTrait[]): EnemyTrait[] {
  return traits.filter((trait) => !RETIRED_ENCOUNTER_TRAIT_ID_SET.has(trait.id));
}

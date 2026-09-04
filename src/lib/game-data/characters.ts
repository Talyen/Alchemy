import type { BattleCard } from "./types";
import { cardById } from "./cards";
import type { KeywordId } from "./types";

export type CharacterId = "knight" | "ranger" | "rogue" | "wizard" | "alchemist" | "warlock" | "druid" | "wildcard";

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  role: string;
  description: string;
  startingDeck: BattleCard[];
  keywords: KeywordId[];
}

function resolveDeck(ids: string[]): BattleCard[] {
  return ids.map((cardId) => cardById[cardId]).filter((card): card is BattleCard => Boolean(card));
}

export const characters: Record<CharacterId, CharacterDefinition> = {
  knight: {
    id: "knight",
    name: "Knight",
    role: "Vanguard",
    description: "A durable frontliner who relies on Armor, Forge, and Block synergies to outlast opponents.",
    startingDeck: resolveDeck(["anvil", "bash", "block", "plate-mail", "shield-bash", "sunder", "spiked-shield"]),
    keywords: ["block", "armor", "stun"],
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    role: "Skirmisher",
    description: "A swift opportunist who steals Gold, applies Bleed, and strikes with Poison.",
    startingDeck: resolveDeck([
      "steal",
      "poison-dagger",
      "stab",
      "serrated-edge",
      "blackjack",
      "shadowstep",
      "hemorrhage",
    ]),
    keywords: ["poison", "bleed", "gold"],
  },
  wizard: {
    id: "wizard",
    name: "Wizard",
    role: "Arcanist",
    description: "A master of the elements who wields Mana to Burn and Freeze his foes.",
    startingDeck: resolveDeck([
      "fireball",
      "frostbolt",
      "mana-crystals",
      "meteor",
      "mana-shield",
      "cold-snap",
      "ray-of-frost",
    ]),
    keywords: ["burn", "freeze", "mana"],
  },
  ranger: {
    id: "ranger",
    name: "Ranger",
    role: "Wildkeeper",
    description: "A wilderness guardian with a Companion who uses Archery to protect Nature.",
    startingDeck: resolveDeck([
      "wolf-companion",
      "pack-tactics",
      "lightning-arrow",
      "venom-arrow",
      "bounty-shot",
      "astral-arrow",
      "ice-shot",
    ]),
    keywords: ["nature", "companion", "archery"],
  },
  alchemist: {
    id: "alchemist",
    name: "Alchemist",
    role: "Apothecary",
    description: "Mix and Consume Potions while you Poison your enemies with deadly toxins.",
    startingDeck: resolveDeck([
      "acid-potion",
      "health-potion",
      "poison-dagger",
      "wishing-potion",
      "panacea-potion",
      "caustic-jab",
      "kindling",
    ]),
    keywords: ["poison", "consume", "gold"],
  },
  warlock: {
    id: "warlock",
    name: "Warlock",
    role: "Cursemaster",
    description: "A dark pact caster who can Leech from his foes while they Burn and Bleed.",
    startingDeck: resolveDeck([
      "fangs",
      "kindling",
      "faustian-bargain",
      "blood-offering",
      "combustion",
      "dark-pact",
      "skeleton-companion",
    ]),
    keywords: ["bleed", "leech", "burn"],
  },
  druid: {
    id: "druid",
    name: "Druid",
    role: "Wildwarden",
    description: "Forest warden with a Companion who calls upon Mana to wield the elements of Nature.",
    startingDeck: resolveDeck([
      "bloodthorn",
      "grasping-vines",
      "mana-berries",
      "bear-companion",
      "cinderbloom",
      "briar-shield",
      "earthquake",
    ]),
    keywords: ["nature", "mana", "companion"],
  },
  wildcard: {
    id: "wildcard",
    name: "Wildcard",
    role: "Freebooter",
    description: "A master of none who drafts a custom deck at the start of each run.",
    startingDeck: [],
    keywords: [],
  },
};

export function getStartingDeck(characterId: CharacterId): BattleCard[] {
  return [...characters[characterId].startingDeck];
}

export const allStartingDeckCardIds = Array.from(
  new Set(Object.values(characters).flatMap((character) => character.startingDeck.map((card) => card.id))),
);

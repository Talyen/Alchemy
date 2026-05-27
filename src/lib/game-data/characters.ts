// Character class definitions — starting decks, gold multipliers, and keyword XP preferences.
// Depends on card library and type contracts. Each character is a play-style preset.
import type { BattleCard } from "./types";
import { cardLibrary } from "./cards";
import type { KeywordId } from "./types";

export type CharacterId = "knight" | "ranger" | "rogue" | "wizard" | "alchemist" | "warlock" | "druid" | "wildcard";

export type CharacterDefinition = {
  id: CharacterId;
  name: string;
  role: string;
  description: string;
  startingDeck: BattleCard[];
  keywords: KeywordId[];
};

function resolveDeck(ids: string[]): BattleCard[] {
  return ids
    .map((cardId) => cardLibrary.find((card) => card.id === cardId))
    .filter((card): card is BattleCard => Boolean(card));
}

export const characters: Record<CharacterId, CharacterDefinition> = {
  knight: {
    id: "knight",
    name: "Knight",
    role: "Vanguard",
    description: "A durable frontliner who relies on armor, forge, and block synergies to outlast opponents.",
    startingDeck: resolveDeck(["anvil", "bash", "slash", "block", "plate-mail", "shield-bash", "sunder-armor"]),
    keywords: ["block", "armor", "stun"],
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    role: "Skirmisher",
    description: "A swift opportunist who steals gold, applies bleeds, and strikes with precision.",
    startingDeck: resolveDeck(["steal", "poison-dagger", "stab", "slash", "serrated-edge", "blackjack"]),
    keywords: ["poison", "bleed", "gold"],
  },
  wizard: {
    id: "wizard",
    name: "Wizard",
    role: "Arcanist",
    description: "A master of the elements who burns, freezes, and manipulates mana to control the battlefield.",
    startingDeck: resolveDeck([
      "fireball",
      "frostbolt",
      "mana-crystals",
      "meteor",
      "wish",
      "mana-shield",
      "cold-snap",
      "phoenix-companion",
    ]),
    keywords: ["burn", "freeze", "mana"],
  },
  ranger: {
    id: "ranger",
    name: "Ranger",
    role: "Wildkeeper",
    description: "A wilderness guardian who calls upon nature, companions, and arrows.",
    startingDeck: resolveDeck(["slash", "stab", "fangs", "wolf-companion", "apple", "mana-berries", "pack-tactics"]),
    keywords: ["nature", "companion", "archery"],
  },
  alchemist: {
    id: "alchemist",
    name: "Alchemist",
    role: "Apothecary",
    description: "A master of toxins who poisons enemies, consumes potions for powerful effects, and hoards gold.",
    startingDeck: resolveDeck([
      "poison-dagger",
      "acid-potion",
      "health-potion",
      "stoneskin-potion",
      "mana-potion",
      "wishing-potion",
    ]),
    keywords: ["poison", "consume", "gold"],
  },
  warlock: {
    id: "warlock",
    name: "Warlock",
    role: "Cursemaster",
    description: "A dark pact mage who bleeds foes, leeches life, and scorches with hellfire.",
    startingDeck: resolveDeck([
      "fireball",
      "fangs",
      "cauterize",
      "imp-companion",
      "faustian-bargain",
      "blood-offering",
      "health-potion",
    ]),
    keywords: ["bleed", "leech", "burn"],
  },
  druid: {
    id: "druid",
    name: "Druid",
    role: "Wildwarden",
    description: "A guardian of the wild who commands nature, shapes mana, and fights alongside animal companions.",
    startingDeck: resolveDeck([
      "bloodthorn",
      "grasping-vines",
      "pack-tactics",
      "mana-berries",
      "bear-companion",
      "cinderbloom",
      "heal",
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

// Starting decks are cloned for each run so run mutations never alter static character data.
export function getStartingDeck(characterId: CharacterId): BattleCard[] {
  return [...characters[characterId].startingDeck];
}

export const allStartingDeckCardIds = Array.from(
  new Set(Object.values(characters).flatMap((character) => character.startingDeck.map((card) => card.id))),
);

// Character class definitions — starting decks, gold multipliers, and keyword XP preferences.
// Depends on card library and type contracts. Each character is a play-style preset.
import type { BattleCard } from "./types";
import { cardLibrary } from "./cards";
import type { KeywordId } from "./types";

export type CharacterId = "knight" | "ranger" | "rogue" | "wizard";

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
    startingDeck: resolveDeck([
      "anvil",
      "bash",
      "bread",
      "slash",
      "block",
      "plate-mail",
      "stoneskin-potion",
      "shield-bash",
    ]),
    keywords: ["block", "armor", "stun"],
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    role: "Skirmisher",
    description: "A swift opportunist who steals gold, applies bleeds, and strikes with precision.",
    startingDeck: resolveDeck([
      "steal",
      "poison-dagger",
      "stab",
      "slash",
      "fangs",
      "apple",
      "luck-potion",
      "acid-potion",
      "blackjack",
    ]),
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
      "mana-berries",
      "mana-crystals",
      "mana-potion",
      "meteor",
      "health-potion",
      "wishing-potion",
      "wish",
    ]),
    keywords: ["burn", "freeze", "mana"],
  },
  ranger: {
    id: "ranger",
    name: "Ranger",
    role: "Wildkeeper",
    description: "A wilderness guardian whose nature, companion, and trap synergies will arrive in a future update.",
    startingDeck: resolveDeck([
      "slash",
      "stab",
      "fangs",
      "heal",
      "wolf-companion",
      "apple",
      "mana-berries",
      "pack-tactics",
      "bloodthorn",
    ]),
    keywords: ["nature", "companion", "trap"],
  },
};

// Starting decks are cloned for each run so run mutations never alter static character data.
export function getStartingDeck(characterId: CharacterId): BattleCard[] {
  return [...characters[characterId].startingDeck];
}

export const allStartingDeckCardIds = Array.from(
  new Set(Object.values(characters).flatMap((character) => character.startingDeck.map((card) => card.id))),
);

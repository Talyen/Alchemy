import type { BattleCard } from "./types";
import { cardLibrary } from "./cards";
import type { KeywordId } from "./types";

export type CharacterId = "knight" | "rogue" | "wizard";

export type CharacterGender = "male" | "female";

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
    ]),
    keywords: ["burn", "freeze", "mana"],
  },
};

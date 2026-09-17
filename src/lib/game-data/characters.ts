import type { BattleCard } from "./types";
import { cardById } from "./cards";
import { cloneBattleCard } from "./cards/hydrate-card";
import type { KeywordId } from "./types";

export type CharacterId = "knight" | "ranger" | "rogue" | "wizard" | "alchemist" | "warlock" | "druid" | "wildcard";

export interface CharacterDefinition {
  id: CharacterId;
  name: string;
  role: string;
  startingDeck: BattleCard[];
  keywords: KeywordId[];
}

function resolveDeck(ids: string[]): BattleCard[] {
  // Fail loudly: silently dropping a typo'd id would shorten the starting deck
  // (and its tooltip) from 7 to 6 with no signal.
  return ids.map((cardId) => {
    const card = cardById[cardId];
    if (!card) throw new Error(`resolveDeck: unknown card id "${cardId}"`);
    return card;
  });
}

export const characters: Record<CharacterId, CharacterDefinition> = {
  knight: {
    id: "knight",
    name: "Knight",
    role: "Vanguard",
    startingDeck: resolveDeck(["anvil", "bash", "block", "plate-mail", "shield-bash", "sunder", "spiked-shield"]),
    keywords: ["block", "armor", "forge"],
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    role: "Skirmisher",
    startingDeck: resolveDeck([
      "steal",
      "poison-dagger",
      "stab",
      "serrated-edge",
      "blackjack",
      "shadowstep",
      "hemorrhage",
    ]),
    keywords: ["gold", "bleed", "poison"],
  },
  ranger: {
    id: "ranger",
    name: "Ranger",
    role: "Wildkeeper",
    startingDeck: resolveDeck([
      "wolf-companion",
      "pack-tactics",
      "lightning-arrow",
      "venom-arrow",
      "bounty-shot",
      "astral-arrow",
      "ice-shot",
    ]),
    keywords: ["companion", "nature", "archery"],
  },
  wizard: {
    id: "wizard",
    name: "Wizard",
    role: "Arcanist",
    startingDeck: resolveDeck([
      "fireball",
      "frostbolt",
      "mana-crystals",
      "meteor",
      "mana-shield",
      "stargaze",
      "ray-of-frost",
    ]),
    // mana-shield converts Mana but contributes only the Block keyword: Mana
    // coverage rests on mana-crystals + meteor.
    keywords: ["mana", "burn", "freeze"],
  },
  alchemist: {
    id: "alchemist",
    name: "Alchemist",
    role: "Apothecary",
    startingDeck: resolveDeck([
      "acid-potion",
      "health-potion",
      "poison-dagger",
      "wishing-potion",
      "panacea-potion",
      "caustic-jab",
      "kindling",
    ]),
    keywords: ["wish", "poison", "consume"],
  },
  warlock: {
    id: "warlock",
    name: "Warlock",
    role: "Cursemaster",
    startingDeck: resolveDeck([
      "fangs",
      "kindling",
      "faustian-bargain",
      "blood-offering",
      "combustion",
      "dark-pact",
      "skeleton-companion",
    ]),
    keywords: ["bleed", "burn", "leech"],
  },
  druid: {
    id: "druid",
    name: "Druid",
    role: "Wildwarden",
    startingDeck: resolveDeck([
      "bloodthorn",
      "grasping-vines",
      "mana-berries",
      "bear-companion",
      "cinderbloom",
      "briar-shield",
      "earthquake",
    ]),
    keywords: ["mana", "nature", "companion"],
  },
  wildcard: {
    id: "wildcard",
    name: "Wildcard",
    role: "Freebooter",
    startingDeck: [],
    keywords: [],
  },
};

export function getStartingDeck(characterId: CharacterId): BattleCard[] {
  // Clone: startingDeck holds shared catalog objects (with nested effects),
  // so each run needs its own copies or mutations leak across runs.
  return characters[characterId].startingDeck.map(cloneBattleCard);
}

export const allStartingDeckCardIds = Array.from(
  new Set(Object.values(characters).flatMap((character) => character.startingDeck.map((card) => card.id))),
);

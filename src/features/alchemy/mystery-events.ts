import { manaBerries } from "@/lib/game-data";

// A single result from resolving a mystery choice.
// Effects are applied by the controller when a choice is confirmed.
export type MysteryEffect =
  | { kind: "addCard"; cardId: string }
  | { kind: "healHP"; amount: number }
  | { kind: "damageHP"; amount: number }
  | { kind: "gainGold"; amount: number }
  | { kind: "gainMaxMana"; amount: number }
  | { kind: "none" };

// A choice the player can make during a mystery event.
export type MysteryChoice = {
  label: string;
  description: string;
  effects: MysteryEffect[];
};

// A mystery event definition — art, narrative, and choices.
export type MysteryEvent = {
  id: string;
  title: string;
  art: string;
  narrative: string;
  choices: MysteryChoice[];
};

// The full pool of possible mystery events. Extend this array to add new events.
// Each event follows the same structure: art + narrative + choices → result.
export const mysteryPool: MysteryEvent[] = [
  {
    id: "mana-berries",
    title: "Mana Berries",
    art: manaBerries,
    narrative: "You stumble upon a lush field of glowing Mana Berries. Their faint blue radiance pulses gently, promising restored mana. Harvesting them would yield useful supplies, but perhaps it is wiser to leave them undisturbed.",
    choices: [
      {
        label: "Harvest",
        description: "Add a Mana Berries card to your deck.",
        effects: [{ kind: "addCard", cardId: "mana-berries" }],
      },
      {
        label: "Leave",
        description: "Continue on your journey without taking anything.",
        effects: [{ kind: "none" }],
      },
    ],
  },
];

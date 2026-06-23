// Lightweight card factories for E2E battle setup (no game-data webp imports).
import { makeTestCard } from "../fixtures/cards";

export function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    ...makeTestCard({
      id: "slash",
      title: "Slash",
      descriptionLines: ["Deal 6 Physical damage"],
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    }),
    ...overrides,
  };
}

export const BLOCK_CARD = {
  id: "block",
  title: "Block",
  descriptionLines: ["Gain 5 Block"],
  art: "placeholder",
  cost: 1,
  effects: [{ kind: "player-status", status: "block", amount: 5 }],
};

export const AEGIS_CARD = {
  id: "blessed-aegis",
  title: "Blessed Aegis",
  descriptionLines: ["Deal Holy damage equal to your Block"],
  art: "placeholder",
  cost: 1,
  effects: [{ kind: "damage", damageType: "holy", amount: 0, equalToBlock: true }],
};

export const ANVIL_CARD = {
  id: "anvil",
  title: "Anvil",
  descriptionLines: ["Gain 1 Forge"],
  art: "placeholder",
  cost: 1,
  effects: [{ kind: "player-status", status: "forge", amount: 1 }],
};

export const MANA_BERRIES_CARD = {
  id: "mana-berries",
  title: "Mana Berries",
  descriptionLines: ["Restore 2 Mana", "Consume"],
  art: "placeholder",
  cost: 1,
  consume: true,
  effects: [{ kind: "restore-mana", amount: 2 }],
};

export function makeStatusCard(damageType: string, amount: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `test-${damageType}`,
    title: damageType.charAt(0).toUpperCase() + damageType.slice(1),
    descriptionLines: [`Deal ${amount} ${damageType} damage`],
    art: "placeholder",
    cost: 0,
    effects: [{ kind: "damage", damageType, amount }],
    ...overrides,
  };
}

export const WOLF_COMPANION_CARD = {
  id: "wolf-companion",
  title: "Wolf",
  descriptionLines: ["Summon a wolf ally"],
  art: "placeholder",
  cost: 1,
  effects: [{ kind: "summon-companion", companionId: "wolf" as const }],
};

export function makeHighDamageCard(amount = 500) {
  return {
    id: "boss-killer",
    title: "Boss Killer",
    descriptionLines: ["Deal massive damage"],
    art: "placeholder",
    cost: 0,
    effects: [{ kind: "damage" as const, damageType: "burn" as const, amount }],
  };
}

export const STARTING_DECK: Array<Record<string, unknown>> = [
  {
    id: "slash",
    title: "Slash",
    descriptionLines: ["Deal 6 Physical damage"],
    art: "placeholder",
    cost: 1,
    effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
  },
  {
    id: "bash",
    title: "Bash",
    descriptionLines: ["Deal 4 Stun damage"],
    art: "placeholder",
    cost: 1,
    effects: [{ kind: "damage", damageType: "stun", amount: 4 }],
  },
  {
    id: "block",
    title: "Block",
    descriptionLines: ["Gain 5 Block"],
    art: "placeholder",
    cost: 1,
    effects: [{ kind: "player-status", status: "block", amount: 5 }],
  },
  {
    id: "anvil",
    title: "Anvil",
    descriptionLines: ["Gain 1 Forge"],
    art: "placeholder",
    cost: 1,
    effects: [{ kind: "player-status", status: "forge", amount: 1 }],
  },
  {
    id: "plate-mail",
    title: "Plate Mail",
    descriptionLines: ["Gain 2 Armor"],
    art: "placeholder",
    cost: 1,
    effects: [{ kind: "player-status", status: "armor", amount: 2 }],
  },
  {
    id: "bread",
    title: "Bread",
    descriptionLines: ["Gain 5 Health", "Consume"],
    art: "placeholder",
    cost: 1,
    consume: true,
    effects: [{ kind: "heal", amount: 5 }],
  },
];

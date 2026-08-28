import type { BattleCard } from "@/lib/game-data";
import type { DamageType } from "@/lib/game-data/types";
import { makeTestCard } from "../fixtures/cards";

let nextFactoryCardUid = 1;

export function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    ...makeTestCard({
      id: "slash",
      title: "Slash",
      descriptionLines: ["Deal 6 Physical damage"],
      uid: nextFactoryCardUid++,
      effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
    }),
    ...overrides,
  };
}

export const BLOCK_CARD = makeTestCard({
  id: "block",
  title: "Block",
  descriptionLines: ["Gain 5 Block"],
  art: "placeholder",
  effects: [{ kind: "player-status", status: "block", amount: 5 }],
});

export const AEGIS_CARD = makeTestCard({
  id: "blessed-aegis",
  title: "Blessed Aegis",
  descriptionLines: ["Deal Holy damage equal to your Block"],
  art: "placeholder",
  effects: [{ kind: "damage", damageType: "holy", amount: 0, equalToBlock: true }],
});

export const ANVIL_CARD = makeTestCard({
  id: "anvil",
  title: "Anvil",
  descriptionLines: ["Gain 1 Forge"],
  art: "placeholder",
  effects: [{ kind: "player-status", status: "forge", amount: 1 }],
});

export function makeStatusCard(damageType: string, amount: number, overrides: Record<string, unknown> = {}) {
  return {
    ...makeTestCard({
      id: `test-${damageType}`,
      title: damageType.charAt(0).toUpperCase() + damageType.slice(1),
      descriptionLines: [`Deal ${amount} ${damageType} damage`],
      art: "placeholder",
      cost: 0,
      effects: [{ kind: "damage", damageType: damageType as DamageType, amount }],
    }),
    ...overrides,
  };
}

export const WOLF_COMPANION_CARD = makeTestCard({
  id: "wolf-companion",
  title: "Wolf",
  descriptionLines: ["Summon a wolf ally"],
  art: "placeholder",
  effects: [{ kind: "summon-companion", companionId: "wolf" as const }],
});

export function makeHighDamageCard(amount = 500) {
  return makeTestCard({
    id: "fireball",
    title: "Boss Killer",
    descriptionLines: ["Deal massive damage"],
    art: "placeholder",
    cost: 0,
    effects: [{ kind: "damage", damageType: "burn" as const, amount }],
  });
}

export const STARTING_DECK: BattleCard[] = [
  makeCard(),
  makeTestCard({
    id: "bash",
    title: "Bash",
    descriptionLines: ["Deal 4 Stun damage"],
    art: "placeholder",
    effects: [{ kind: "damage", damageType: "stun", amount: 4 }],
  }),
  BLOCK_CARD,
  ANVIL_CARD,
  makeTestCard({
    id: "plate-mail",
    title: "Plate Mail",
    descriptionLines: ["Gain 2 Armor"],
    art: "placeholder",
    effects: [{ kind: "player-status", status: "armor", amount: 2 }],
  }),
  makeTestCard({
    id: "bread",
    title: "Bread",
    descriptionLines: ["Gain 5 Health", "Consume"],
    art: "placeholder",
    consume: true,
    effects: [{ kind: "heal", amount: 5 }],
  }),
];

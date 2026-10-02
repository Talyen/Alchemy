import type { BattleCard } from "@/lib/game-data/types";
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

const BLOCK_CARD = makeTestCard({
  id: "block",
  title: "Block",
  descriptionLines: ["Gain 5 Block"],
  art: "placeholder",
  effects: [{ kind: "player-status", status: "block", amount: 5 }],
});

const ANVIL_CARD = makeTestCard({
  id: "anvil",
  title: "Anvil",
  descriptionLines: ["Gain 1 Forge"],
  art: "placeholder",
  effects: [{ kind: "player-status", status: "forge", amount: 1 }],
});

export function makeStatusCard(damageType: string, amount: number, overrides: Record<string, unknown> = {}) {
  return {
    ...makeTestCard({
      id: "slash",
      title: damageType.charAt(0).toUpperCase() + damageType.slice(1),
      descriptionLines: [`Deal ${amount} ${damageType} damage`],
      art: "placeholder",
      cost: 0,
      effects: [{ kind: "damage", damageType: damageType as DamageType, amount }],
    }),
    ...overrides,
  };
}

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

export function makeStartingDeck(): BattleCard[] {
  return [
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
      descriptionLines: ["Restore 6 Health", "Consume"],
      art: "placeholder",
      consume: true,
      effects: [{ kind: "heal", amount: 6 }],
    }),
  ];
}

import type { BattleCard } from "../../types";
import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";
import { cardMagnitude } from "../../card-description-model";
import { SHIELD_BASH_SPEND_VERSION } from "../card-definition-versions";

export const coreCards: BattleCard[] = [
  cardBuilders.damageCard({ id: "slash", damageType: "physical", amount: 4 }),
  cardBuilders.effectsCard("stab", [
    { kind: "damage", damageType: "physical", amount: 3, ignoreArmor: true, ignoreBlock: true },
  ]),
  cardBuilders.effectsCard("cleanse", [
    { kind: "remove-harmful-status", amount: 1 },
    { kind: "heal", amount: 2 },
  ]),
  cardBuilders.effectsCard("heal", [{ kind: "heal", amount: 4 }]),
  cardBuilders.effectsCard("haste", [{ kind: "player-status", status: "haste", amount: 1 }], { consume: true }),
  cardBuilders.effectsCard("poison-dagger", [
    { kind: "damage", damageType: "poison", amount: 1 },
    { kind: "next-hit-poison" },
  ]),
  cardBuilders.damageCard({ id: "fireball", damageType: "burn", amount: 2 }),
  cardBuilders.effectsCard("fangs", [{ kind: "damage", damageType: "bleed", amount: 2, lifesteal: true }]),
  cardBuilders.damageCard({ id: "frostbolt", damageType: "freeze", amount: 3 }),
  cardBuilders.playerStatusCard({ id: "anvil", status: "forge", amount: 2 }),
  cardBuilders.damageCard({ id: "bash", damageType: "stun", amount: 3 }),
  cardBuilders.playerStatusCard({ id: "block", status: "block", amount: 5 }),
  cardBuilders.effectsCard("blessed-aegis", [
    { kind: "player-status", status: "block", amount: 2 },
    { kind: "damage", damageType: "holy", amount: 0, equalToBlock: true, equalToBlockPercent: 50 },
  ]),
  cardBuilders.effectsCard("wish", [{ kind: "wish", amount: 1 }]),
  cardBuilders.effectsCard(
    "meteor",
    [
      { kind: "damage", damageType: "burn", amount: 7 },
      { kind: "lose-mana", amount: 1 },
    ],
    { consume: true },
  ),
  {
    id: "mixed-potion",
    title: "Mixed Potion",
    descriptionLines: ["Mixed at an Alchemist's Shop", CONSUME_DESCRIPTION_LINE],
    description: [
      { parts: ["Mixed at an Alchemist's Shop"], role: "effect" },
      { parts: [CONSUME_DESCRIPTION_LINE], role: "consume" },
    ],
    art: assetRefs.mixedPotion,
    cost: 1,
    consume: true,
    effects: [],
    excludeFromOfferPool: true,
  },
  cardBuilders.effectsCard(
    "ray-of-frost",
    [
      { kind: "damage", damageType: "freeze", amount: 1 },
      { kind: "damage", damageType: "freeze", amount: 1 },
    ],
    { title: "Ray of Frost" },
  ),
  cardBuilders.effectsCard("tithe", [
    { kind: "damage", damageType: "holy", amount: 2 },
    { kind: "gain-gold", amount: 1 },
  ]),
  cardBuilders.effectsCard("exorcism", [
    { kind: "self-damage", damageType: "burn", amount: 1 },
    { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" },
  ]),
  cardBuilders.effectsCard("kindling", [
    { kind: "damage", damageType: "burn", amount: 1, tripleIfEnemyNotBurning: true },
  ]),
  cardBuilders.effectsCard("roll-the-dice", [{ kind: "random-draw", minAmount: 1, maxAmount: 6 }], {
    title: "Roll the Dice",
    consume: true,
  }),
  cardBuilders.damageCard({ id: "lightning-bolt", damageType: "nature", amount: 4 }),
  cardBuilders.effectsCard("wishing-well", [
    {
      kind: "chance",
      probability: 0.5,
      successEffects: [{ kind: "wish", amount: 1 }],
      failureEffects: [{ kind: "gain-gold", amount: 1 }],
    },
  ]),
  cardBuilders.effectsCard("hemorrhage", [{ kind: "damage", damageType: "bleed", amount: 2, detonateAllBleed: true }]),
  cardBuilders.effectsCard(
    "phoenix-feather",
    [
      { kind: "damage", damageType: "burn", amount: 1 },
      { kind: "player-status", status: "phoenixFeather", amount: 1 },
    ],
    { consume: true },
  ),
  cardBuilders.playerStatusCard({ id: "plate-mail", status: "armor", amount: 2 }),
  cardBuilders.effectsCard("sanctified-plate", [
    { kind: "player-status", status: "armor", amount: 1 },
    { kind: "damage", damageType: "holy", amount: 2 },
  ]),
  cardBuilders.effectsCard(
    "shield-bash",
    [
      { kind: "player-status", status: "block", amount: 2 },
      { kind: "damage", damageType: "stun", amount: 0, equalToBlock: true, equalToBlockPercent: 50, spendBlock: true },
    ],
    { definitionVersion: SHIELD_BASH_SPEND_VERSION },
  ),
  cardBuilders.effectsCard(
    "steal",
    [
      { kind: "damage", damageType: "stun", amount: 2 },
      { kind: "gain-gold", amount: 1 },
    ],
    {
      describe: () => [
        {
          parts: ["Deal ", cardMagnitude({ effectIndex: 0, kind: "damage", field: "amount" }), " Stun damage"],
          role: "effect",
        },
        {
          parts: ["Steal ", cardMagnitude({ effectIndex: 1, kind: "gain-gold", field: "amount" }), " Gold"],
          role: "effect",
        },
      ],
    },
  ),
  cardBuilders.effectsCard("burning-blade", [{ kind: "damage", damageType: "burn", amount: 1, forgeBonusPercent: 50 }]),
  cardBuilders.effectsCard("cauterize", [
    { kind: "remove-harmful-status", amount: 1 },
    { kind: "damage", damageType: "burn", amount: 1 },
  ]),
  cardBuilders.effectsCard(
    "blackjack",
    [
      { kind: "damage", damageType: "stun", amount: 2 },
      { kind: "gain-gold", amount: 2, ifEnemyStunned: true },
    ],
    {
      describe: () => [
        {
          parts: ["Deal ", cardMagnitude({ effectIndex: 0, kind: "damage", field: "amount" }), " Stun damage"],
          role: "effect",
        },
        {
          parts: [
            "Steal ",
            cardMagnitude({ effectIndex: 1, kind: "gain-gold", field: "amount" }),
            " Gold if the enemy is Stunned",
          ],
          role: "effect",
        },
      ],
    },
  ),
  cardBuilders.effectsCard("sunburst", [
    { kind: "heal", amount: 2 },
    { kind: "damage", damageType: "burn", amount: 1 },
  ]),
  cardBuilders.effectsCard("holy-radiance", [
    { kind: "heal", amount: 2 },
    { kind: "damage", damageType: "holy", amount: 2 },
  ]),
  cardBuilders.damageCard({
    id: "venom-fangs",
    damageType: "poison",
    amount: 1,
    lifesteal: true,
  }),
  cardBuilders.damageCard({
    id: "bloodthorn",
    damageType: "nature",
    amount: 2,
    lifesteal: true,
  }),
  cardBuilders.effectsCard("cinderbloom", [
    { kind: "damage", damageType: "burn", damageTypePool: ["burn", "nature"], amount: 2 },
  ]),
  cardBuilders.effectsCard("grasping-vines", [
    { kind: "damage", damageType: "stun", damageTypePool: ["stun", "nature"], amount: 3 },
  ]),
  cardBuilders.effectsCard("briar-shield", [
    { kind: "player-status", status: "block", amount: 2 },
    { kind: "player-status", status: "thorns", amount: 4 },
  ]),
  cardBuilders.effectsCard("thorn-mail", [
    { kind: "player-status", status: "armor", amount: 1 },
    { kind: "player-status", status: "thorns", amount: 2 },
  ]),
  cardBuilders.effectsCard("thorn-whip", [
    { kind: "damage", damageType: "nature", amount: 3 },
    { kind: "player-status", status: "thorns", amount: 1 },
  ]),
  cardBuilders.effectsCard("porcupine-quill", [
    { kind: "player-status", status: "thorns", amount: 2 },
    { kind: "companion-action", amount: 1 },
  ]),
  cardBuilders.effectsCard("pack-tactics", [
    { kind: "companion-action", amount: 2 },
    { kind: "wish", amount: 1, companionIfAbsent: true },
    { kind: "player-status", status: "block", amount: 3 },
  ]),
  cardBuilders.effectsCard("serrated-edge", [
    { kind: "damage", damageType: "physical", damageTypePool: ["physical", "bleed"], amount: 2 },
  ]),
  cardBuilders.effectsCard("caustic-jab", [
    { kind: "remove-enemy-armor", amount: 2 },
    { kind: "damage", damageType: "poison", amount: 2 },
  ]),
  cardBuilders.effectsCard("rend", [{ kind: "damage", damageType: "bleed", amount: 1, doubleIfEnemyBleeding: true }]),
  cardBuilders.effectsCard("pounce", [
    { kind: "damage", damageType: "physical", damageTypePool: ["physical", "stun"], amount: 2 },
  ]),
  cardBuilders.effectsCard("earthquake", [
    { kind: "damage", damageType: "stun", amount: 2 },
    {
      kind: "repeat-over-turns",
      remainingTurns: 1,
      effects: [{ kind: "damage", damageType: "stun", amount: 2 }],
    },
  ]),
  cardBuilders.effectsCard("stargaze", [
    { kind: "damage", damageType: "freeze", amount: 1 },
    { kind: "wish", amount: 1 },
  ]),
  cardBuilders.effectsCard("pixie-dust", [
    { kind: "damage", damageType: "burn", amount: 1 },
    { kind: "restore-mana", amount: 1 },
  ]),
  cardBuilders.effectsCard("maul", [
    { kind: "damage", damageType: "bleed", damageTypePool: ["bleed", "stun"], amount: 3 },
  ]),
  cardBuilders.effectsCard(
    "sniff-out",
    [{ kind: "damage", damageType: "bleed", amount: 1 }, { kind: "next-archery-free" }],
    { tags: ["archery"] },
  ),
  cardBuilders.effectsCard(
    "predators-focus",
    [{ kind: "damage", damageType: "bleed", amount: 1 }, { kind: "next-hit-leech" }],
    { title: "Predator's Focus" },
  ),
  cardBuilders.effectsCard("blizzard", [
    { kind: "damage", damageType: "freeze", amount: 2 },
    {
      kind: "repeat-over-turns",
      remainingTurns: 1,
      effects: [{ kind: "damage", damageType: "freeze", amount: 2 }],
    },
  ]),
  cardBuilders.effectsCard(
    "avatar",
    [
      { kind: "damage", damageType: "holy", amount: 5 },
      { kind: "player-status", status: "block", statusPool: ["block", "forge", "armor"], amount: 5, forgeAmount: 2 },
    ],
    { consume: true },
  ),
  cardBuilders.effectsCard("combustion", [{ kind: "damage", damageType: "burn", amount: 1, detonateAllBurn: true }]),
  cardBuilders.effectsCard("bellows-blast", [
    { kind: "player-status", status: "forge", amount: 1 },
    { kind: "damage", damageType: "burn", amount: 1 },
  ]),
  cardBuilders.effectsCard("quench", [
    { kind: "remove-harmful-status", amount: 1 },
    { kind: "player-status", status: "forge", amount: 1 },
  ]),
];

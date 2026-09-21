import type { BattleCard } from "../../types";
import { CONSUME_DESCRIPTION_LINE } from "@/lib/game-constants";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const coreCards: BattleCard[] = [
  cardBuilders.damageCard({ id: "slash", art: assetRefs.slash, damageType: "physical", amount: 4 }),
  cardBuilders.effectsCard({
    id: "stab",
    art: assetRefs.stab,
    effects: [{ kind: "damage", damageType: "physical", amount: 3, ignoreArmor: true, ignoreBlock: true }],
    descriptionLines: ["Deal 3 Physical damage", "Ignores Armor and Block"],
  }),
  cardBuilders.effectsCard({
    id: "cleanse",
    art: assetRefs.cleanse,
    effects: [
      { kind: "remove-harmful-status", amount: 1 },
      { kind: "heal", amount: 2 },
    ],
    descriptionLines: ["Cleanse a harmful status effect", "Restore 2 Health"],
  }),
  cardBuilders.effectsCard({ id: "heal", art: assetRefs.heal, effects: [{ kind: "heal", amount: 4 }] }),
  cardBuilders.effectsCard({
    id: "haste",
    art: assetRefs.haste,
    effects: [{ kind: "player-status", status: "haste", amount: 1 }],
    descriptionLines: ["Take an extra turn after this one"],
    consume: true,
  }),
  cardBuilders.effectsCard({
    id: "poison-dagger",
    art: assetRefs.poisonDagger,
    effects: [{ kind: "damage", damageType: "poison", amount: 1 }, { kind: "next-hit-poison" }],
    descriptionLines: ["Deal 1 Poison damage", "Your next attack deals Poison"],
  }),
  cardBuilders.damageCard({ id: "fireball", art: assetRefs.fireball, damageType: "burn", amount: 2 }),
  cardBuilders.effectsCard({
    id: "fangs",
    art: assetRefs.fangs,
    effects: [
      { kind: "damage", damageType: "bleed", damageTypePool: ["bleed", "physical"], amount: 2, lifesteal: true },
    ],
    descriptionLines: ["Deal 2 Bleed or Physical damage", "Leech"],
  }),
  cardBuilders.damageCard({ id: "frostbolt", art: assetRefs.frostbolt, damageType: "freeze", amount: 3 }),
  cardBuilders.playerStatusCard({ id: "anvil", art: assetRefs.anvil, status: "forge", amount: 2 }),
  cardBuilders.damageCard({ id: "bash", art: assetRefs.bash, damageType: "stun", amount: 3 }),
  cardBuilders.playerStatusCard({ id: "block", art: assetRefs.block, status: "block", amount: 5 }),
  cardBuilders.effectsCard({
    id: "blessed-aegis",
    art: assetRefs.blessedAegis,
    effects: [
      { kind: "player-status", status: "block", amount: 2 },
      { kind: "damage", damageType: "holy", amount: 0, equalToBlock: true, equalToBlockPercent: 50 },
    ],
    descriptionLines: ["Gain 2 Block", "Deal Holy damage equal to half your Block"],
  }),
  cardBuilders.effectsCard({ id: "wish", art: assetRefs.wish, effects: [{ kind: "wish", amount: 1 }] }),
  cardBuilders.effectsCard({
    id: "meteor",
    art: assetRefs.meteor,
    consume: true,
    effects: [
      { kind: "damage", damageType: "burn", amount: 7 },
      { kind: "lose-max-mana", amount: 1 },
    ],
  }),
  {
    id: "mixed-potion",
    title: "Mixed Potion",
    descriptionLines: ["Mixed at an Alchemist's Shop", CONSUME_DESCRIPTION_LINE],
    art: assetRefs.mixedPotion,
    cost: 1,
    consume: true,
    effects: [],
    excludeFromOfferPool: true,
  },
  cardBuilders.effectsCard({
    id: "ray-of-frost",
    title: "Ray of Frost",
    art: assetRefs.rayOfFrost,
    effects: [
      { kind: "damage", damageType: "freeze", amount: 1 },
      { kind: "damage", damageType: "freeze", amount: 1 },
    ],
    descriptionLines: ["Deal 1 Freeze damage twice"],
  }),
  cardBuilders.effectsCard({
    id: "tithe",
    art: assetRefs.tithe,
    effects: [
      { kind: "damage", damageType: "holy", amount: 1 },
      { kind: "gain-gold", amount: 1 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "exorcism",
    art: assetRefs.exorcism,
    effects: [
      { kind: "self-damage", damageType: "burn", amount: 1 },
      { kind: "cleanse-player-status-to-damage", status: "burn", damageType: "holy" },
    ],
    descriptionLines: [
      "Receive 1 Burn damage",
      "Cleanse all Burn on yourself",
      "Deal Holy damage equal to Burn removed",
    ],
  }),
  cardBuilders.effectsCard({
    id: "kindling",
    art: assetRefs.kindling,
    effects: [{ kind: "damage", damageType: "burn", amount: 2, doubleIfEnemyNotBurning: true }],
    descriptionLines: ["Deal 2 Burn damage", "Doubled if enemy was not Burning"],
  }),
  cardBuilders.effectsCard({
    id: "roll-the-dice",
    title: "Roll the Dice",
    art: assetRefs.rollTheDice,
    consume: true,
    effects: [{ kind: "random-draw", minAmount: 1, maxAmount: 6 }],
    descriptionLines: ["Roll a six-sided die", "Draw that many cards"],
  }),
  cardBuilders.damageCard({ id: "lightning-bolt", art: assetRefs.lightningBolt, damageType: "nature", amount: 4 }),
  cardBuilders.effectsCard({
    id: "wishing-well",
    art: assetRefs.wishingWell,
    effects: [
      {
        kind: "chance",
        probability: 0.5,
        successEffects: [{ kind: "wish", amount: 1 }],
        failureEffects: [{ kind: "gain-gold", amount: 1 }],
      },
    ],
    descriptionLines: ["Gain 1 Gold or Wish"],
  }),
  cardBuilders.effectsCard({
    id: "hemorrhage",
    art: assetRefs.hemorrhage,
    effects: [{ kind: "damage", damageType: "bleed", amount: 1, detonateAllBleed: true }],
    descriptionLines: ["Deal 1 Bleed damage", "Detonate all Bleed"],
  }),
  cardBuilders.effectsCard({
    id: "phoenix-feather",
    art: assetRefs.phoenixFeather,
    consume: true,
    effects: [
      { kind: "damage", damageType: "burn", amount: 1 },
      { kind: "player-status", status: "phoenixFeather", amount: 1 },
    ],
    descriptionLines: ["Deal 1 Burn damage", "Upon death, revive with 30% Health"],
  }),
  cardBuilders.playerStatusCard({ id: "plate-mail", art: assetRefs.plateMail, status: "armor", amount: 2 }),
  cardBuilders.effectsCard({
    id: "sanctified-plate",
    art: assetRefs.sanctifiedPlate,
    effects: [
      { kind: "player-status", status: "armor", amount: 1 },
      { kind: "damage", damageType: "holy", amount: 0, equalToArmor: true },
    ],
    descriptionLines: ["Gain 1 Armor", "Deal Holy damage equal to your Armor"],
  }),
  cardBuilders.effectsCard({
    id: "shield-bash",
    art: assetRefs.shieldBash,
    effects: [
      { kind: "player-status", status: "block", amount: 2 },
      { kind: "damage", damageType: "stun", amount: 0, equalToBlock: true, equalToBlockPercent: 50 },
    ],
    descriptionLines: ["Gain 2 Block", "Deal Stun damage equal to half your Block"],
  }),
  cardBuilders.effectsCard({
    id: "steal",
    art: assetRefs.steal,
    effects: [
      { kind: "damage", damageType: "stun", amount: 1 },
      { kind: "gain-gold", amount: 1 },
    ],
    descriptionLines: ["Deal 1 Stun damage", "Steal 1 Gold"],
  }),
  cardBuilders.effectsCard({
    id: "burning-blade",
    art: assetRefs.burningBlade,
    effects: [
      { kind: "player-status", status: "forge", amount: 1 },
      { kind: "damage", damageType: "burn", amount: 0, equalToForge: true },
    ],
    descriptionLines: ["Gain 1 Forge", "Deal Burn damage equal to your Forge"],
  }),
  cardBuilders.effectsCard({
    id: "cauterize",
    art: assetRefs.cauterize,
    effects: [
      { kind: "remove-harmful-status", amount: 1 },
      { kind: "damage", damageType: "burn", amount: 1 },
      { kind: "self-damage", damageType: "burn", amount: 1 },
    ],
    descriptionLines: ["Cleanse a harmful status effect", "Deal and Receive 1 Burn damage"],
  }),
  cardBuilders.effectsCard({
    id: "blackjack",
    art: assetRefs.blackjack,
    effects: [
      { kind: "damage", damageType: "stun", amount: 2 },
      { kind: "gain-gold", amount: 2, ifEnemyStunned: true },
    ],
    descriptionLines: ["Deal 2 Stun damage", "Gain 2 Gold if the enemy is Stunned"],
  }),
  cardBuilders.effectsCard({
    id: "sunburst",
    art: assetRefs.sunburst,
    effects: [
      { kind: "heal", amount: 2 },
      { kind: "damage", damageType: "burn", amount: 1 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "holy-radiance",
    art: assetRefs.holyRadiance,
    effects: [
      { kind: "heal", amount: 2 },
      { kind: "damage", damageType: "holy", amount: 2 },
    ],
  }),
  cardBuilders.damageCard({
    id: "venom-fangs",
    art: assetRefs.venomFangs,
    damageType: "poison",
    amount: 1,
    lifesteal: true,
  }),
  cardBuilders.damageCard({
    id: "bloodthorn",
    art: assetRefs.bloodthorn,
    damageType: "nature",
    amount: 3,
    lifesteal: true,
  }),
  cardBuilders.effectsCard({
    id: "cinderbloom",
    art: assetRefs.cinderbloom,
    effects: [{ kind: "damage", damageType: "burn", damageTypePool: ["burn", "nature"], amount: 2 }],
    descriptionLines: ["Deal 2 Burn or Nature damage"],
  }),
  cardBuilders.effectsCard({
    id: "grasping-vines",
    art: assetRefs.graspingVines,
    effects: [{ kind: "damage", damageType: "stun", damageTypePool: ["stun", "nature"], amount: 3 }],
    descriptionLines: ["Deal 3 Stun or Nature damage"],
  }),
  cardBuilders.effectsCard({
    id: "briar-shield",
    art: assetRefs.briarShield,
    effects: [
      { kind: "player-status", status: "block", amount: 1 },
      { kind: "player-status", status: "thorns", amount: 3 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "thorn-mail",
    art: assetRefs.thornMail,
    effects: [
      { kind: "player-status", status: "armor", amount: 1 },
      { kind: "player-status", status: "thorns", amount: 2 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "pack-tactics",
    art: assetRefs.packTactics,
    effects: [{ kind: "companion-action", amount: 2 }],
    descriptionLines: ["Your Companion acts twice"],
  }),
  cardBuilders.effectsCard({
    id: "serrated-edge",
    art: assetRefs.serratedEdge,
    effects: [{ kind: "damage", damageType: "physical", damageTypePool: ["physical", "bleed"], amount: 2 }],
    descriptionLines: ["Deal 2 Physical or Bleed damage"],
  }),
  cardBuilders.effectsCard({
    id: "caustic-jab",
    art: assetRefs.causticJab,
    effects: [
      { kind: "remove-enemy-armor", amount: 2 },
      { kind: "damage", damageType: "poison", amount: 2 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "rend",
    art: assetRefs.rend,
    effects: [{ kind: "damage", damageType: "bleed", amount: 1, doubleIfEnemyBleeding: true }],
    descriptionLines: ["Deal 1 Bleed damage", "Doubled if the enemy was already Bleeding"],
  }),
  cardBuilders.effectsCard({
    id: "pounce",
    art: assetRefs.pounce,
    effects: [{ kind: "damage", damageType: "physical", damageTypePool: ["physical", "stun"], amount: 2 }],
    descriptionLines: ["Deal 2 Physical or Stun damage"],
  }),
  cardBuilders.effectsCard({
    id: "earthquake",
    art: assetRefs.earthquake,
    effects: [
      { kind: "damage", damageType: "stun", amount: 2 },
      {
        kind: "repeat-over-turns",
        remainingTurns: 1,
        effects: [{ kind: "damage", damageType: "stun", amount: 2 }],
      },
    ],
    descriptionLines: ["Deal 2 Stun damage this turn and next"],
  }),
  cardBuilders.effectsCard({
    id: "stargaze",
    art: assetRefs.stargaze,
    effects: [
      { kind: "damage", damageType: "freeze", amount: 1 },
      { kind: "wish", amount: 1 },
    ],
    descriptionLines: ["Deal 1 Freeze damage", "Wish 1"],
  }),
  cardBuilders.effectsCard({
    id: "pixie-dust",
    art: assetRefs.pixieDust,
    effects: [
      { kind: "damage", damageType: "burn", amount: 1 },
      { kind: "restore-mana", amount: 1 },
    ],
  }),
  cardBuilders.effectsCard({
    id: "maul",
    art: assetRefs.maul,
    effects: [{ kind: "damage", damageType: "bleed", damageTypePool: ["bleed", "stun"], amount: 3 }],
    descriptionLines: ["Deal 3 Bleed or Stun damage"],
  }),
  cardBuilders.effectsCard({
    id: "sniff-out",
    art: assetRefs.sniffOut,
    effects: [{ kind: "damage", damageType: "bleed", amount: 1 }, { kind: "next-archery-free" }],
    descriptionLines: ["Deal 1 Bleed damage", "Your next Archery card is free"],
  }),
  cardBuilders.effectsCard({
    id: "predators-focus",
    title: "Predator's Focus",
    art: assetRefs.predatorsFocus,
    effects: [{ kind: "damage", damageType: "bleed", amount: 1 }, { kind: "next-hit-leech" }],
    descriptionLines: ["Deal 1 Bleed damage", "Your next attack has Leech"],
  }),
  cardBuilders.effectsCard({
    id: "blizzard",
    art: assetRefs.blizzard,
    effects: [
      { kind: "damage", damageType: "freeze", amount: 2 },
      {
        kind: "repeat-over-turns",
        remainingTurns: 1,
        effects: [{ kind: "damage", damageType: "freeze", amount: 2 }],
      },
    ],
    descriptionLines: ["Deal 2 Freeze damage this turn and next"],
  }),
  cardBuilders.effectsCard({
    id: "avatar",
    art: assetRefs.avatar,
    consume: true,
    effects: [
      { kind: "damage", damageType: "holy", amount: 5 },
      { kind: "player-status", status: "block", statusPool: ["block", "forge", "armor"], amount: 5 },
    ],
    descriptionLines: ["Deal 5 Holy damage", "Gain 5 Block, Forge, or Armor"],
  }),
  cardBuilders.effectsCard({
    id: "combustion",
    art: assetRefs.combustion,
    effects: [{ kind: "damage", damageType: "burn", amount: 1, detonateAllBurn: true }],
    descriptionLines: ["Deal 1 Burn damage", "Detonate all Burn"],
  }),
];

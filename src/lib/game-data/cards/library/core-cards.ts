// Ordered card definitions split from the public card library.
import type { BattleCard } from "../../types";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const coreCards = [
  cardBuilders.damageCard({ id: "slash", art: assetRefs.slash, damageType: "physical", amount: 6 }),
  cardBuilders.damageCard({ id: "stab", art: assetRefs.stab, damageType: "bleed", amount: 2 }),
  cardBuilders.singleEffectCard({
    id: "cleanse",
    art: assetRefs.cleanse,
    effect: { kind: "remove-harmful-status", amount: 1 },
    descriptionLine: "Cleanse 1 harmful status effect",
  }),
  cardBuilders.singleEffectCard({ id: "heal", art: assetRefs.heal, effect: { kind: "heal", amount: 4 } }),
  {
    id: "haste",
    title: "Haste",
    descriptionLines: ["Take an extra turn after this one", "Consume"],
    art: assetRefs.haste,
    cost: 1,
    consume: true,
    effects: [{ kind: "player-status", status: "haste", amount: 1 }],
  },
  cardBuilders.damageCard({ id: "poison-dagger", art: assetRefs.poisonDagger, damageType: "poison", amount: 2 }),
  cardBuilders.damageCard({ id: "fireball", art: assetRefs.fireball, damageType: "burn", amount: 3 }),
  cardBuilders.damageCard({ id: "fangs", art: assetRefs.fangs, damageType: "physical", amount: 3, lifesteal: true }),
  cardBuilders.damageCard({ id: "frostbolt", art: assetRefs.frostbolt, damageType: "freeze", amount: 3 }),
  cardBuilders.consumableCard({
    id: "health-potion",
    art: assetRefs.healthPotion,
    effect: { kind: "heal", amount: 8 },
  }),
  cardBuilders.consumableCard({
    id: "mana-berries",
    art: assetRefs.manaBerries,
    effect: { kind: "restore-mana", amount: 2 },
  }),
  cardBuilders.consumableCard({
    id: "mana-crystals",
    art: assetRefs.manaCrystal,
    effect: { kind: "gain-max-mana", amount: 1 },
  }),
  cardBuilders.consumableCard({
    id: "mana-potion",
    art: assetRefs.manaPotion,
    effect: { kind: "restore-mana", amount: 2 },
  }),
  cardBuilders.consumableCard({
    id: "panacea-potion",
    art: assetRefs.panaceaPotion,
    effect: { kind: "remove-harmful-status", amount: 1 },
  }),
  cardBuilders.consumableCard({
    id: "stoneskin-potion",
    art: assetRefs.stoneskinPotion,
    effect: { kind: "player-status", status: "armor", amount: 2 },
  }),
  cardBuilders.consumableCard({
    id: "acid-potion",
    art: assetRefs.acidPotion,
    effect: { kind: "damage", damageType: "poison", amount: 3 },
  }),
  cardBuilders.playerStatusCard({ id: "anvil", art: assetRefs.anvil, status: "forge", amount: 1 }),
  cardBuilders.consumableCard({ id: "apple", art: assetRefs.apple, effect: { kind: "heal", amount: 5 } }),
  cardBuilders.damageCard({ id: "bash", art: assetRefs.bash, damageType: "stun", amount: 3 }),
  cardBuilders.playerStatusCard({ id: "block", art: assetRefs.block, status: "block", amount: 5 }),
  cardBuilders.consumableCard({ id: "bread", art: assetRefs.bread, effect: { kind: "heal", amount: 5 } }),
  cardBuilders.playerStatThenScaledDamageCard({
    id: "blessed-aegis",
    art: assetRefs.blessedAegis,
    damageType: "holy",
    scaleFrom: "block",
  }),
  cardBuilders.consumableCard({
    id: "luck-potion",
    art: assetRefs.luckPotion,
    effect: { kind: "gain-gold", amount: 7 },
  }),
  cardBuilders.singleEffectCard({ id: "wish", art: assetRefs.wish, effect: { kind: "wish", amount: 1 } }),
  cardBuilders.consumableCard({
    id: "wishing-potion",
    art: assetRefs.wishingPotion,
    effect: { kind: "wish", amount: 1 },
  }),
  {
    id: "meteor",
    title: "Meteor",
    descriptionLines: ["Deal 7 Burn damage", "Lose 1 Mana Crystal", "Consume"],
    art: assetRefs.meteor,
    cost: 1,
    consume: true,
    effects: [
      { kind: "damage", damageType: "burn", amount: 7 },
      { kind: "lose-max-mana", amount: 1 },
    ],
  },
  {
    id: "mixed-potion",
    title: "Mixed Potion",
    descriptionLines: ["Mixed at an Alchemist's Shop", "Consume"],
    art: assetRefs.mixedPotion,
    cost: 1,
    consume: true,
    effects: [],
    excludeFromOfferPool: true,
  },
  cardBuilders.summonCompanionCard({ id: "wolf-companion", art: assetRefs.wolfCompanion, companionId: "wolf" }),
  cardBuilders.summonCompanionCard({
    id: "lizard-scout-companion",
    art: assetRefs.lizardScoutCompanion,
    companionId: "lizard-scout",
  }),
  cardBuilders.archeryDamageCard({
    id: "fire-arrow",
    art: assetRefs.fireArrow,
    damageType: "burn",
    amount: 2,
  }),
  cardBuilders.archeryDamageCard({
    id: "ice-shot",
    art: assetRefs.iceShot,
    damageType: "freeze",
    amount: 2,
  }),
  cardBuilders.archeryDamageCard({
    id: "venom-arrow",
    art: assetRefs.venomArrow,
    damageType: "poison",
    amount: 2,
  }),
  cardBuilders.archeryDamageCard({
    id: "serrated-arrowhead",
    art: assetRefs.serratedArrowhead,
    damageType: "bleed",
    amount: 2,
  }),
] satisfies BattleCard[];

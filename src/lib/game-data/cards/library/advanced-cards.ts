// Ordered card definitions split from the public card library.
import type { BattleCard } from "../../types";
import * as assetRefs from "../../assets";
import * as cardBuilders from "../card-builders";

export const advancedCards = [
  cardBuilders.dualDamageCard({
    id: "smite",
    art: assetRefs.smite,
    hits: [
      { damageType: "holy", amount: 2 },
      { damageType: "burn", amount: 2 },
    ],
  }),
  cardBuilders.cleansePlayerStatusCard({
    id: "antivenom-potion",
    art: assetRefs.antivenomPotion,
    status: "poison",
    cleanseLine: "Cleanse all Poison",
    consume: true,
  }),
  cardBuilders.damageThenMultiplyEnemyStatusCard({
    id: "cold-snap",
    art: assetRefs.coldSnap,
    damageType: "freeze",
    damageAmount: 1,
    status: "freeze",
    factor: 2,
    multiplyLine: "Double enemy's Freeze build-up",
  }),
  cardBuilders.loseHealthBenefitCard({ id: "blood-offering", art: assetRefs.bloodOffering, healthLoss: 1, draw: 2 }),
  {
    id: "sunder",
    title: "Sunder",
    descriptionLines: ["Deal 4 Physical damage", "Strip 2 enemy Armor"],
    art: assetRefs.sunder,
    cost: 1,
    effects: [
      { kind: "damage", damageType: "physical", amount: 4 },
      { kind: "remove-enemy-armor", amount: 2 },
    ],
  },
  {
    id: "mana-shield",
    title: "Mana Shield",
    descriptionLines: ["Convert each of your Mana into 5 Block"],
    art: assetRefs.manaShield,
    cost: 1,
    effects: [{ kind: "player-status", status: "block", amount: 0, convertCurrentMana: 5 }],
  },
  {
    id: "prayer",
    title: "Prayer",
    descriptionLines: ["Wish 1", "Restore 3 Health"],
    art: assetRefs.prayer,
    cost: 1,
    effects: [
      { kind: "wish", amount: 1 },
      { kind: "heal", amount: 3 },
    ],
  },
  cardBuilders.loseHealthBenefitCard({
    id: "faustian-bargain",
    art: assetRefs.faustianBargain,
    healthLoss: 2,
    wish: 2,
    consume: true,
  }),
  cardBuilders.dualDamageCard({
    id: "judgment",
    art: assetRefs.judgment,
    hits: [
      { damageType: "holy", amount: 3 },
      { damageType: "stun", amount: 1 },
    ],
  }),
  cardBuilders.cleansePlayerStatusCard({
    id: "smelling-salts",
    art: assetRefs.smellingSalts,
    status: "stun",
    cleanseLine: "Cleanse Stun build-up",
  }),
  cardBuilders.loseHealthBenefitCard({
    id: "dark-pact",
    art: assetRefs.darkPact,
    healthLoss: 1,
    wish: 1,
    draw: 1,
  }),
  cardBuilders.summonCompanionCard({
    id: "skeleton-companion",
    title: "Risen Skeleton",
    art: assetRefs.risenSkeletonCompanion,
    companionId: "skeleton",
  }),
  cardBuilders.summonCompanionCard({ id: "pixie-companion", art: assetRefs.pixieCompanion, companionId: "pixie" }),
  cardBuilders.summonCompanionCard({
    id: "mana-moth-companion",
    art: assetRefs.manaMothCompanion,
    companionId: "mana-moth",
  }),
  cardBuilders.summonCompanionCard({
    id: "will-o-wisp-companion",
    title: "Will-o'-Wisp",
    art: assetRefs.willOWispCompanion,
    companionId: "will-o-wisp",
  }),
  cardBuilders.summonCompanionCard({
    id: "golden-retriever-companion",
    art: assetRefs.goldenRetrieverCompanion,
    companionId: "golden-retriever",
  }),
  cardBuilders.summonCompanionCard({
    id: "shield-scarab-companion",
    art: assetRefs.shieldScarabCompanion,
    companionId: "shield-scarab",
  }),
  cardBuilders.summonCompanionCard({
    id: "library-owl-companion",
    art: assetRefs.libraryOwlCompanion,
    companionId: "library-owl",
  }),
  cardBuilders.summonCompanionCard({
    id: "fox-companion",
    art: assetRefs.foxCompanion,
    companionId: "fox",
  }),
  {
    id: "molten-bulwark",
    title: "Molten Bulwark",
    descriptionLines: ["Gain 3 Block", "Deal 1 Burn damage"],
    art: assetRefs.moltenBulwark,
    cost: 1,
    effects: [
      { kind: "player-status", status: "block", amount: 3 },
      { kind: "damage", damageType: "burn", amount: 1 },
    ],
  },
  {
    id: "glacial-ward",
    title: "Glacial Ward",
    descriptionLines: ["Gain 3 Block", "Deal 1 Freeze damage"],
    art: assetRefs.glacialWard,
    cost: 1,
    effects: [
      { kind: "player-status", status: "block", amount: 3 },
      { kind: "damage", damageType: "freeze", amount: 1 },
    ],
  },
  {
    id: "spiked-shield",
    title: "Spiked Shield",
    descriptionLines: ["Gain 2 Armor", "Deal 1 Bleed damage"],
    art: assetRefs.spikedShield,
    cost: 1,
    effects: [
      { kind: "player-status", status: "armor", amount: 2 },
      { kind: "damage", damageType: "bleed", amount: 1 },
    ],
  },
  {
    id: "golden-plate",
    title: "Golden Plate",
    descriptionLines: ["Gain 1 Armor", "Gain 2 Gold"],
    art: assetRefs.goldenPlate,
    cost: 1,
    effects: [
      { kind: "player-status", status: "armor", amount: 1 },
      { kind: "gain-gold", amount: 2 },
    ],
  },
  {
    id: "crystal-bulwark",
    title: "Crystal Bulwark",
    descriptionLines: ["Gain 1 Block per Mana Crystal"],
    art: assetRefs.crystalBulwark,
    cost: 1,
    effects: [{ kind: "player-status", status: "block", amount: 0, perManaCrystal: 1 }],
  },
  {
    id: "combustion",
    title: "Combustion",
    descriptionLines: ["Deal 2 Burn damage", "Doubled if the enemy was already Burning"],
    art: assetRefs.combustion,
    cost: 1,
    effects: [{ kind: "damage", damageType: "burn", amount: 2, doubleIfEnemyBurning: true }],
  },
] satisfies BattleCard[];

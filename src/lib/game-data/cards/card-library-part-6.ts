import type { BattleCard } from "../types";
import {
  crystalBulwark,
  glacialWard,
  goldenPlate,
  goldenRetrieverCompanion,
  libraryOwlCompanion,
  manaMothCompanion,
  moltenBulwark,
  pixieCompanion,
  shieldScarabCompanion,
  spikedShield,
  willOWispCompanion,
} from "../assets";
import { summonCompanionCard } from "./card-builders";

export const cardLibraryPart6: BattleCard[] = [
  summonCompanionCard({ id: "pixie-companion", art: pixieCompanion, companionId: "pixie" }),
  summonCompanionCard({
    id: "mana-moth-companion",
    art: manaMothCompanion,
    companionId: "mana-moth",
  }),
  summonCompanionCard({
    id: "will-o-wisp-companion",
    title: "Will-o'-Wisp",
    art: willOWispCompanion,
    companionId: "will-o-wisp",
  }),
  summonCompanionCard({
    id: "golden-retriever-companion",
    art: goldenRetrieverCompanion,
    companionId: "golden-retriever",
  }),
  summonCompanionCard({
    id: "shield-scarab-companion",
    art: shieldScarabCompanion,
    companionId: "shield-scarab",
  }),
  summonCompanionCard({
    id: "library-owl-companion",
    art: libraryOwlCompanion,
    companionId: "library-owl",
  }),
  {
    id: "molten-bulwark",
    title: "Molten Bulwark",
    descriptionLines: ["Gain 3 Block", "Deal 1 Burn damage"],
    art: moltenBulwark,
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
    art: glacialWard,
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
    art: spikedShield,
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
    art: goldenPlate,
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
    art: crystalBulwark,
    cost: 1,
    effects: [{ kind: "player-status", status: "block", amount: 0, perManaCrystal: 1 }],
  },
];

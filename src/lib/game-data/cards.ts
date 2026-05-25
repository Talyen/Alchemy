// Card library — every playable BattleCard in the game, authored as data.
// Depends on art assets and card type shapes. Each card is an effect pipeline; no logic.
import {
  acidPotion,
  antivenomPotion,
  anvil,
  apple,
  bash,
  blackjack,
  blessedAegis,
  block,
  bloodOffering,
  bloodthorn,
  bread,
  briarShield,
  burningBlade,
  cauterize,
  cinderbloom,
  cleanse,
  coldSnap,
  fangs,
  faustianBargain,
  fireball,
  frostbolt,
  graspingVines,
  haste,
  heal,
  healthPotion,
  holyRadiance,
  impCompanion,
  judgment,
  lizardScoutCompanion,
  luckPotion,
  manaBerries,
  manaCrystal,
  manaPotion,
  manaShield,
  meteor,
  packTactics,
  panaceaPotion,
  mixedPotion,
  plateMail,
  poisonDagger,
  prayer,
  serratedEdge,
  shieldBash,
  slash,
  smellingSalts,
  smite,
  stab,
  steal,
  stoneskinPotion,
  sunderArmor,
  sunburst,
  thornMail,
  venomFangs,
  wish,
  wishingPotion,
  wolfCompanion,
  frostWhelpCompanion,
  bearCompanion,
  pantherCompanion,
  phoenixCompanion,
} from "./assets";
import type { BattleCard } from "./types";

export const cardLibrary: BattleCard[] = [
  {
    id: "slash",
    title: "Slash",
    descriptionLines: ["Deal 6 Physical damage"],
    art: slash,
    cost: 1,
    effects: [{ kind: "damage", damageType: "physical", amount: 6 }],
  },
  {
    id: "stab",
    title: "Stab",
    descriptionLines: ["Deal 2 Bleed damage"],
    art: stab,
    cost: 1,
    effects: [{ kind: "damage", damageType: "bleed", amount: 2 }],
  },
  {
    id: "cleanse",
    title: "Cleanse",
    descriptionLines: ["Remove a harmful status effect"],
    art: cleanse,
    cost: 1,
    effects: [{ kind: "remove-harmful-status", amount: 1 }],
  },
  {
    id: "heal",
    title: "Heal",
    descriptionLines: ["Restore 4 Health"],
    art: heal,
    cost: 1,
    effects: [{ kind: "heal", amount: 4 }],
  },
  {
    id: "haste",
    title: "Haste",
    descriptionLines: ["Take an extra turn after this one", "Consume"],
    art: haste,
    cost: 1,
    consume: true,
    effects: [{ kind: "player-status", status: "haste", amount: 1 }],
  },
  {
    id: "poison-dagger",
    title: "Poison Dagger",
    descriptionLines: ["Deal 2 Poison damage"],
    art: poisonDagger,
    cost: 1,
    effects: [{ kind: "damage", damageType: "poison", amount: 2 }],
  },
  {
    id: "fireball",
    title: "Fireball",
    descriptionLines: ["Deal 3 Burn damage"],
    art: fireball,
    cost: 1,
    effects: [{ kind: "damage", damageType: "burn", amount: 3 }],
  },
  {
    id: "fangs",
    title: "Fangs",
    descriptionLines: ["Deal 3 Physical damage", "Leech"],
    art: fangs,
    cost: 1,
    effects: [{ kind: "damage", damageType: "physical", amount: 3, lifesteal: true }],
  },
  {
    id: "frostbolt",
    title: "Frostbolt",
    descriptionLines: ["Deal 3 Freeze damage"],
    art: frostbolt,
    cost: 1,
    effects: [{ kind: "damage", damageType: "freeze", amount: 3 }],
  },
  {
    id: "health-potion",
    title: "Health Potion",
    descriptionLines: ["Restore 8 Health", "Consume"],
    art: healthPotion,
    cost: 1,
    consume: true,
    effects: [{ kind: "heal", amount: 8 }],
  },
  {
    id: "mana-berries",
    title: "Mana Berries",
    descriptionLines: ["Restore 2 Mana", "Consume"],
    art: manaBerries,
    cost: 1,
    consume: true,
    effects: [{ kind: "restore-mana", amount: 2 }],
  },
  {
    id: "mana-crystals",
    title: "Mana Crystals",
    descriptionLines: ["Gain 1 Maximum Mana", "Consume"],
    art: manaCrystal,
    cost: 1,
    consume: true,
    effects: [{ kind: "gain-max-mana", amount: 1 }],
  },
  {
    id: "mana-potion",
    title: "Mana Potion",
    descriptionLines: ["Restore 2 Mana", "Consume"],
    art: manaPotion,
    cost: 1,
    consume: true,
    effects: [{ kind: "restore-mana", amount: 2 }],
  },
  {
    id: "panacea-potion",
    title: "Panacea Potion",
    descriptionLines: ["Remove 1 harmful status effect", "Consume"],
    art: panaceaPotion,
    cost: 1,
    consume: true,
    effects: [{ kind: "remove-harmful-status", amount: 1 }],
  },
  {
    id: "stoneskin-potion",
    title: "Stoneskin Potion",
    descriptionLines: ["Gain 2 Armor", "Consume"],
    art: stoneskinPotion,
    cost: 1,
    consume: true,
    effects: [{ kind: "player-status", status: "armor", amount: 2 }],
  },
  {
    id: "acid-potion",
    title: "Acid Potion",
    descriptionLines: ["Deal 3 Poison", "Consume"],
    art: acidPotion,
    cost: 1,
    consume: true,
    effects: [{ kind: "damage", damageType: "poison", amount: 3 }],
  },
  {
    id: "anvil",
    title: "Anvil",
    descriptionLines: ["Gain 1 Forge"],
    art: anvil,
    cost: 1,
    effects: [{ kind: "player-status", status: "forge", amount: 1 }],
  },
  {
    id: "apple",
    title: "Apple",
    descriptionLines: ["Gain 5 Health", "Consume"],
    art: apple,
    cost: 1,
    consume: true,
    effects: [{ kind: "heal", amount: 5 }],
  },
  {
    id: "bash",
    title: "Bash",
    descriptionLines: ["Deal 3 Stun damage"],
    art: bash,
    cost: 1,
    effects: [{ kind: "damage", damageType: "stun", amount: 3 }],
  },
  {
    id: "block",
    title: "Block",
    descriptionLines: ["Gain 5 Block"],
    art: block,
    cost: 1,
    effects: [{ kind: "player-status", status: "block", amount: 5 }],
  },
  {
    id: "bread",
    title: "Bread",
    descriptionLines: ["Gain 5 Health", "Consume"],
    art: bread,
    cost: 1,
    consume: true,
    effects: [{ kind: "heal", amount: 5 }],
  },
  {
    id: "blessed-aegis",
    title: "Blessed Aegis",
    descriptionLines: ["Deal Holy damage equal to your Block"],
    art: blessedAegis,
    cost: 1,
    effects: [{ kind: "damage", damageType: "holy", amount: 0, equalToBlock: true }],
  },
  {
    id: "luck-potion",
    title: "Luck Potion",
    descriptionLines: ["Gain 7 Gold", "Consume"],
    art: luckPotion,
    cost: 1,
    consume: true,
    effects: [{ kind: "gain-gold", amount: 7 }],
  },
  {
    id: "wish",
    title: "Wish",
    descriptionLines: ["Wish 1"],
    art: wish,
    cost: 1,
    effects: [{ kind: "wish", amount: 1 }],
  },
  {
    id: "wishing-potion",
    title: "Wishing Potion",
    descriptionLines: ["Wish 2", "Consume"],
    art: wishingPotion,
    cost: 1,
    consume: true,
    effects: [{ kind: "wish", amount: 2 }],
  },
  {
    id: "meteor",
    title: "Meteor",
    descriptionLines: ["Deal 7 Burn damage", "Lose 1 Mana Crystal", "Consume"],
    art: meteor,
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
    art: mixedPotion,
    cost: 1,
    consume: true,
    effects: [],
  },
  {
    id: "wolf-companion",
    title: "Wolf",
    descriptionLines: ["Deals 1 Bleed damage each turn", "Companion"],
    art: wolfCompanion,
    cost: 1,
    consume: true,
    effects: [{ kind: "summon-companion", companionId: "wolf" }],
  },
  {
    id: "lizard-scout-companion",
    title: "Lizard Scout",
    descriptionLines: ["Deals 1 Poison damage each turn", "Companion"],
    art: lizardScoutCompanion,
    cost: 1,
    consume: true,
    effects: [{ kind: "summon-companion", companionId: "lizard-scout" }],
  },
  {
    id: "imp-companion",
    title: "Imp",
    descriptionLines: ["Deals 2 Burn damage each turn", "Companion"],
    art: impCompanion,
    cost: 1,
    consume: true,
    effects: [{ kind: "summon-companion", companionId: "imp" }],
  },
  {
    id: "frost-whelp-companion",
    title: "Frost Whelp",
    descriptionLines: ["Deals 2 Freeze damage each turn", "Companion"],
    art: frostWhelpCompanion,
    cost: 1,
    consume: true,
    effects: [{ kind: "summon-companion", companionId: "frost-whelp" }],
  },
  {
    id: "bear-companion",
    title: "Bear",
    descriptionLines: ["Deals 2 Stun damage each turn", "Companion"],
    art: bearCompanion,
    cost: 1,
    consume: true,
    effects: [{ kind: "summon-companion", companionId: "bear" }],
  },
  {
    id: "panther-companion",
    title: "Panther",
    descriptionLines: ["Deals 1 Bleed damage each turn", "Companion"],
    art: pantherCompanion,
    cost: 1,
    consume: true,
    effects: [{ kind: "summon-companion", companionId: "panther" }],
  },
  {
    id: "phoenix-companion",
    title: "Phoenix",
    descriptionLines: ["Deals 2 Burn damage each turn", "Companion"],
    art: phoenixCompanion,
    cost: 1,
    consume: true,
    effects: [{ kind: "summon-companion", companionId: "phoenix" }],
  },
  {
    id: "plate-mail",
    title: "Plate Mail",
    descriptionLines: ["Gain 1 Armor"],
    art: plateMail,
    cost: 1,
    effects: [{ kind: "player-status", status: "armor", amount: 1 }],
  },
  {
    id: "shield-bash",
    title: "Shield Bash",
    descriptionLines: ["Deal 2 Stun damage", "Gain 2 Block"],
    art: shieldBash,
    cost: 1,
    effects: [
      { kind: "damage", damageType: "stun", amount: 2 },
      { kind: "player-status", status: "block", amount: 2 },
    ],
  },
  {
    id: "steal",
    title: "Steal",
    descriptionLines: ["Steal 4 Gold"],
    art: steal,
    cost: 1,
    effects: [{ kind: "gain-gold", amount: 4 }],
  },
  {
    id: "burning-blade",
    title: "Burning Blade",
    descriptionLines: ["Deal 2 Physical damage", "Deal 2 Burn damage"],
    art: burningBlade,
    cost: 1,
    effects: [
      { kind: "damage", damageType: "physical", amount: 2 },
      { kind: "damage", damageType: "burn", amount: 2 },
    ],
  },
  // remove-harmful-status must come before self-damage so the burn cost is not instantly cleansed
  {
    id: "cauterize",
    title: "Cauterize",
    descriptionLines: ["Remove 2 harmful status effects", "Receive 1 Burn damage"],
    art: cauterize,
    cost: 1,
    effects: [
      { kind: "remove-harmful-status", amount: 2 },
      { kind: "self-damage", damageType: "burn", amount: 1 },
    ],
  },
  {
    id: "blackjack",
    title: "Blackjack",
    descriptionLines: ["Deal 2 Stun damage", "Steal 2 Gold"],
    art: blackjack,
    cost: 1,
    effects: [
      { kind: "damage", damageType: "stun", amount: 2 },
      { kind: "gain-gold", amount: 2 },
    ],
  },
  {
    id: "sunburst",
    title: "Sunburst",
    descriptionLines: ["Restore 2 Health", "Deal 2 Burn damage"],
    art: sunburst,
    cost: 1,
    effects: [
      { kind: "heal", amount: 2 },
      { kind: "damage", damageType: "burn", amount: 2 },
    ],
  },
  {
    id: "holy-radiance",
    title: "Holy Radiance",
    descriptionLines: ["Restore 2 Health", "Deal 2 Holy damage"],
    art: holyRadiance,
    cost: 1,
    effects: [
      { kind: "heal", amount: 2 },
      { kind: "damage", damageType: "holy", amount: 2 },
    ],
  },
  {
    id: "venom-fangs",
    title: "Venom Fangs",
    descriptionLines: ["Deal 2 Poison damage", "Leech"],
    art: venomFangs,
    cost: 1,
    effects: [{ kind: "damage", damageType: "poison", amount: 2, lifesteal: true }],
  },
  {
    id: "bloodthorn",
    title: "Bloodthorn",
    descriptionLines: ["Deal 4 Nature damage", "Leech"],
    art: bloodthorn,
    cost: 1,
    effects: [{ kind: "damage", damageType: "nature", amount: 4, lifesteal: true }],
  },
  {
    id: "cinderbloom",
    title: "Cinderbloom",
    descriptionLines: ["Deal 2 Nature damage", "Deal 2 Burn damage"],
    art: cinderbloom,
    cost: 1,
    effects: [
      { kind: "damage", damageType: "nature", amount: 2 },
      { kind: "damage", damageType: "burn", amount: 2 },
    ],
  },
  {
    id: "grasping-vines",
    title: "Grasping Vines",
    descriptionLines: ["Deal 2 Nature damage", "Deal 2 Stun damage"],
    art: graspingVines,
    cost: 1,
    effects: [
      { kind: "damage", damageType: "nature", amount: 2 },
      { kind: "damage", damageType: "stun", amount: 2 },
    ],
  },
  {
    id: "briar-shield",
    title: "Briar Shield",
    descriptionLines: ["Gain 3 Block", "Deal Nature damage equal to your Block"],
    art: briarShield,
    cost: 1,
    effects: [
      { kind: "player-status", status: "block", amount: 3 },
      { kind: "damage", damageType: "nature", amount: 0, equalToBlock: true },
    ],
  },
  {
    id: "thorn-mail",
    title: "Thorn Mail",
    descriptionLines: ["Gain 2 Armor", "Deal Nature damage equal to your Armor"],
    art: thornMail,
    cost: 1,
    effects: [
      { kind: "player-status", status: "armor", amount: 2 },
      { kind: "damage", damageType: "nature", amount: 0, equalToArmor: true },
    ],
  },
  {
    id: "pack-tactics",
    title: "Pack Tactics",
    descriptionLines: ["Increase Companion damage by 1", "Deal 3 Nature damage"],
    art: packTactics,
    cost: 1,
    effects: [
      { kind: "buff-companion", amount: 1 },
      { kind: "damage", damageType: "nature", amount: 3 },
    ],
  },
  {
    id: "serrated-edge",
    title: "Serrated Edge",
    descriptionLines: ["Deal 1 Bleed damage", "Deal 3 Physical damage"],
    art: serratedEdge,
    cost: 1,
    effects: [
      { kind: "damage", damageType: "bleed", amount: 1 },
      { kind: "damage", damageType: "physical", amount: 3 },
    ],
  },
  {
    id: "smite",
    title: "Smite",
    descriptionLines: ["Deal 2 Holy damage", "Deal 2 Burn damage"],
    art: smite,
    cost: 1,
    effects: [
      { kind: "damage", damageType: "holy", amount: 2 },
      { kind: "damage", damageType: "burn", amount: 2 },
    ],
  },
  {
    id: "antivenom-potion",
    title: "Antivenom Potion",
    descriptionLines: ["Cleanse all Poison", "Consume"],
    art: antivenomPotion,
    cost: 1,
    consume: true,
    effects: [{ kind: "remove-player-status", status: "poison" }],
  },
  {
    id: "cold-snap",
    title: "Cold Snap",
    descriptionLines: ["Deal 1 Freeze damage", "Double enemy's Freeze build-up"],
    art: coldSnap,
    cost: 1,
    effects: [
      { kind: "damage", damageType: "freeze", amount: 1 },
      { kind: "multiply-enemy-status", status: "freeze", factor: 2 },
    ],
  },
  {
    id: "blood-offering",
    title: "Blood Offering",
    descriptionLines: ["Lose 1 Health", "Draw 2 Cards"],
    art: bloodOffering,
    cost: 1,
    effects: [
      { kind: "lose-health", amount: 1 },
      { kind: "draw-cards", amount: 2 },
    ],
  },
  {
    id: "sunder-armor",
    title: "Sunder Armor",
    descriptionLines: ["Deal 4 Physical damage", "Strip 2 enemy Armor"],
    art: sunderArmor,
    cost: 1,
    effects: [
      { kind: "damage", damageType: "physical", amount: 4 },
      { kind: "remove-enemy-armor", amount: 2 },
    ],
  },
  {
    id: "mana-shield",
    title: "Mana Shield",
    descriptionLines: ["Gain 2 Block per Mana Crystal"],
    art: manaShield,
    cost: 1,
    effects: [{ kind: "player-status", status: "block", amount: 0, perManaCrystal: 2 }],
  },
  {
    id: "prayer",
    title: "Prayer",
    descriptionLines: ["Wish 1", "Restore 3 Health"],
    art: prayer,
    cost: 1,
    effects: [
      { kind: "wish", amount: 1 },
      { kind: "heal", amount: 3 },
    ],
  },
  {
    id: "faustian-bargain",
    title: "Faustian Bargain",
    descriptionLines: ["Lose 2 Health", "Wish 2", "Consume"],
    art: faustianBargain,
    cost: 1,
    consume: true,
    effects: [
      { kind: "lose-health", amount: 2 },
      { kind: "wish", amount: 2 },
    ],
  },
  {
    id: "judgment",
    title: "Judgment",
    descriptionLines: ["Deal 3 Holy damage", "Deal 1 Stun damage"],
    art: judgment,
    cost: 1,
    effects: [
      { kind: "damage", damageType: "holy", amount: 3 },
      { kind: "damage", damageType: "stun", amount: 1 },
    ],
  },
  {
    id: "smelling-salts",
    title: "Smelling Salts",
    descriptionLines: ["Cleanse Stun build-up"],
    art: smellingSalts,
    cost: 1,
    effects: [{ kind: "remove-player-status", status: "stun" }],
  },
];

export function hydrateCard(savedCard: BattleCard): BattleCard {
  const libraryCard = cardLibrary.find((c) => c.id === savedCard.id);
  if (!libraryCard) return savedCard;

  const descriptionLines =
    Array.isArray(savedCard.descriptionLines) &&
    (savedCard as unknown as { descriptionLinesFullyValid?: boolean }).descriptionLinesFullyValid !== false
      ? [...savedCard.descriptionLines]
      : [...libraryCard.descriptionLines];

  const effects =
    Array.isArray(savedCard.effects) &&
    (savedCard as unknown as { effectsFullyValid?: boolean }).effectsFullyValid !== false
      ? (savedCard.effects.map((e) => (e && typeof e === "object" ? { ...e } : e)) as BattleCard["effects"])
      : libraryCard.effects.map((e) => ({ ...e }));

  const corruptedValuePositions = Array.isArray(savedCard.corruptedValuePositions)
    ? savedCard.corruptedValuePositions.filter(
        (p) =>
          p &&
          typeof p === "object" &&
          Number.isInteger(p.lineIndex) &&
          Number.isInteger(p.matchIndex) &&
          p.lineIndex >= 0 &&
          p.matchIndex >= 0,
      )
    : undefined;

  const cost =
    typeof savedCard.cost === "number" && Number.isFinite(savedCard.cost) && savedCard.cost >= 0
      ? Math.floor(savedCard.cost)
      : libraryCard.cost;

  const result: BattleCard = {
    ...libraryCard,
    descriptionLines,
    effects,
    cost,
  };
  if (savedCard.consume !== undefined) {
    result.consume = savedCard.consume;
  }
  if (savedCard.corrupted !== undefined) {
    result.corrupted = savedCard.corrupted;
  }
  if (savedCard.baseTitle !== undefined) {
    result.baseTitle = savedCard.baseTitle;
  }
  if (savedCard.uid !== undefined) {
    result.uid = savedCard.uid;
  }
  if (corruptedValuePositions && corruptedValuePositions.length > 0) {
    result.corruptedValuePositions = corruptedValuePositions;
  }
  return result;
}

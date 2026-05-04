import {
  anvil,
  apple,
  bash,
  blessedAegis,
  block,
  bread,
  cleanse,
  fangs,
  fireball,
  frostbolt,
  haste,
  heal,
  healthPotion,
  manaBerries,
  manaCrystal,
  manaPotion,
  meteor,
  panaceaPotion,
  plateMail,
  poisonDagger,
  slash,
  stab,
  steal,
  wish,
} from "./assets";
import type { BattleCard } from "./types";

export const cardLibrary: BattleCard[] = [
  { id: "slash", title: "Slash", descriptionLines: ["Deal 5 Physical"], art: slash, cost: 1, template: "mechanical", effects: [{ kind: "damage", damageType: "physical", amount: 5 }] },
  { id: "stab", title: "Stab", descriptionLines: ["Deal 4 Physical"], art: stab, cost: 1, template: "mechanical", effects: [{ kind: "damage", damageType: "physical", amount: 4 }] },
  { id: "bash", title: "Bash", descriptionLines: ["Deal 4 Stun"], art: bash, cost: 1, template: "mechanical", effects: [{ kind: "damage", damageType: "stun", amount: 4 }] },
  { id: "block", title: "Block", descriptionLines: ["Gain 5 Block"], art: block, cost: 1, template: "mechanical", effects: [{ kind: "player-status", status: "block", amount: 5 }] },
  { id: "anvil", title: "Anvil", descriptionLines: ["Gain 1 Forge"], art: anvil, cost: 1, template: "mechanical", effects: [{ kind: "player-status", status: "forge", amount: 1 }] },
  { id: "plate-mail", title: "Plate Mail", descriptionLines: ["Gain 1 Armor"], art: plateMail, cost: 1, template: "mechanical", effects: [{ kind: "player-status", status: "armor", amount: 1 }] },
  { id: "apple", title: "Apple", descriptionLines: ["Gain 5 Health"], art: apple, cost: 1, template: "nature", effects: [{ kind: "heal", amount: 5 }] },
  { id: "bread", title: "Bread", descriptionLines: ["Gain 5 Health"], art: bread, cost: 1, template: "nature", effects: [{ kind: "heal", amount: 5 }] },
  { id: "meteor", title: "Meteor", descriptionLines: ["Deal 10 Burn", "Lose 1 Mana Crystal"], art: meteor, cost: 1, template: "arcane", effects: [{ kind: "damage", damageType: "burn", amount: 10 }, { kind: "lose-max-mana", amount: 1 }] },
  { id: "steal", title: "Steal", descriptionLines: ["Steal 4 Gold"], art: steal, cost: 1, template: "arcane", effects: [{ kind: "gain-gold", amount: 4 }] },
  { id: "blessed-aegis", title: "Blessed Aegis", descriptionLines: ["Deal Holy equal to your Block"], art: blessedAegis, cost: 1, template: "holy", effects: [{ kind: "damage", damageType: "holy", amount: 0, fromBlock: true }] },
  { id: "wish", title: "Wish", descriptionLines: ["Wish 1"], art: wish, cost: 1, template: "arcane", effects: [{ kind: "wish", amount: 1 }] },
  { id: "cleanse", title: "Cleanse", descriptionLines: ["Remove an Ailment"], art: cleanse, cost: 1, template: "holy", effects: [{ kind: "remove-ailment", mode: "one" }] },
  { id: "heal", title: "Heal", descriptionLines: ["Restore 5 Health"], art: heal, cost: 1, template: "holy", effects: [{ kind: "heal", amount: 5 }] },
  { id: "haste", title: "Haste", descriptionLines: ["Take an extra turn after this one", "Consume"], art: haste, cost: 1, template: "arcane", consume: true, effects: [{ kind: "player-status", status: "haste", amount: 1 }] },
  { id: "poison-dagger", title: "Poison Dagger", descriptionLines: ["Poison 2"], art: poisonDagger, cost: 1, template: "alchemy", effects: [{ kind: "damage", damageType: "poison", amount: 2 }] },
  { id: "fireball", title: "Fireball", descriptionLines: ["Deal 3 Burn"], art: fireball, cost: 1, template: "arcane", effects: [{ kind: "damage", damageType: "burn", amount: 3 }] },
  { id: "fangs", title: "Fangs", descriptionLines: ["Deal 2 Bleed", "Leech"], art: fangs, cost: 1, template: "alchemy", effects: [{ kind: "damage", damageType: "bleed", amount: 2, lifesteal: true }] },
  { id: "frostbolt", title: "Frostbolt", descriptionLines: ["Deal 3 Freeze"], art: frostbolt, cost: 1, template: "arcane", effects: [{ kind: "damage", damageType: "freeze", amount: 3 }] },
  { id: "health-potion", title: "Health Potion", descriptionLines: ["Restore 8 Health", "Consume"], art: healthPotion, cost: 1, template: "alchemy", consume: true, effects: [{ kind: "heal", amount: 8 }] },
  { id: "mana-berries", title: "Mana Berries", descriptionLines: ["Restore 1 Mana", "Consume"], art: manaBerries, cost: 1, template: "nature", consume: true, effects: [{ kind: "restore-mana", amount: 1 }] },
  { id: "mana-crystals", title: "Mana Crystals", descriptionLines: ["Gain 1 Maximum Mana", "Consume"], art: manaCrystal, cost: 1, template: "alchemy", consume: true, effects: [{ kind: "gain-max-mana", amount: 1 }] },
  { id: "mana-potion", title: "Mana Potion", descriptionLines: ["Restore 2 Mana", "Consume"], art: manaPotion, cost: 1, template: "alchemy", consume: true, effects: [{ kind: "restore-mana", amount: 2 }] },
  { id: "panacea-potion", title: "Panacea Potion", descriptionLines: ["Remove all Ailments", "Consume"], art: panaceaPotion, cost: 1, template: "alchemy", consume: true, effects: [{ kind: "remove-ailment", mode: "all" }] },
];

const starterDeckIds = ["slash", "bash", "block", "anvil", "plate-mail", "apple", "meteor", "blessed-aegis"];

export const starterDeck: BattleCard[] = starterDeckIds
  .map((cardId) => cardLibrary.find((card) => card.id === cardId))
  .filter((card): card is BattleCard => Boolean(card));

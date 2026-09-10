import type { KeywordId } from "@/lib/game-data";
import type { LabyrinthNodeType } from "../types";

interface LabyrinthTraitInput {
  category: "combat" | "reward";
  label: string;
  description: string;
  modes: ReadonlyArray<"labyrinth" | "wildwood">;
  labyrinthNodes: readonly LabyrinthNodeType[];
  keyword: KeywordId;
}

function benefit(label: string, description: string, keyword: KeywordId): LabyrinthTraitInput & { category: "reward" } {
  return {
    category: "reward",
    label,
    description,
    keyword,
    modes: ["labyrinth"],
    labyrinthNodes: ["combat", "elite", "boss"],
  };
}

function enemy(
  label: string,
  description: string,
  keyword: KeywordId,
  labyrinthNodes: readonly LabyrinthNodeType[] = ["combat", "elite", "boss"],
): LabyrinthTraitInput & { category: "combat" } {
  return { category: "combat", label, description, keyword, modes: ["labyrinth"], labyrinthNodes };
}

function room(
  node: LabyrinthNodeType,
  label: string,
  description: string,
  keyword: KeywordId,
): LabyrinthTraitInput & { category: "reward" } {
  return { ...benefit(label, description, keyword), labyrinthNodes: [node] };
}

export const LABYRINTH_TRAITS = {
  "heavy-hand": benefit("Heavy Hand", "Your first Physical attack each turn deals double damage", "physical"),
  thunderstruck: benefit("Thunderstruck", "Your attacks apply double Stun buildup", "stun"),
  unbroken: benefit("Unbroken", "Your Block no longer halves each turn", "block"),
  "white-heat": benefit("White Heat", "You no longer lose Forge when dealing damage", "forge"),
  ironclad: benefit("Ironclad", "You no longer lose Armor when taking damage", "armor"),
  "eternal-flame": benefit("Eternal Flame", "Burn on the enemy no longer halves each turn", "burn"),
  consecrated: benefit("Consecrated", "Your first Holy attack each turn deals double damage", "holy"),
  wishful: benefit("Wishful", "Your first Wish each turn offers an additional card", "wish"),
  fleeting: benefit("Fleeting", "Your Consume cards cost 1 less", "consume"),
  venomous: benefit("Venomous", "Poison on the enemy decays half as quickly", "poison"),
  "deep-wounds": benefit("Deep Wounds", "Your attacks apply twice as much Bleed", "bleed"),
  "blood-feast": benefit("Blood Feast", "Your Leech restores twice as much Health", "leech"),
  "bitter-cold": benefit("Bitter Cold", "Your attacks apply double Freeze buildup", "freeze"),
  wellspring: benefit("Wellspring", "Start each turn with 1 extra Mana", "mana"),
  wildheart: benefit("Wildheart", "Your first Nature attack each turn deals double damage", "nature"),
  "eager-pack": benefit("Eager Pack", "Your Companions act twice when summoned", "companion"),
  quickdraw: benefit("Quickdraw", "Your first Archery card each turn costs 1 less", "archery"),
  "phoenix-nest": benefit("Phoenix Nest", "Start battle with Phoenix Feather", "phoenixFeather"),
  elusive: benefit("Elusive", "Gain 15% Dodge this battle", "dodge"),
  bramblecoat: benefit("Bramblecoat", "Start each turn with at least 3 Thorns", "thorns"),
  restorative: benefit("Restorative", "Restore 2 Health at the end of your turn", "health"),
  fletched: benefit("Fletched", "Choose a free Archery card after victory", "archery"),
  wishkeeper: benefit("Wishkeeper", "Choose a free Wish card after victory", "wish"),
  "kindred-spoils": benefit("Kindred Spoils", "Choose a free Nature card after victory", "nature"),
  entrenched: enemy("Entrenched", "Enemy Block no longer halves each turn", "block"),
  winterborn: enemy("Winterborn", "Enemy receives half Freeze buildup", "freeze"),
  toxic: enemy("Toxic", "Enemy deals 1 Poison damage each turn", "poison"),
  bloodletter: enemy("Bloodletter", "Enemy deals 1 Bleed damage each turn", "bleed"),
  thornhide: enemy("Thornhide", "Enemy starts each turn with at least 2 Thorns", "thorns"),
  ravenous: enemy("Ravenous", "Enemy attacks gain Leech", "leech"),
  "elusive-foe": enemy("Elusive Foe", "Enemy gains 10% Dodge", "dodge"),
  "thick-hide": enemy("Thick Hide", "Enemy takes half Physical damage", "physical"),
  unbreakable: enemy("Unbreakable", "Enemy no longer loses Armor when taking damage", "armor", ["elite", "boss"]),
  whitehot: enemy("Whitehot", "Enemy no longer loses Forge when dealing damage", "forge", ["elite", "boss"]),
  executioner: enemy("Desperation", "Enemy deals double Physical damage while below half Health", "physical", [
    "elite",
    "boss",
  ]),
  "second-wind": enemy("Second Wind", "Enemy restores 20% Health upon reaching half Health, once", "health", [
    "elite",
    "boss",
  ]),
  "iron-fortress": enemy("Iron Fortress", "Enemy starts with 12 Armor", "armor", ["boss"]),
  "briar-crown": enemy("Briar Crown", "Enemy starts each turn with at least 4 Thorns", "thorns", ["boss"]),
  "deep-rest": room("rest", "Deep Rest", "Rest restores twice as much Health", "health"),
  "healing-spring": room("rest", "Healing Spring", "Rest restores all your Health", "health"),
  "hidden-purse": room("rest", "Hidden Purse", "Rest also grants 15 Gold", "gold"),
  "herbal-hearth": room("rest", "Herbal Hearth", "Rest also grants a random Potion", "health"),
  "fletchers-market": room("shop", "Fletchers’ Market", "All offered cards have Archery", "archery"),
  "beast-market": room("shop", "Beast Market", "All offered cards have Companion", "companion"),
  "ember-market": room("shop", "Ember Market", "All offered cards have Burn", "burn"),
  "wishing-market": room("shop", "Wishing Market", "All offered cards have Wish", "wish"),
  "clean-slate": room("shop", "Clean Slate", "Removing a card is free", "consume"),
  "bargain-bin": room("shop", "Bargain Bin", "Cards cost half price", "gold"),
  "open-kitchen": room("alchemist", "Open Kitchen", "Mixing Potions is free", "consume"),
  "happy-hour": room("alchemist", "Happy Hour", "Potions cost half price", "gold"),
  "fresh-batch": room("alchemist", "Fresh Batch", "Refreshing Potions is free", "wish"),
  "strong-spirits": room("alchemist", "Strong Spirits", "Offered Potions have doubled potency", "poison"),
  "collectors-favor": room("trinket-shop", "Collector’s Favor", "Trinkets cost 25% less Gold", "gold"),
  "fresh-curios": room("trinket-shop", "Fresh Curios", "Refreshing Trinkets is free", "wish"),
  bowyer: room("equipment-shop", "Bowyer", "All offered Gear is bows", "archery"),
  armorer: room("equipment-shop", "Armorer", "All offered Gear is chest armor", "armor"),
  apprentice: room("equipment-shop", "Apprentice", "Basic Gear costs half price", "gold"),
  masterwork: room("equipment-shop", "Masterwork", "All offered Gear is Astral", "forge"),
  "golden-omen": room("mystery", "Golden Omen", "This event grants twice as much Gold", "gold"),
  bountiful: room("mystery", "Bountiful", "This event grants twice as many Materials", "nature"),
  enlightening: room("mystery", "Enlightening", "This event grants twice as much experience", "wish"),
  "restful-discovery": room("mystery", "Restful Discovery", "Restore 15% Health after this event", "health"),
  "steady-sigil": room("corruption", "Steady Sigil", "Corruption cannot weaken", "armor"),
  "pure-altar": room("corruption", "Pure Altar", "Keeps your card's identity", "wish"),
  "echoing-altar": room("corruption", "Echoing Altar", "Gift matches your card's keywords", "consume"),
  "blood-rite": room("corruption", "Blood Rite", "Favors Bleed and Leech gifts", "bleed"),
  "twin-offering": room("corruption", "Twin Offering", "Corrupts once with two gifts", "leech"),
};

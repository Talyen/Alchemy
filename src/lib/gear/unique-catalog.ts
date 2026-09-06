import type { GearBaseItemId } from "./base-items";
import { gearAffixCatalog, type GearAffixId } from "./affix-catalog";
import type { GearAffixRoll } from "./types";

export interface UniqueItemDefinition {
  id: string;
  displayName: string;
  baseItemId: GearBaseItemId;
  description: string;
  signatureAffix: GearAffixRoll;
  supportingAffixes: [GearAffixRoll, GearAffixRoll, GearAffixRoll];
}

function maxAffix(id: GearAffixId): GearAffixRoll {
  return { id, value: gearAffixCatalog[id].roll.unique.max };
}

function uniqueItem(
  id: string,
  displayName: string,
  baseItemId: GearBaseItemId,
  signatureId: GearAffixId,
  supports: [GearAffixId, GearAffixId, GearAffixId],
): UniqueItemDefinition {
  const signatureAffix = maxAffix(signatureId);
  return {
    id,
    displayName,
    baseItemId,
    description: gearAffixCatalog[signatureId].descriptionTemplate.replace("{value}", String(signatureAffix.value)),
    signatureAffix,
    supportingAffixes: [maxAffix(supports[0]), maxAffix(supports[1]), maxAffix(supports[2])],
  };
}

export const uniqueItemList: UniqueItemDefinition[] = [
  uniqueItem("wardbreaker", "Wardbreaker", "flail", "wardbreaker-purge", [
    "flat-stun",
    "damage-on-stun",
    "block-on-stun",
  ]),
  uniqueItem("dance-of-blades", "Dance of Blades", "leather-armor", "dance-of-blades", [
    "flat-physical",
    "armor-on-cc",
    "start-armor",
  ]),
  uniqueItem("bloodfire-signet", "Bloodfire Signet", "ruby-ring", "bloodfire", [
    "flat-burn",
    "flat-bleed",
    "burn-on-bleed",
  ]),
  uniqueItem("rimeheart-locket", "Rimeheart Locket", "sapphire-amulet", "rimeheart", [
    "flat-freeze",
    "start-block",
    "damage-on-freeze",
  ]),
  uniqueItem("blackfletch", "Blackfletch", "crossbow", "blackfletch", ["archery-damage", "flat-bleed", "flat-poison"]),
  uniqueItem("twin-casting", "Twin Casting", "staff", "twin-casting", ["flat-burn", "flat-freeze", "burn-per-mana"]),
  uniqueItem("saintfall-plate", "Saintfall Plate", "plate-armor", "saintfall", [
    "stun-on-block-hit",
    "heal-on-block-depleted",
    "max-health",
  ]),
  uniqueItem("golden-verdict", "Golden Verdict", "topaz-ring", "golden-verdict", [
    "flat-holy",
    "flat-stun",
    "gold-on-kill",
  ]),
  uniqueItem("the-unclosing-wound", "The Unclosing Wound", "double-axe", "the-unclosing-wound", [
    "flat-physical",
    "flat-bleed",
    "flat-stun",
  ]),
  uniqueItem("kingbreaker", "Kingbreaker", "maul", "kingbreaker", ["flat-physical", "flat-stun", "block-on-stun"]),
  uniqueItem("everkeen", "Everkeen", "greatsword", "everkeen", ["flat-physical", "start-forge", "forge-on-stun"]),
  uniqueItem("red-harvest", "Red Harvest", "hatchet", "red-harvest", ["flat-physical", "flat-bleed", "armor-pierce"]),
  uniqueItem("oathkeeper", "Oathkeeper", "longsword", "oathkeeper", ["flat-physical", "flat-holy", "start-forge"]),
  uniqueItem("the-patient-edge", "The Patient Edge", "shortsword", "the-patient-edge", [
    "flat-physical",
    "flat-bleed",
    "start-forge",
  ]),
  uniqueItem("vipers-courtesy", "Viper’s Courtesy", "dagger", "vipers-courtesy", [
    "dodge-chance",
    "flat-poison",
    "flat-bleed",
  ]),
  uniqueItem("the-lingering-bell", "The Lingering Bell", "mace", "the-lingering-bell", [
    "flat-stun",
    "flat-holy",
    "damage-on-stun",
  ]),
  uniqueItem("huntsmasters-call", "Huntsmaster’s Call", "longbow", "huntsmasters-call", [
    "archery-damage",
    "companion-damage",
    "flat-nature",
  ]),
  uniqueItem("wrenflight", "Wrenflight", "shortbow", "wrenflight", ["archery-damage", "dodge-chance", "dodge-heal"]),
  uniqueItem("the-returning-gale", "The Returning Gale", "recurve-bow", "the-returning-gale", [
    "archery-damage",
    "flat-nature",
    "flat-physical",
  ]),
  uniqueItem("the-final-spark", "The Final Spark", "wand", "the-final-spark", [
    "flat-burn",
    "flat-freeze",
    "burn-per-mana",
  ]),
  uniqueItem("laughing-guard", "Laughing Guard", "leather-buckler", "laughing-guard", [
    "dodge-chance",
    "dodge-block",
    "block-gain",
  ]),
  uniqueItem("the-knights-answer", "The Knight’s Answer", "kite-shield", "the-knights-answer", [
    "start-block",
    "start-armor",
    "flat-physical",
  ]),
  uniqueItem("the-returning-flight", "The Returning Flight", "quiver", "the-returning-flight", [
    "archery-damage",
    "archery-ignore-armor",
    "dodge-chance",
  ]),
  uniqueItem("threefold-grace", "Threefold Grace", "spellbook", "threefold-grace", [
    "flat-burn",
    "flat-freeze",
    "flat-holy",
  ]),
  uniqueItem("bloodember-pendant", "Bloodember Pendant", "ruby-amulet", "bloodember-pendant", [
    "flat-burn",
    "flat-bleed",
    "leech-potency",
  ]),
  uniqueItem("winters-credit", "Winter’s Credit", "sapphire-ring", "winters-credit", [
    "flat-freeze",
    "start-block",
    "block-gain",
  ]),
  uniqueItem("serpents-eye", "Serpent’s Eye", "emerald-ring", "serpents-eye", [
    "flat-poison",
    "flat-nature",
    "archery-damage",
  ]),
  uniqueItem("wildhearts-favor", "Wildheart’s Favor", "emerald-amulet", "wildhearts-favor", [
    "flat-nature",
    "dodge-chance",
    "dodge-heal",
  ]),
  uniqueItem("the-golden-crucible", "The Golden Crucible", "topaz-amulet", "the-golden-crucible", [
    "start-forge",
    "flat-holy",
    "gold-gain",
  ]),
];

const uniqueItemDefinitions = new Map(uniqueItemList.map((item) => [item.id, item]));

export function getUniqueItemDefinition(id: string): UniqueItemDefinition | undefined {
  return uniqueItemDefinitions.get(id);
}

export function getUniqueAffixes(id: string): GearAffixRoll[] | undefined {
  const definition = getUniqueItemDefinition(id);
  return definition
    ? [definition.signatureAffix, ...definition.supportingAffixes].map((affix) => ({ ...affix }))
    : undefined;
}

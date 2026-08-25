import type { GearBaseItemId } from "./base-items";
import type { GearAffixRoll } from "./definitions";

export interface UniqueItemDefinition {
  id: string;
  displayName: string;
  baseItemId: GearBaseItemId;
  description: string;
  signatureAffix: GearAffixRoll;
  supportingAffixes: [GearAffixRoll, GearAffixRoll, GearAffixRoll];
}

const wardbreaker: UniqueItemDefinition = {
  id: "wardbreaker",
  displayName: "Wardbreaker",
  baseItemId: "flail",
  description: "Purge enemy Armor, Block, and Forge when you Stun an enemy and deal 2 Holy damage per point removed.",
  signatureAffix: { id: "wardbreaker-purge", value: 2 },
  supportingAffixes: [
    { id: "flat-stun", value: 4 },
    { id: "damage-on-stun", value: 6 },
    { id: "block-on-stun", value: 6 },
  ],
};

const danceOfBlades: UniqueItemDefinition = {
  id: "dance-of-blades",
  displayName: "Dance of Blades",
  baseItemId: "leather-armor",
  description: "When you Dodge an attack, draw and play a random card.",
  signatureAffix: { id: "dance-of-blades", value: 1 },
  supportingAffixes: [
    { id: "flat-physical", value: 4 },
    { id: "armor-on-cc", value: 4 },
    { id: "start-armor", value: 6 },
  ],
};

const bloodfireSignet: UniqueItemDefinition = {
  id: "bloodfire-signet",
  displayName: "Bloodfire Signet",
  baseItemId: "ruby-ring",
  description: "Burn and Bleed damage cross-proc with a 20% chance. Burn and Bleed damage gain 50% Leech.",
  signatureAffix: { id: "bloodfire", value: 1 },
  supportingAffixes: [
    { id: "flat-burn", value: 4 },
    { id: "flat-bleed", value: 4 },
    { id: "burn-on-bleed", value: 20 },
  ],
};

const rimeheartLocket: UniqueItemDefinition = {
  id: "rimeheart-locket",
  displayName: "Rimeheart Locket",
  baseItemId: "sapphire-amulet",
  description:
    "Dealing Freeze damage grants that amount of Block. Freezing an enemy restores Mana equal to half your Block (max 4).",
  signatureAffix: { id: "rimeheart", value: 1 },
  supportingAffixes: [
    { id: "flat-freeze", value: 4 },
    { id: "start-block", value: 8 },
    { id: "damage-on-freeze", value: 6 },
  ],
};

const blackfletch: UniqueItemDefinition = {
  id: "blackfletch",
  displayName: "Blackfletch",
  baseItemId: "crossbow",
  description: "Archery attacks detonate and consume all remaining Bleed and Poison damage on the target.",
  signatureAffix: { id: "blackfletch", value: 1 },
  supportingAffixes: [
    { id: "archery-damage", value: 4 },
    { id: "flat-bleed", value: 4 },
    { id: "flat-poison", value: 4 },
  ],
};

const twinCasting: UniqueItemDefinition = {
  id: "twin-casting",
  displayName: "Twin Casting",
  baseItemId: "staff",
  description: "Playing a Burn card draws a Freeze card, and playing a Freeze card draws a Burn card.",
  signatureAffix: { id: "twin-casting", value: 1 },
  supportingAffixes: [
    { id: "flat-burn", value: 4 },
    { id: "flat-freeze", value: 4 },
    { id: "burn-per-mana", value: 10 },
  ],
};

const saintfallPlate: UniqueItemDefinition = {
  id: "saintfall-plate",
  displayName: "Saintfall Plate",
  baseItemId: "plate-armor",
  description:
    "The first time each battle your Block is depleted, deal 6 Holy and 6 Stun damage to attacker and restore 6 Health.",
  signatureAffix: { id: "saintfall", value: 6 },
  supportingAffixes: [
    { id: "stun-on-block-hit", value: 5 },
    { id: "heal-on-block-depleted", value: 6 },
    { id: "max-health", value: 10 },
  ],
};

const goldenVerdict: UniqueItemDefinition = {
  id: "golden-verdict",
  displayName: "Golden Verdict",
  baseItemId: "topaz-ring",
  description: "Holy damage builds an equal amount of Stun. When this Stuns an enemy, gain 1 Gold.",
  signatureAffix: { id: "golden-verdict", value: 1 },
  supportingAffixes: [
    { id: "flat-holy", value: 4 },
    { id: "flat-stun", value: 4 },
    { id: "gold-on-kill", value: 3 },
  ],
};

const uniqueItemDefinitions: Record<string, UniqueItemDefinition> = {
  wardbreaker,
  "dance-of-blades": danceOfBlades,
  "bloodfire-signet": bloodfireSignet,
  "rimeheart-locket": rimeheartLocket,
  blackfletch,
  "twin-casting": twinCasting,
  "saintfall-plate": saintfallPlate,
  "golden-verdict": goldenVerdict,
};

export const uniqueItemList = Object.values(uniqueItemDefinitions);

export function getUniqueItemDefinition(id: string): UniqueItemDefinition | undefined {
  return uniqueItemDefinitions[id];
}

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
  description: "Your attacks Purge a beneficial effect and deal 1 Holy damage for each effect removed",
  signatureAffix: { id: "wardbreaker-purge", value: 1 },
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
  description: "When you Dodge an attack, draw and play a random card",
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
  description:
    "Burn damage has a 20% chance to cause Bleed, Bleed damage has a 20% chance to cause Burn, and both gain Leech",
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
  description: "Dealing Freeze damage grants Block and Freezing an enemy restores Mana equal to half your Block",
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
  description: "Archery attacks detonate and consume all remaining Bleed and Poison damage on the target",
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
  description: "Playing a Burn card draws a Freeze card, and playing a Freeze card draws a Burn card",
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
  description: "When your Block is depleted, deal 4 Holy damage and gain 4 Health",
  signatureAffix: { id: "saintfall", value: 4 },
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
  description: "Holy damage causes Stun build-up and you gain 1 Gold when you Stun an enemy",
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

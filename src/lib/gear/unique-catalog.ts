import type { GearBaseItemId } from "./base-items";
import { formatAffixDescription, gearAffixCatalog, type GearAffixId } from "./affix-catalog";
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
  signatureId: GearAffixId,
  baseItemId: GearBaseItemId,
  supports: [GearAffixId, GearAffixId, GearAffixId],
  presentation: Partial<Pick<UniqueItemDefinition, "id" | "displayName">> = {},
): UniqueItemDefinition {
  const signature = gearAffixCatalog[signatureId];
  const signatureAffix = maxAffix(signatureId);
  return {
    id: presentation.id ?? signature.id,
    displayName: presentation.displayName ?? signature.name,
    baseItemId,
    description: formatAffixDescription(signature.descriptionTemplate, signatureAffix.value),
    signatureAffix,
    supportingAffixes: [maxAffix(supports[0]), maxAffix(supports[1]), maxAffix(supports[2])],
  };
}

export const uniqueItemList: UniqueItemDefinition[] = [
  uniqueItem("wardbreaker-purge", "flail", ["flat-stun", "damage-on-stun", "block-on-stun"], {
    id: "wardbreaker",
    displayName: "Wardbreaker",
  }),
  uniqueItem("dance-of-blades", "leather-armor", ["flat-physical", "armor-on-cc", "start-armor"], {
    displayName: "Dance of Blades",
  }),
  uniqueItem("bloodfire", "ruby-ring", ["flat-burn", "flat-bleed", "burn-on-bleed"], {
    id: "bloodfire-signet",
    displayName: "Bloodfire Signet",
  }),
  uniqueItem("rimeheart", "sapphire-amulet", ["flat-freeze", "start-block", "damage-on-freeze"], {
    id: "rimeheart-locket",
    displayName: "Rimeheart Locket",
  }),
  uniqueItem("blackfletch", "crossbow", ["archery-damage", "flat-bleed", "flat-poison"]),
  uniqueItem("twin-casting", "staff", ["flat-burn", "flat-freeze", "burn-per-mana"], { displayName: "Twin Casting" }),
  uniqueItem("saintfall", "plate-armor", ["stun-on-block-hit", "heal-on-block-depleted", "max-health"], {
    id: "saintfall-plate",
    displayName: "Saintfall Plate",
  }),
  uniqueItem("golden-verdict", "topaz-ring", ["flat-holy", "flat-stun", "gold-on-kill"], {
    displayName: "Golden Verdict",
  }),
  uniqueItem("the-unclosing-wound", "double-axe", ["flat-physical", "flat-bleed", "flat-stun"]),
  uniqueItem("kingbreaker", "maul", ["flat-physical", "flat-stun", "block-on-stun"]),
  uniqueItem("everkeen", "greatsword", ["flat-physical", "start-forge", "forge-on-stun"]),
  uniqueItem("red-harvest", "hatchet", ["flat-physical", "flat-bleed", "armor-pierce"]),
  uniqueItem("oathkeeper", "longsword", ["flat-physical", "flat-holy", "start-forge"]),
  uniqueItem("the-patient-edge", "shortsword", ["flat-physical", "flat-bleed", "start-forge"]),
  uniqueItem("vipers-courtesy", "dagger", ["dodge-chance", "flat-poison", "flat-bleed"]),
  uniqueItem("the-lingering-bell", "mace", ["flat-stun", "flat-holy", "damage-on-stun"]),
  uniqueItem("huntsmasters-call", "longbow", ["archery-damage", "companion-damage", "flat-nature"]),
  uniqueItem("wrenflight", "shortbow", ["archery-damage", "dodge-chance", "dodge-heal"]),
  uniqueItem("the-returning-gale", "recurve-bow", ["archery-damage", "flat-nature", "flat-physical"]),
  uniqueItem("the-final-spark", "wand", ["flat-burn", "flat-freeze", "burn-per-mana"]),
  uniqueItem("laughing-guard", "leather-buckler", ["dodge-chance", "dodge-block", "block-gain"]),
  uniqueItem("the-knights-answer", "kite-shield", ["start-block", "start-armor", "flat-physical"]),
  uniqueItem("the-returning-flight", "quiver", ["archery-damage", "archery-ignore-armor", "dodge-chance"]),
  uniqueItem("threefold-grace", "spellbook", ["flat-burn", "flat-freeze", "flat-holy"]),
  uniqueItem("bloodember-pendant", "ruby-amulet", ["flat-burn", "flat-bleed", "leech-potency"]),
  uniqueItem("winters-credit", "sapphire-ring", ["flat-freeze", "start-block", "block-gain"]),
  uniqueItem("serpents-eye", "emerald-ring", ["flat-poison", "flat-nature", "archery-damage"]),
  uniqueItem("wildhearts-favor", "emerald-amulet", ["flat-nature", "dodge-chance", "dodge-heal"]),
  uniqueItem("the-golden-crucible", "topaz-amulet", ["start-forge", "flat-holy", "gold-gain"]),
];

// Combat caches own their catalog snapshot independently of exported authoring reads.
const uniqueItemDefinitions = new Map(uniqueItemList.map((item) => [item.id, structuredClone(item)]));
const uniqueAffixViews = new Map<string, ReadonlyArray<Readonly<GearAffixRoll>>>();

export function getUniqueItemDefinition(id: string): UniqueItemDefinition | undefined {
  const definition = uniqueItemDefinitions.get(id);
  return definition ? structuredClone(definition) : undefined;
}

/** Shared immutable reads for combat, keyword colors and inspection. */
export function getUniqueAffixView(id: string): ReadonlyArray<Readonly<GearAffixRoll>> | undefined {
  const cached = uniqueAffixViews.get(id);
  if (cached) return cached;
  const definition = uniqueItemDefinitions.get(id);
  if (!definition) return undefined;
  // The authored catalog is stable, so only encountered Unique definitions
  // allocate a view. Unknown or transient instance IDs never enter this cache.
  const view = Object.freeze(
    [definition.signatureAffix, ...definition.supportingAffixes].map((affix) => Object.freeze({ ...affix })),
  );
  uniqueAffixViews.set(id, view);
  return view;
}

export function getUniqueAffixes(id: string): GearAffixRoll[] | undefined {
  return getUniqueAffixView(id)?.map((affix) => ({ ...affix }));
}

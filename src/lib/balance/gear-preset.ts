import { characters, type CharacterId } from "@/lib/game-data";
import {
  generateGearInstanceForBaseItem,
  gearBaseItemList,
  type GearBaseItemDefinition,
  type GearSlot,
} from "@/lib/gear";
import { resolveAffixEffects } from "@/lib/gear/affixes";
import { defaultGearEffects, mergeGearEffectManifests, type GearEffectManifest } from "@/lib/gear/gear-effect-manifest";
import { pickRandom } from "@/lib/utils";
import type { TalentPreset } from "./types";

const MID_GEAR_SLOTS: GearSlot[] = ["main-hand", "body"];
const LATE_GEAR_SLOTS: GearSlot[] = ["main-hand", "off-hand", "body", "left-accessory", "right-accessory"];

function slotsForPreset(preset: TalentPreset): GearSlot[] {
  if (preset === "early") return [];
  if (preset === "mid") return MID_GEAR_SLOTS;
  return LATE_GEAR_SLOTS;
}

function itemFitsSlot(item: GearBaseItemDefinition, slot: GearSlot): boolean {
  return item.compatibleSlots.includes(slot);
}

function itemMatchesAffinity(item: GearBaseItemDefinition, keywords: readonly string[]): boolean {
  if (keywords.length === 0) return true;
  return item.affinityKeywords.some((keyword) => keywords.includes(keyword));
}

function slotConstraints(
  item: GearBaseItemDefinition,
  slot: GearSlot,
  options: { rangedMainHand: boolean; skipTwoHanded: boolean },
): boolean {
  if (!itemFitsSlot(item, slot)) return false;
  if (slot === "off-hand") {
    if (options.rangedMainHand) return item.slotRule === "quiver";
    if (item.slotRule === "quiver") return false;
  }
  if (options.skipTwoHanded && item.slotRule === "two-handed") return false;
  return true;
}

function poolForSlot(
  slot: GearSlot,
  keywords: readonly string[],
  options: { rangedMainHand: boolean; skipTwoHanded: boolean },
): GearBaseItemDefinition[] {
  const inSlot = gearBaseItemList.filter((item) => slotConstraints(item, slot, options));
  const affinity = inSlot.filter((item) => itemMatchesAffinity(item, keywords));
  return affinity.length > 0 ? affinity : inSlot;
}

export function buildTypicalGearEffects(
  characterId: CharacterId,
  preset: TalentPreset,
  rng: () => number,
  astralChanceBonus = 0,
): GearEffectManifest {
  const slots = slotsForPreset(preset);
  if (slots.length === 0) return { ...defaultGearEffects };

  const keywords = characters[characterId].keywords;
  let effects = { ...defaultGearEffects };
  let rangedMainHand = false;
  let skipOffHand = false;

  for (const slot of slots) {
    if (slot === "off-hand" && skipOffHand) continue;
    const pool = poolForSlot(slot, keywords, { rangedMainHand, skipTwoHanded: false });
    const chosen = pickRandom(pool, rng);
    if (!chosen) continue;
    const instance = generateGearInstanceForBaseItem(chosen.id, rng, astralChanceBonus);
    if (!instance) continue;
    effects = mergeGearEffectManifests(effects, resolveAffixEffects(instance.affixes));
    if (slot === "main-hand") {
      rangedMainHand = chosen.slotRule === "ranged";
      skipOffHand = chosen.slotRule === "two-handed";
    }
  }

  return effects;
}

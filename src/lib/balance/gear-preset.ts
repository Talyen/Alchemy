import { resolveLootWeights } from "@/lib/loot";
import { characters, type CharacterId } from "@/lib/game-data";
import {
  effectsForInstance,
  generateLootGearChoices,
  gearBaseItemList,
  type GearBaseItemDefinition,
  type GearSlot,
} from "@/lib/gear";
import { defaultGearEffects, mergeGearEffectManifests, type GearEffectManifest } from "@/lib/gear/gear-effect-manifest";
import { pickRandom } from "@/lib/rng";
import type { TalentPreset } from "./simulator-types";

const MID_GEAR_SLOTS: GearSlot[] = ["main-hand", "body"];
const LATE_GEAR_SLOTS: GearSlot[] = ["main-hand", "off-hand", "body", "left-accessory", "right-accessory"];

// Late-campaign probe roll for typical sim gear. Both the typical loadout and
// the gear-ablation sweep use this so gear deltas stay comparable. Tier depth
// is intentionally not used here: mid/late sims probe the same loot curve.
export const SIM_GEAR_ROLL_DEPTH = 24;
export const SIM_GEAR_ROLL_SOURCE = "mystery" as const;

function slotsForPreset(preset: TalentPreset): GearSlot[] {
  if (preset === "early") return [];
  if (preset === "mid") return MID_GEAR_SLOTS;
  return LATE_GEAR_SLOTS;
}

function poolForSlot(slot: GearSlot, keywords: readonly string[], rangedMainHand: boolean): GearBaseItemDefinition[] {
  const inSlot = gearBaseItemList.filter(
    (item) =>
      item.compatibleSlots.includes(slot) &&
      (slot !== "off-hand" || (rangedMainHand ? item.slotRule === "quiver" : item.slotRule !== "quiver")),
  );
  const affinity = inSlot.filter(
    (item) => keywords.length === 0 || item.affinityKeywords.some((keyword) => keywords.includes(keyword)),
  );
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
  const weights = resolveLootWeights({
    source: SIM_GEAR_ROLL_SOURCE,
    progress: { depth: SIM_GEAR_ROLL_DEPTH, highestCompletedDifficulty: null },
    astralChanceBonus,
  });
  let effects = { ...defaultGearEffects };
  let rangedMainHand = false;
  let skipOffHand = false;

  for (const slot of slots) {
    if (slot === "off-hand" && skipOffHand) continue;
    const pool = poolForSlot(slot, keywords, rangedMainHand);
    const chosen = pickRandom(pool, rng);
    if (!chosen) continue;
    const instance = generateLootGearChoices(1, rng, weights, new Set(), [chosen.id])[0];
    if (!instance) continue;
    effects = mergeGearEffectManifests(effects, effectsForInstance(instance));
    if (slot === "main-hand") {
      rangedMainHand = chosen.slotRule === "ranged";
      skipOffHand = chosen.slotRule === "two-handed";
    }
  }

  return effects;
}

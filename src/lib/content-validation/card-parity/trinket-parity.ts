import { isTrinketId, type TrinketEntry, type TrinketId, type TrinketManifest } from "@/lib/game-data";
import type { ContentValidationIssue } from "../types";

type EffectKeyOfType<T> = {
  [K in keyof TrinketManifest]: TrinketManifest[K] extends T ? K : never;
}[keyof TrinketManifest];

interface TrinketParityRule {
  pattern: RegExp;
  numericEffects: ReadonlyArray<EffectKeyOfType<number>>;
  requiredBooleanEffects?: ReadonlyArray<EffectKeyOfType<boolean>>;
}

export const TRINKET_PARITY_RULES: Record<TrinketId, TrinketParityRule> = {
  "brass-censer": {
    pattern: /^holy damage has a ([+-]?\d+(?:\.\d+)?)% chance to also burn or leech$/,
    numericEffects: ["brassCenserProcChance"],
  },
  "tattered-pages": {
    pattern: /^draw ([+-]?\d+(?:\.\d+)?) at the start of combat$/,
    numericEffects: ["extraDrawPerBattle"],
  },
  meteorite: {
    pattern: /^your first burn damage each combat is doubled$/,
    numericEffects: [],
    requiredBooleanEffects: ["firstBurnDoubled"],
  },
  "bone-charm": {
    pattern: /^restore ([+-]?\d+(?:\.\d+)?) health when you defeat an enemy$/,
    numericEffects: ["boneCharmHealOnKill"],
  },
  "obsidian-hammer": {
    pattern:
      /^when you have ([+-]?\d+(?:\.\d+)?) or more forge, your physical damage also deals ([+-]?\d+(?:\.\d+)?) stun damage$/,
    numericEffects: ["forgeStunThreshold", "forgeStunAmount"],
  },
  "icy-heart": {
    pattern: /^when you freeze an enemy, deal ([+-]?\d+(?:\.\d+)?) physical damage$/,
    numericEffects: ["frozenHeartDamage"],
  },
  "ironwood-buckler": {
    pattern: /^gain ([+-]?\d+(?:\.\d+)?) thorns when you gain block$/,
    numericEffects: ["ironwoodBucklerThornsOnBlock"],
  },
  "runic-quill": {
    pattern: /^draw ([+-]?\d+(?:\.\d+)?) when you consume$/,
    numericEffects: ["runicQuillDrawOnConsume"],
  },
  "sin-eaters-lantern": {
    pattern: /^gain ([+-]?\d+(?:\.\d+)?) health when you remove a harmful status effect$/,
    numericEffects: ["sinEaterHealOnHarmfulStatusRemove"],
  },
  "vanguards-crest": {
    pattern: /^when your block fully absorbs an attack, gain ([+-]?\d+(?:\.\d+)?) forge$/,
    numericEffects: ["vanguardCrestForgeOnBlockAbsorb"],
  },
  "parasitic-bloom": {
    pattern: /^poison has a ([+-]?\d+(?:\.\d+)?)% chance to leech$/,
    numericEffects: ["parasiticBloomLeechChance"],
  },
  "cutpurse-knife": {
    pattern: /^gain ([+-]?\d+(?:\.\d+)?) gold when you deal bleed damage$/,
    numericEffects: ["cutpurseGoldOnBleed"],
  },
  "wishing-well-coin": {
    pattern: /^when you wish, also gain ([+-]?\d+(?:\.\d+)?) gold$/,
    numericEffects: ["wishingWellGoldOnWish"],
  },
  "merchants-favor": {
    pattern: /^your first purchase at each shop costs ([+-]?\d+(?:\.\d+)?) less gold$/,
    numericEffects: ["merchantsFavorDiscount"],
  },
  "plague-doctors-mask": {
    pattern:
      /^at the start of your turn, cleanse up to ([+-]?\d+(?:\.\d+)?) poison and deal half the amount cleansed as poison damage$/,
    numericEffects: ["plagueDoctorPoisonCleanse"],
  },
  "mortar-and-pestle": {
    pattern: /^deal ([+-]?\d+(?:\.\d+)?) poison damage when you use a potion$/,
    numericEffects: ["mortarPestlePoisonOnPotionUse"],
  },
  "sundering-charm": {
    pattern: /^your physical and stun damage removes ([+-]?\d+(?:\.\d+)?) enemy armor$/,
    numericEffects: ["sunderingArmorPiercing"],
  },
  "resonant-chimes": {
    pattern: /^when you play ([+-]?\d+(?:\.\d+)?) or more cards in a single turn, gain ([+-]?\d+(?:\.\d+)?) mana$/,
    numericEffects: ["resonantChimeCardsRequired", "resonantChimeMana"],
  },
  "smugglers-map": {
    pattern: /^gold rewards from combat are increased by ([+-]?\d+(?:\.\d+)?)$/,
    numericEffects: ["smugglersMapGoldBonus"],
  },
  "groves-favor": {
    pattern: /^gain ([+-]?\d+(?:\.\d+)?) thorns when you restore health$/,
    numericEffects: ["grovesFavorThornsOnHealthRestore"],
  },
  "companions-collar": {
    pattern: /^increases companion damage by ([+-]?\d+(?:\.\d+)?)$/,
    numericEffects: ["companionDamageBonus"],
  },
  "frozen-pocketwatch": {
    pattern: /^freeze effects last ([+-]?\d+(?:\.\d+)?) turn longer$/,
    numericEffects: ["freezeDurationExtension"],
  },
  thunderstone: {
    pattern: /^when you stun an enemy, deal ([+-]?\d+(?:\.\d+)?) nature damage$/,
    numericEffects: ["thunderstoneDamageOnStun"],
  },
  "lucky-clover": {
    pattern: /^nature damage has a ([+-]?\d+(?:\.\d+)?)% chance to grant gold equal to the damage dealt$/,
    numericEffects: ["luckyCloverGoldChance"],
  },
};

export function validateTrinketDescriptionParity(trinket: TrinketEntry): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  const addIssue = (message: string) => {
    issues.push({ severity: "error", area: "trinkets", id: trinket.id, message });
  };
  const rule = isTrinketId(trinket.id) ? TRINKET_PARITY_RULES[trinket.id] : undefined;
  if (!rule) {
    addIssue(`Trinket "${trinket.id}" has no registered description parity rule`);
    return issues;
  }

  const expectedKeys = new Set<string>([...rule.numericEffects, ...(rule.requiredBooleanEffects ?? [])]);
  for (const key of expectedKeys) {
    if (!Object.hasOwn(trinket.effects, key)) addIssue(`Missing required effect: ${key}`);
  }
  for (const key of Object.keys(trinket.effects)) {
    if (!expectedKeys.has(key)) addIssue(`Unexpected effect: ${key}`);
  }

  const prose = trinket.descriptionLines.join(" ").toLowerCase().replace(/\s+/g, " ").trim();
  const match = rule.pattern.exec(prose);
  if (!match) {
    addIssue(`Trinket "${trinket.id}" description does not match its required trigger and outcome`);
  } else {
    for (const [index, key] of rule.numericEffects.entries()) {
      const described = Number(match[index + 1]);
      if (trinket.effects[key] !== described) {
        addIssue(`Effect ${key} value ${String(trinket.effects[key])} does not match described amount ${described}`);
      }
    }
  }
  for (const key of rule.requiredBooleanEffects ?? []) {
    if (trinket.effects[key] !== true) addIssue(`Effect ${key} must be true`);
  }
  return issues;
}

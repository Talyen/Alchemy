import type { TalentEffectManifest } from "../types";
import { talentPool } from "./pool";
import type { TalentEffectOperation, UnlockedTalents } from "./types";
import { DEFAULT_TALENT_EFFECTS } from "./manifest-defaults";

export function createEmptyTalentManifest(): TalentEffectManifest {
  return {
    ...DEFAULT_TALENT_EFFECTS,
    companionBondLevels: { ...DEFAULT_TALENT_EFFECTS.companionBondLevels },
  };
}

// Collapse unlocked IDs into a flat manifest once per change/battle. Combat code reads
// numbers/booleans directly, which keeps turn resolution decoupled from talent grid data.
export function computeTalentEffects(unlockedTalents: UnlockedTalents): TalentEffectManifest {
  const manifest = createEmptyTalentManifest();
  const unlockedIds = new Set(Object.values(unlockedTalents).flat());

  for (const talent of talentPool) {
    if (!unlockedIds.has(talent.id)) continue;
    for (const effect of talent.effects ?? []) {
      applyTalentEffect(manifest, effect);
    }
  }

  return manifest;
}

function applyTalentEffect(manifest: TalentEffectManifest, effect: TalentEffectOperation) {
  // Data-driven talent effects keep descriptions and mechanics adjacent in talentPool.
  if (effect.kind === "add") {
    manifest[effect.field] += effect.amount;
    return;
  }

  setTalentEffect(manifest, effect.field, effect.value);
}

function setTalentEffect<K extends keyof TalentEffectManifest>(
  manifest: TalentEffectManifest,
  field: K,
  value: TalentEffectManifest[K],
) {
  // Centralized assignment keeps the generic reducer type-safe for all manifest field shapes.
  manifest[field] = value;
}

import { LOOT_ACCOUNT_MULTIPLIERS, LOOT_DEPTH_CURVES, LOOT_SOURCE_WEIGHTS } from "@/lib/game-constants";
import type { DifficultyId } from "@/lib/game-data";
import { clamp, lerp } from "@/lib/math";
import { pickWeighted } from "@/lib/rng";

export type LootSource = keyof typeof LOOT_SOURCE_WEIGHTS;
type LootKind = keyof (typeof LOOT_SOURCE_WEIGHTS)[LootSource];
/**
 * Fallback preference when scaling and pool filtering empty every weight.
 * Basic first so premium-only sources (e.g. an early boss) still offer Basic
 * Gear; cards are the terminal combat fallback when no Gear is available.
 */
const LOOT_FALLBACK_ORDER: readonly LootKind[] = ["basic", "card", "astral", "unique", "boon", "trinket"];
export type PremiumLootKind = keyof typeof LOOT_DEPTH_CURVES;
export type LootWeights = Record<LootKind, number>;
export type LootAvailability = Partial<Record<LootKind, boolean>>;
export type LootGroup = "card" | "gear" | "boon" | "trinket";
export type LootGearRarity = "basic" | "astral" | "unique";

export interface LootProgress {
  depth: number;
  highestCompletedDifficulty: DifficultyId | null;
}

export function lootDepthMultiplier(kind: PremiumLootKind, depth: number): number {
  const curve = LOOT_DEPTH_CURVES[kind];
  const first = curve[0];
  if (!first || depth < first.depth) return 0;
  for (let index = 1; index < curve.length; index += 1) {
    const before = curve[index - 1];
    const after = curve[index];
    if (before && after && depth <= after.depth)
      return lerp(before.weight, after.weight, (depth - before.depth) / (after.depth - before.depth));
  }
  const last = curve[curve.length - 1];
  return last ? last.weight : 0;
}

export function isLootEligible(kind: PremiumLootKind, depth: number): boolean {
  return lootDepthMultiplier(kind, depth) > 0;
}

export function lootAccountMultiplier(difficulty: DifficultyId | null): number {
  return LOOT_ACCOUNT_MULTIPLIERS[difficulty ?? "none"];
}

function normalizeLootWeights(weights: LootWeights, available: LootAvailability = {}): LootWeights {
  // Callers supply a fresh, private record. Preserve its key order so sums
  // and seeded bucket boundaries retain their existing floating-point values.
  const kinds = Object.keys(weights) as LootKind[];
  let total = 0;
  for (const kind of kinds) {
    if (available[kind] === false) weights[kind] = 0;
    total += weights[kind];
  }
  if (total === 0) {
    const fallback = LOOT_FALLBACK_ORDER.find((kind) => available[kind] !== false);
    if (fallback) weights[fallback] = 1;
    return weights;
  }
  for (const kind of kinds) weights[kind] /= total;
  return weights;
}

export function resolveLootWeights({
  source,
  progress,
  astralChanceBonus = 0,
  available = {},
}: {
  source: LootSource;
  progress: LootProgress;
  astralChanceBonus?: number;
  available?: LootAvailability;
}): LootWeights {
  const weights: LootWeights = { ...LOOT_SOURCE_WEIGHTS[source] };
  const accountMultiplier = lootAccountMultiplier(progress.highestCompletedDifficulty);
  for (const kind of Object.keys(LOOT_DEPTH_CURVES) as PremiumLootKind[]) {
    weights[kind] *= lootDepthMultiplier(kind, progress.depth) * accountMultiplier;
  }
  if (isLootEligible("astral", progress.depth) && available.astral !== false && available.basic !== false) {
    const transfer = weights.basic * clamp(astralChanceBonus, 0, 1);
    weights.basic -= transfer;
    weights.astral += transfer;
  }
  return normalizeLootWeights(weights, available);
}

function pickLootKind<T extends string>(weights: Record<T, number>, rng: () => number): T {
  const selected = pickWeighted(Object.keys(weights) as T[], (kind) => weights[kind], rng);
  if (selected === undefined) throw new Error("Cannot select from an empty loot pool");
  return selected;
}

function lootGroupWeights(weights: LootWeights): Record<LootGroup, number> {
  return {
    card: weights.card,
    gear: weights.basic + weights.astral + weights.unique,
    boon: weights.boon,
    trinket: weights.trinket,
  };
}

export function rollLootGroup(weights: LootWeights, rng: () => number): LootGroup {
  return pickLootKind(lootGroupWeights(weights), rng);
}

export function rollLootGearRarity(
  weights: LootWeights,
  rng: () => number,
  available: LootAvailability = {},
): LootGearRarity {
  const eligible = normalizeLootWeights(
    { ...weights, card: 0, boon: 0, trinket: 0 },
    { ...available, card: false, boon: false, trinket: false },
  );
  return pickLootKind({ basic: eligible.basic, astral: eligible.astral, unique: eligible.unique }, rng);
}

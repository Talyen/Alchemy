import { LOOT_ACCOUNT_MULTIPLIERS, LOOT_DEPTH_CURVES, LOOT_SOURCE_WEIGHTS } from "@/lib/game-constants";
import type { DifficultyId } from "@/lib/game-data";
import { clamp, lerp } from "@/lib/math";

export type LootSource = keyof typeof LOOT_SOURCE_WEIGHTS;
/** Every loot kind in the source-weight tables. Tests assert each source carries exactly these keys. */
export const LOOT_KINDS = ["card", "basic", "boon", "astral", "trinket", "unique"] as const;
type LootKind = (typeof LOOT_KINDS)[number];
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
  const filtered = { ...weights };
  for (const kind of Object.keys(filtered) as LootKind[]) {
    if (available[kind] === false) filtered[kind] = 0;
  }
  let total = Object.values(filtered).reduce((sum, weight) => sum + weight, 0);
  if (total === 0) {
    const fallback = LOOT_FALLBACK_ORDER.find((kind) => available[kind] !== false);
    if (fallback) filtered[fallback] = 1;
    total = Object.values(filtered).reduce((sum, weight) => sum + weight, 0);
  }
  if (total > 0) {
    for (const kind of Object.keys(filtered) as LootKind[]) filtered[kind] /= total;
  }
  return filtered;
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
  // Astral bonuses transfer Basic weight before depth scaling. Sources with no
  // Basic weight (notably boss) are unaffected by the bonus by definition.
  const transfer = clamp(astralChanceBonus, 0, weights.basic);
  weights.basic -= transfer;
  weights.astral += transfer;
  const accountMultiplier = lootAccountMultiplier(progress.highestCompletedDifficulty);
  for (const kind of Object.keys(LOOT_DEPTH_CURVES) as PremiumLootKind[]) {
    weights[kind] *= lootDepthMultiplier(kind, progress.depth) * accountMultiplier;
  }
  return normalizeLootWeights(weights, available);
}

function pickWeighted<T extends string>(weights: Record<T, number>, rng: () => number): T {
  const total = Object.values<number>(weights).reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) throw new Error("Cannot select from an empty loot pool");
  const draw = rng();
  if (!(draw >= 0 && draw < 1)) throw new Error("Rng draw out of range");
  let remaining = draw * total;
  let last: T | undefined;
  // Half-open buckets: a draw landing exactly on a boundary falls through to
  // the next kind, and float rounding falls back to the last positive kind.
  for (const kind of Object.keys(weights) as T[]) {
    if (weights[kind] <= 0) continue;
    last = kind;
    remaining -= weights[kind];
    if (remaining < 0) return kind;
  }
  if (!last) throw new Error("Cannot select from an empty loot pool");
  return last;
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
  return pickWeighted(lootGroupWeights(weights), rng);
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
  return pickWeighted({ basic: eligible.basic, astral: eligible.astral, unique: eligible.unique }, rng);
}

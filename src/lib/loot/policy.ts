import { LOOT_ACCOUNT_MULTIPLIERS, LOOT_DEPTH_CURVES, LOOT_SOURCE_WEIGHTS } from "@/lib/game-constants";
import type { DifficultyId } from "@/lib/game-data";
import { lerp } from "@/lib/math";

export type LootSource = keyof typeof LOOT_SOURCE_WEIGHTS;
type LootKind = keyof (typeof LOOT_SOURCE_WEIGHTS)[LootSource];
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
  if (depth < first.depth) return 0;
  for (let index = 1; index < curve.length; index += 1) {
    const before = curve[index - 1]!;
    const after = curve[index]!;
    if (depth <= after.depth)
      return lerp(before.weight, after.weight, (depth - before.depth) / (after.depth - before.depth));
  }
  return curve[curve.length - 1]!.weight;
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
    if (available.basic !== false) filtered.basic = 1;
    else if (available.card !== false) filtered.card = 1;
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
  const transfer = Math.min(weights.basic, Math.max(0, astralChanceBonus));
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
  for (const kind of Object.keys(weights) as T[]) {
    if (weights[kind] <= 0) continue;
    last = kind;
    remaining -= weights[kind];
    if (remaining < 0) return kind;
  }
  return last!;
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

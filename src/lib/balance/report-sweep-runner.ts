import type { BattleCard, CharacterId, TalentEffectManifest } from "@/lib/game-data";
import type { GearEffectManifest } from "@/lib/gear";
import { reportTierForPreset, reportTierRecord } from "./report-catalog";
import type { PairedTierRow } from "./report-model";
import type { ReportRunOptions } from "./report-options";
import { combinePairedWinStats, makePairedDelta, pairedWinStats, type PairedWinStats } from "./report-rankings";
import { DEFAULT_MAX_TURNS } from "./simulator";
import { simulateWinSeries, type WinSeries } from "./simulator-batch";
import type { BalanceBatchConfig, TalentPreset } from "./simulator-types";

export interface BalanceScenarioConfig {
  characterId: CharacterId;
  enemyId: string;
  depth: number;
  preset: TalentPreset;
  seed: number;
  deck?: BattleCard[];
  trinketIds?: string[];
  gearEffects?: GearEffectManifest;
  talentEffects?: TalentEffectManifest;
  iterations?: number;
}

interface SweepVariant {
  id: string;
  scenario: BalanceScenarioConfig;
  referenceSide?: "baseline" | "treatment";
}

export interface PairedSweepGroup {
  reference: BalanceScenarioConfig;
  variants: Iterable<SweepVariant>;
}

export function buildBalanceBatchConfig(options: ReportRunOptions, config: BalanceScenarioConfig): BalanceBatchConfig {
  return {
    characterId: config.characterId,
    enemyId: config.enemyId,
    depth: config.depth,
    talentPreset: config.preset,
    difficultyModifiers: reportTierForPreset(config.preset).difficultyModifiers,
    loadoutMode: options.loadoutMode,
    iterations: config.iterations ?? options.iterations,
    seed: config.seed,
    maxTurns: DEFAULT_MAX_TURNS,
    policy: options.policy,
    ...(options.appliesFightPacing === undefined ? {} : { appliesFightPacing: options.appliesFightPacing }),
    ...(config.deck ? { deck: config.deck } : {}),
    ...(config.trinketIds ? { trinketIds: config.trinketIds } : {}),
    ...(config.gearEffects ? { gearEffects: config.gearEffects } : {}),
    ...(config.talentEffects ? { talentEffects: config.talentEffects } : {}),
  };
}

function assertMatchedPair(reference: BalanceBatchConfig, variant: BalanceBatchConfig, id: string): void {
  if (
    reference.characterId !== variant.characterId ||
    reference.enemyId !== variant.enemyId ||
    reference.depth !== variant.depth ||
    reference.talentPreset !== variant.talentPreset ||
    reference.seed !== variant.seed ||
    reference.iterations !== variant.iterations
  ) {
    throw new Error(`Balance sweep ${id} must use matched character, enemy, depth, tier, seed, and iterations`);
  }
}

type PairedStatsById = Map<string, Map<TalentPreset, PairedWinStats[]>>;

function addComparison(collected: PairedStatsById, tier: TalentPreset, id: string, stats: PairedWinStats): void {
  const byTier = collected.get(id) ?? new Map<TalentPreset, PairedWinStats[]>();
  const entries = byTier.get(tier) ?? [];
  entries.push(stats);
  byTier.set(tier, entries);
  collected.set(id, byTier);
}

function rowsFromComparisons(collected: PairedStatsById): PairedTierRow[] {
  return [...collected.entries()].map(([id, byTier]) => ({
    id,
    deltas: reportTierRecord((tier) => makePairedDelta(id, combinePairedWinStats(byTier.get(tier) ?? []))),
  }));
}

export function runPairedSweep(options: ReportRunOptions, groups: Iterable<PairedSweepGroup>): PairedTierRow[] {
  const collected: PairedStatsById = new Map();
  for (const group of groups) {
    const referenceConfig = buildBalanceBatchConfig(options, group.reference);
    let reference: WinSeries | undefined;
    for (const { id, scenario, referenceSide = "baseline" } of group.variants) {
      const variantConfig = buildBalanceBatchConfig(options, scenario);
      assertMatchedPair(referenceConfig, variantConfig, id);
      // Every variant in a group compares with this exact simulation result.
      reference ??= simulateWinSeries(referenceConfig);
      const variant = simulateWinSeries(variantConfig);
      const baseline = referenceSide === "baseline" ? reference : variant;
      const treatment = referenceSide === "treatment" ? reference : variant;
      addComparison(
        collected,
        group.reference.preset,
        id,
        pairedWinStats(baseline.outcomes, treatment.outcomes, baseline.turns, treatment.turns),
      );
    }
  }
  return rowsFromComparisons(collected);
}

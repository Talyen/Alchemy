// Opt-in balance-report scenario matrix. Pure orchestration over simulateBatch.
import {
  cardById,
  cardLibrary,
  characters,
  companionLibrary,
  computeTalentEffects,
  enemyBestiary,
  enemiesByType,
  getCardKeywords,
  trinketLibrary,
  type BattleCard,
  type CharacterId,
  type CompanionId,
  type DifficultyModifier,
} from "@/lib/game-data";
import { createRunStreamRng } from "@/lib/run-rng";
import { sampleItems } from "@/lib/utils";
import { ANOMALY_METRICS, ANOMALY_THRESHOLD_BY_PRESET, getAnomalyThreshold } from "./anomalies";
import {
  buildClassSimDeck,
  cardMatchesAffinity,
  CLASS_SIM_AFFINITY_EXTRAS,
  insertCardIntoDeck,
  removeCardIdFromDeck,
  removeCompanionSummonFromDeck,
  WILDCARD_SIM_DECK_SIZE,
} from "./class-deck";
import { combatTalentsInPoolOrder } from "./combat-talent";
import { companionIdsFromDeck } from "./homestead-preset";
import { TIER_GOLD, TYPICAL_VITALITY_COMBATS, type BalanceLoadoutMode } from "./loadout-preset";
import type { AnomalyMetricRow, AnomalyReportRow, BalanceReportModel, ClassMatchupRow } from "./report-model";
import {
  combineRateCells,
  emptyRateCell,
  makePairedDelta,
  mean,
  topPlayedCards,
  type PairedDelta,
  type RateCell,
} from "./report-rankings";
import { simulateBatch, simulateBatchSummary } from "./simulator-batch";
import type { BalanceBatchResult, BalancePlayPolicy } from "./simulator-types";
import {
  buildPresetUnlockedTalents,
  LATE_AFFINITY_TALENT_CAP,
  LATE_OTHER_TALENT_COUNT,
  MID_AFFINITY_TALENT_COUNT,
  MID_OTHER_TALENT_COUNT,
  withTalent,
  withoutTalent,
} from "./talent-preset";
import type { TalentPreset } from "./types";

const ADVENTURER_MODIFIERS: DifficultyModifier[] = [
  { kind: "enemy-health-multiplier", amount: 1.3 },
  { kind: "enemy-damage-multiplier", amount: 1.3 },
];
const LEGEND_MODIFIERS: DifficultyModifier[] = [
  { kind: "enemy-health-multiplier", amount: 2.8 },
  { kind: "enemy-damage-multiplier", amount: 1.6 },
];

const REPORT_TIERS: Array<{
  label: "Early" | "Mid" | "Late";
  preset: TalentPreset;
  depthOffset: number;
  difficultyModifiers: DifficultyModifier[];
}> = [
  { label: "Early", preset: "early", depthOffset: 0, difficultyModifiers: [] },
  { label: "Mid", preset: "mid", depthOffset: 8, difficultyModifiers: ADVENTURER_MODIFIERS },
  { label: "Late", preset: "late", depthOffset: 16, difficultyModifiers: LEGEND_MODIFIERS },
];

const BOON_GAUNTLET = [
  { enemyId: "skeleton", depthDelta: 1 },
  { enemyId: "goblin", depthDelta: 3 },
  { enemyId: "mimic", depthDelta: 5 },
  { enemyId: "iron-bear", depthDelta: 7 },
] as const;

export interface ReportRunOptions {
  iterations: number;
  trinketIterations: number;
  cardIterations: number;
  policy: BalancePlayPolicy;
  loadoutMode: BalanceLoadoutMode;
  deckSeeds: number;
  appliesFightPacing?: boolean;
}

export function appliesFightPacingFromEnv(raw = process.env.ALCHEMY_BALANCE_PACING): boolean {
  if (raw == null || raw === "") return true;
  const normalized = raw.trim().toLowerCase();
  return normalized !== "off" && normalized !== "0" && normalized !== "false";
}

function cellFromBatch(batch: BalanceBatchResult): RateCell {
  return {
    winRate: batch.winRate,
    timeoutRate: batch.timeoutRate,
    averageTurns: batch.averageTurns,
    averageHealthRemaining: batch.averageHealthRemaining,
    n: batch.iterations,
  };
}

function buildRandomDeck(seed: number, size = 10): BattleCard[] {
  const rng = createRunStreamRng(seed, "world");
  return sampleItems(cardLibrary, size, rng);
}

function buildFixedCardDeck(target: BattleCard, seed: number, size = 10): BattleCard[] {
  const others = buildRandomDeck(seed, size).filter((card) => card.id !== target.id);
  return [target, ...others.slice(0, size - 1)];
}

function characterIds(): CharacterId[] {
  return Object.keys(characters) as CharacterId[];
}

function runBatch(
  options: ReportRunOptions,
  config: {
    characterId: CharacterId;
    enemyId: string;
    depth: number;
    preset: TalentPreset;
    seed: number;
    deck?: BattleCard[];
    trinketIds?: string[];
    talentEffects?: BalanceBatchResult["config"]["talentEffects"];
    iterations?: number;
  },
): BalanceBatchResult {
  return simulateBatch({
    characterId: config.characterId,
    enemyId: config.enemyId,
    depth: config.depth,
    talentPreset: config.preset,
    difficultyModifiers: REPORT_TIERS.find((tier) => tier.preset === config.preset)?.difficultyModifiers ?? [],
    loadoutMode: options.loadoutMode,
    iterations: config.iterations ?? options.iterations,
    seed: config.seed,
    maxTurns: 30,
    policy: options.policy,
    ...(options.appliesFightPacing === undefined ? {} : { appliesFightPacing: options.appliesFightPacing }),
    ...(config.deck ? { deck: config.deck } : {}),
    ...(config.trinketIds ? { trinketIds: config.trinketIds } : {}),
    ...(config.talentEffects ? { talentEffects: config.talentEffects } : {}),
  });
}

function runBatchSummary(
  options: ReportRunOptions,
  config: {
    characterId: CharacterId;
    enemyId: string;
    depth: number;
    preset: TalentPreset;
    seed: number;
    deck?: BattleCard[];
    trinketIds?: string[];
    talentEffects?: BalanceBatchResult["config"]["talentEffects"];
    iterations?: number;
  },
): BalanceBatchResult {
  return simulateBatchSummary({
    characterId: config.characterId,
    enemyId: config.enemyId,
    depth: config.depth,
    talentPreset: config.preset,
    difficultyModifiers: REPORT_TIERS.find((tier) => tier.preset === config.preset)?.difficultyModifiers ?? [],
    loadoutMode: options.loadoutMode,
    iterations: config.iterations ?? options.iterations,
    seed: config.seed,
    maxTurns: 30,
    policy: options.policy,
    ...(options.appliesFightPacing === undefined ? {} : { appliesFightPacing: options.appliesFightPacing }),
    ...(config.deck ? { deck: config.deck } : {}),
    ...(config.trinketIds ? { trinketIds: config.trinketIds } : {}),
    ...(config.talentEffects ? { talentEffects: config.talentEffects } : {}),
  });
}

function shouldLogBalanceProgress(): boolean {
  return Boolean(process.env.ALCHEMY_BALANCE_VERBOSE) || Boolean(process.env.ALCHEMY_BALANCE_PROGRESS);
}

function withPhaseTiming<T>(label: string, fn: () => T): T {
  if (!shouldLogBalanceProgress()) return fn();
  const start = Date.now();
  process.stdout.write(`[balance] ${label}… `);
  const result = fn();
  const ms = Date.now() - start;
  process.stdout.write(`done ${ms}ms\n`);
  return result;
}

interface CoreRow {
  characterId: CharacterId;
  enemyId: string;
  enemyType: string;
  tier: "Early" | "Mid" | "Late";
  cell: RateCell;
  cardPlayCounts: Record<string, number>;
  results: BalanceBatchResult["results"];
}

function runCoreScenarios(options: ReportRunOptions): CoreRow[] {
  const rows: CoreRow[] = [];
  let seed = 1000;

  for (const tier of REPORT_TIERS) {
    const o = tier.depthOffset;
    for (const characterId of characterIds()) {
      const matchups: Array<{ enemyId: string; enemyType: string; depth: number }> = [];
      for (const enemy of enemiesByType.normal) {
        for (const depth of [o, o + 3, o + 6]) matchups.push({ enemyId: enemy.id, enemyType: "normal", depth });
      }
      for (const enemy of enemiesByType.elite) {
        for (const depth of [o + 2, o + 5, o + 7]) matchups.push({ enemyId: enemy.id, enemyType: "elite", depth });
      }
      for (const enemy of enemiesByType.boss) {
        matchups.push({ enemyId: enemy.id, enemyType: "boss", depth: o + 7 });
      }

      for (const matchup of matchups) {
        const batches: BalanceBatchResult[] = [];
        for (let deckIndex = 0; deckIndex < options.deckSeeds; deckIndex += 1) {
          const deck = buildClassSimDeck(characterId, tier.preset, seed + deckIndex);
          batches.push(
            runBatch(options, {
              characterId,
              enemyId: matchup.enemyId,
              depth: matchup.depth,
              preset: tier.preset,
              seed: seed + deckIndex,
              deck,
            }),
          );
        }
        seed += 1000;
        const cardPlayCounts: Record<string, number> = {};
        const results = batches.flatMap((batch) => batch.results);
        for (const batch of batches) {
          for (const [cardId, count] of Object.entries(batch.cardPlayCounts)) {
            cardPlayCounts[cardId] = (cardPlayCounts[cardId] ?? 0) + count;
          }
        }
        rows.push({
          characterId,
          enemyId: matchup.enemyId,
          enemyType: matchup.enemyType,
          tier: tier.label,
          cell: combineRateCells(batches.map(cellFromBatch)),
          cardPlayCounts,
          results,
        });
      }
    }
  }

  return rows;
}

function averageCells(cells: RateCell[]): RateCell {
  return combineRateCells(cells);
}

function mergePairedById(byIdAndTier: Map<string, PairedDelta[]>): Array<{
  id: string;
  early: PairedDelta;
  mid: PairedDelta;
  late: PairedDelta;
}> {
  const ids = [
    ...new Set(
      [...byIdAndTier.keys()].map((key) => {
        const sep = key.indexOf(":");
        return key.slice(sep + 1);
      }),
    ),
  ];

  function avgFor(tier: string, id: string): PairedDelta {
    const list = byIdAndTier.get(`${tier}:${id}`) ?? [];
    if (list.length === 0) return makePairedDelta(id, 0, 0, 0);
    const winRate = mean(list.map((row) => row.winRate));
    const baseline = mean(list.map((row) => row.baseline));
    const n = list.reduce((total, row) => total + row.n, 0);
    return makePairedDelta(id, winRate, baseline, n);
  }

  return ids.map((id) => ({
    id,
    early: avgFor("Early", id),
    mid: avgFor("Mid", id),
    late: avgFor("Late", id),
  }));
}

function pushDelta(byId: Map<string, PairedDelta[]>, tier: string, delta: PairedDelta): void {
  const key = `${tier}:${delta.id}`;
  const list = byId.get(key) ?? [];
  list.push(delta);
  byId.set(key, list);
}

function runTrinketSweep(options: ReportRunOptions): ReturnType<typeof mergePairedById> {
  const byId = new Map<string, PairedDelta[]>();
  let seed = 50_000;

  for (const tier of REPORT_TIERS) {
    for (const characterId of characterIds()) {
      for (const scenario of BOON_GAUNTLET) {
        const deck = buildRandomDeck(seed);
        const shared = {
          characterId,
          enemyId: scenario.enemyId,
          depth: tier.depthOffset + scenario.depthDelta,
          preset: tier.preset,
          seed,
          deck,
          iterations: options.trinketIterations,
        };
        const baseline = runBatchSummary(options, { ...shared, trinketIds: [] });
        for (const trinket of trinketLibrary) {
          const treatment = runBatchSummary(options, { ...shared, trinketIds: [trinket.id] });
          pushDelta(
            byId,
            tier.label,
            makePairedDelta(trinket.id, treatment.winRate, baseline.winRate, treatment.iterations),
          );
        }
        seed += 1000;
      }
    }
  }

  return mergePairedById(byId);
}

function runCardSweepIsolated(options: ReportRunOptions, enemyId: string): ReturnType<typeof mergePairedById> {
  const byId = new Map<string, PairedDelta[]>();
  const ids = characterIds();
  const battleIterations = Math.max(10, Math.floor(options.iterations / 10));

  for (const tier of REPORT_TIERS) {
    for (let idx = 0; idx < options.cardIterations; idx += 1) {
      const characterId = ids[idx % ids.length]!;
      const deckSeed = 200_000 + idx;
      const baselineDeck = buildRandomDeck(deckSeed);
      const baseline = runBatchSummary(options, {
        characterId,
        enemyId,
        depth: tier.depthOffset + 2,
        preset: tier.preset,
        seed: deckSeed + 100_000,
        deck: baselineDeck,
        trinketIds: [],
        iterations: battleIterations,
      });
      for (const card of cardLibrary) {
        const treatment = runBatchSummary(options, {
          characterId,
          enemyId,
          depth: tier.depthOffset + 2,
          preset: tier.preset,
          seed: deckSeed + 100_000,
          deck: buildFixedCardDeck(card, deckSeed),
          trinketIds: [],
          iterations: battleIterations,
        });
        pushDelta(
          byId,
          tier.label,
          makePairedDelta(card.id, treatment.winRate, baseline.winRate, treatment.iterations),
        );
      }
    }
  }

  return mergePairedById(byId);
}

function runCardSweepInClass(options: ReportRunOptions): ReturnType<typeof mergePairedById> {
  const byId = new Map<string, PairedDelta[]>();
  const battleIterations = Math.max(10, Math.floor(options.iterations / 5));
  let seed = 400_000;

  for (const tier of REPORT_TIERS) {
    for (const characterId of characterIds()) {
      const affinity = characters[characterId].keywords;
      const baseDeck = buildClassSimDeck(characterId, tier.preset, seed);
      for (const card of cardLibrary) {
        const keywords = getCardKeywords(card);
        const matches = characterId === "wildcard" || keywords.length === 0 || cardMatchesAffinity(card, affinity);
        if (!matches) continue;
        const alreadyIn = baseDeck.some((entry) => entry.id === card.id);
        const baselineDeck = alreadyIn ? removeCardIdFromDeck(baseDeck, card.id) : baseDeck;
        const treatmentDeck = alreadyIn ? baseDeck : insertCardIntoDeck(baseDeck, card);
        const baseline = runBatchSummary(options, {
          characterId,
          enemyId: "skeleton",
          depth: tier.depthOffset + 2,
          preset: tier.preset,
          seed,
          deck: baselineDeck,
          trinketIds: [],
          iterations: battleIterations,
        });
        const treatment = runBatchSummary(options, {
          characterId,
          enemyId: "skeleton",
          depth: tier.depthOffset + 2,
          preset: tier.preset,
          seed,
          deck: treatmentDeck,
          trinketIds: [],
          iterations: battleIterations,
        });
        pushDelta(
          byId,
          tier.label,
          makePairedDelta(card.id, treatment.winRate, baseline.winRate, treatment.iterations),
        );
      }
      seed += 1000;
    }
  }

  return mergePairedById(byId);
}

function runTalentSweep(options: ReportRunOptions): ReturnType<typeof mergePairedById> {
  const byId = new Map<string, PairedDelta[]>();
  let seed = 600_000;
  const iterations = options.trinketIterations;

  for (const tier of REPORT_TIERS) {
    for (const characterId of characterIds()) {
      const keywords = characters[characterId].keywords;
      const unlocked = buildPresetUnlockedTalents(keywords, tier.preset);
      const affinityTalents = keywords.flatMap((keyword) => combatTalentsInPoolOrder(keyword));
      const deck = buildClassSimDeck(characterId, tier.preset, seed);
      for (const talent of affinityTalents) {
        const baseUnlocked = withoutTalent(unlocked, talent);
        const treatUnlocked = withTalent(unlocked, talent);
        const baseEffects = computeTalentEffects(baseUnlocked);
        const treatEffects = computeTalentEffects(treatUnlocked);
        for (const scenario of BOON_GAUNTLET) {
          const shared = {
            characterId,
            enemyId: scenario.enemyId,
            depth: tier.depthOffset + scenario.depthDelta,
            preset: tier.preset,
            seed,
            deck,
            iterations,
          };
          const baseline = runBatchSummary(options, { ...shared, talentEffects: baseEffects });
          const treatment = runBatchSummary(options, { ...shared, talentEffects: treatEffects });
          pushDelta(
            byId,
            tier.label,
            makePairedDelta(talent.id, treatment.winRate, baseline.winRate, treatment.iterations),
          );
        }
      }
      seed += 1000;
    }
  }

  return mergePairedById(byId);
}

function summonCards(): BattleCard[] {
  return cardLibrary.filter((card) => card.effects.some((effect) => effect.kind === "summon-companion"));
}

function runCompanionSweep(options: ReportRunOptions): ReturnType<typeof mergePairedById> {
  const byId = new Map<string, PairedDelta[]>();
  let seed = 700_000;
  const iterations = options.trinketIterations;
  const summons = summonCards();

  for (const tier of REPORT_TIERS) {
    for (const characterId of characterIds()) {
      const classKeywords = characters[characterId].keywords;
      const deck = buildClassSimDeck(characterId, tier.preset, seed);
      const relevant = summons.filter((card) => {
        const companionEffect = card.effects.find((effect) => effect.kind === "summon-companion");
        if (!companionEffect || companionEffect.kind !== "summon-companion") return false;
        return (
          classKeywords.includes("companion") ||
          companionIdsFromDeck(deck).includes(companionEffect.companionId) ||
          cardMatchesAffinity(card, classKeywords)
        );
      });

      for (const card of relevant) {
        const companionEffect = card.effects.find((effect) => effect.kind === "summon-companion");
        if (!companionEffect || companionEffect.kind !== "summon-companion") continue;
        const companionId: CompanionId = companionEffect.companionId;
        if (!(companionId in companionLibrary)) continue;
        const baselineDeck = removeCompanionSummonFromDeck(insertCardIntoDeck(deck, card), companionId);
        const treatmentDeck = insertCardIntoDeck(baselineDeck, card);
        for (const scenario of BOON_GAUNTLET) {
          const shared = {
            characterId,
            enemyId: scenario.enemyId,
            depth: tier.depthOffset + scenario.depthDelta,
            preset: tier.preset,
            seed,
            iterations,
          };
          const baseline = runBatchSummary(options, { ...shared, deck: baselineDeck });
          const treatment = runBatchSummary(options, { ...shared, deck: treatmentDeck });
          pushDelta(
            byId,
            tier.label,
            makePairedDelta(companionId, treatment.winRate, baseline.winRate, treatment.iterations),
          );
        }
      }
      seed += 1000;
    }
  }

  return mergePairedById(byId);
}

function collectAnomalies(rows: CoreRow[]): { anomalies: AnomalyReportRow[]; metrics: AnomalyMetricRow[] } {
  const byField: Record<string, AnomalyReportRow> = {};
  const perTier: Record<string, Record<string, number>> = { Early: {}, Mid: {}, Late: {} };

  for (const row of rows) {
    const threshold = getAnomalyThreshold(row.tier.toLowerCase() as "early" | "mid" | "late");
    for (const sim of row.results) {
      const a = sim.anomalies;
      for (const { key, label } of ANOMALY_METRICS) {
        const value = a[key];
        if (typeof value !== "number") continue;
        perTier[row.tier]![key] = Math.max(perTier[row.tier]![key] ?? 0, value);
        if (value <= threshold) continue;
        byField[key] ??= { field: label, maxValue: 0, battles: 0, peakScenario: "" };
        const entry = byField[key];
        entry.battles += 1;
        if (value > entry.maxValue) {
          entry.maxValue = value;
          const cardId =
            key === "maxSingleHitDamageToEnemy"
              ? a.maxSingleHitDamageToEnemyCardId
              : key === "maxSingleHitDamageToPlayer"
                ? a.maxSingleHitDamageToPlayerCardId
                : "";
          const stat =
            key === "maxSingleHitDamageToEnemy"
              ? a.maxSingleHitDamageToEnemyStat
              : key === "maxSingleHitDamageToPlayer"
                ? a.maxSingleHitDamageToPlayerStat
                : "";
          const card = cardId ? (cardById[cardId]?.title ?? cardId) : "";
          entry.peakScenario = [`${sim.characterId} vs ${sim.enemyId} (${row.tier})`, stat, card]
            .filter(Boolean)
            .join(" · ");
        }
      }
    }
  }

  const thresholds = REPORT_TIERS.map((tier) => ANOMALY_THRESHOLD_BY_PRESET[tier.preset]);
  const metrics: AnomalyMetricRow[] = ANOMALY_METRICS.map(({ key, label }) => ({
    field: label,
    early: perTier.Early?.[key] ?? 0,
    mid: perTier.Mid?.[key] ?? 0,
    late: perTier.Late?.[key] ?? 0,
    thresholds,
  })).sort((a, b) => b.late - a.late);

  return {
    anomalies: Object.values(byField).sort((a, b) => b.maxValue - a.maxValue),
    metrics,
  };
}

function buildClassMatchups(rows: CoreRow[]): ClassMatchupRow[] {
  const keys = new Set(rows.map((row) => `${row.characterId}|${row.enemyId}|${row.enemyType}`));
  return [...keys].map((key) => {
    const [characterId, enemyId, enemyType] = key.split("|") as [CharacterId, string, string];
    const forKey = rows.filter(
      (row) => row.characterId === characterId && row.enemyId === enemyId && row.enemyType === enemyType,
    );
    const late = forKey.find((row) => row.tier === "Late");
    return {
      characterId,
      enemyId,
      enemyType,
      early: forKey.find((row) => row.tier === "Early")?.cell ?? emptyRateCell(),
      mid: forKey.find((row) => row.tier === "Mid")?.cell ?? emptyRateCell(),
      late: late?.cell ?? emptyRateCell(),
      topCardsLate: late ? topPlayedCards(late.cardPlayCounts) : [],
    };
  });
}

export function buildBalanceReport(options: ReportRunOptions): BalanceReportModel {
  const core = withPhaseTiming("core scenarios", () => runCoreScenarios(options));
  const { anomalies, metrics } = withPhaseTiming("anomalies", () => collectAnomalies(core));

  const enemyRows = [...new Set(core.map((row) => row.enemyId))].map((id) => {
    const forId = core.filter((row) => row.enemyId === id);
    return {
      id,
      early: averageCells(forId.filter((row) => row.tier === "Early").map((row) => row.cell)),
      mid: averageCells(forId.filter((row) => row.tier === "Mid").map((row) => row.cell)),
      late: averageCells(forId.filter((row) => row.tier === "Late").map((row) => row.cell)),
    };
  });

  const classRows = characterIds().map((id) => {
    const forChar = core.filter((row) => row.characterId === id);
    function byType(tier: string): Record<string, RateCell> {
      const types = ["normal", "elite", "boss"];
      return Object.fromEntries(
        types.map((type) => [
          type,
          averageCells(forChar.filter((row) => row.tier === tier && row.enemyType === type).map((row) => row.cell)),
        ]),
      );
    }
    const earlyByType = byType("Early");
    const midByType = byType("Mid");
    const lateByType = byType("Late");
    return {
      id,
      early: equalWeightByType(earlyByType),
      mid: equalWeightByType(midByType),
      late: equalWeightByType(lateByType),
      earlyByType,
      midByType,
      lateByType,
    };
  });

  return {
    meta: {
      policy: options.policy,
      loadoutMode: options.loadoutMode,
      iterations: options.iterations,
      trinketIterations: options.trinketIterations,
      cardIterations: options.cardIterations,
      deckSeeds: options.deckSeeds,
    },
    enemies: enemyRows.sort((a, b) => a.late.winRate - b.late.winRate),
    classes: classRows.sort((a, b) => a.late.winRate - b.late.winRate),
    classMatchups: withPhaseTiming("class matchups", () => buildClassMatchups(core)),
    boons: withPhaseTiming("boon sweep", () => runTrinketSweep(options).sort((a, b) => a.late.delta - b.late.delta)),
    cardsIsolatedSkeleton: withPhaseTiming("card isolated (skeleton)", () =>
      runCardSweepIsolated(options, "skeleton").sort((a, b) => a.late.delta - b.late.delta),
    ),
    cardsIsolatedElite: withPhaseTiming("card isolated (elite)", () =>
      runCardSweepIsolated(options, "mimic").sort((a, b) => a.late.delta - b.late.delta),
    ),
    cardsInClass: withPhaseTiming("card in-class", () =>
      runCardSweepInClass(options).sort((a, b) => a.late.delta - b.late.delta),
    ),
    talents: withPhaseTiming("talent sweep", () => runTalentSweep(options).sort((a, b) => a.late.delta - b.late.delta)),
    companions: withPhaseTiming("companion sweep", () =>
      runCompanionSweep(options).sort((a, b) => a.late.delta - b.late.delta),
    ),
    anomalies,
    anomalyMetrics: metrics,
  };
}

function equalWeightByType(byType: Record<string, RateCell>): RateCell {
  const types = ["normal", "elite", "boss"].filter((type) => byType[type] && byType[type].n > 0);
  if (types.length === 0) return emptyRateCell();
  const nEach = 1;
  return combineRateCells(
    types.map((type) => {
      const cell = byType[type]!;
      return { ...cell, n: nEach };
    }),
  );
}

export function reportMethodologyLines(options: ReportRunOptions): string[] {
  return [
    `Core scenarios: all characters × normal/elite/boss × tier depths × ${options.deckSeeds} class-deck seeds.`,
    `Deck: starting deck + affinity extras (Early +${CLASS_SIM_AFFINITY_EXTRAS.early}, Mid +${CLASS_SIM_AFFINITY_EXTRAS.mid}, Late +${CLASS_SIM_AFFINITY_EXTRAS.late}). Wildcard random ${WILDCARD_SIM_DECK_SIZE.early}/${WILDCARD_SIM_DECK_SIZE.mid}/${WILDCARD_SIM_DECK_SIZE.late}. Alchemist +2 mixed potions.`,
    `Talents (combat-eligible only, tree order): Early none; Mid ${MID_AFFINITY_TALENT_COUNT} affinity + ${MID_OTHER_TALENT_COUNT} other; Late up to ${LATE_AFFINITY_TALENT_CAP} affinity + ${LATE_OTHER_TALENT_COUNT} other. Shop/run-only talents are excluded.`,
    `Gold: Early ${TIER_GOLD.early} / Mid ${TIER_GOLD.mid} / Late ${TIER_GOLD.late}, plus startGold from combat talents. Explicit config.gold overrides.`,
    `Loadout mode=${options.loadoutMode}. typical adds +1 max HP per affinity combat talent (Wildcard uses a 3-keyword equivalent), Vitality max HP (Mid ${TYPICAL_VITALITY_COMBATS.mid} / Late ${TYPICAL_VITALITY_COMBATS.late} estimated combats), Mid 1★ / Late 2★ homestead via computeHomesteadEffects, seeded affinity gear (Mid weapon+body, Late full set), and Mid/Late core trinkets (Grove's Favor / Tattered Pages). bare keeps talent-point HP and tier gold but omits Vitality, homestead, gear, and core trinkets. Gear uses a salted RNG stream from the fight seed so paired isolation sweeps stay matched. Boon/card isolation sweeps force trinketIds to the isolated set.`,
    `Difficulty: Early none; Mid Adventurer (HP/dmg ×1.3); Late Legend (HP ×2.8, dmg ×1.6). Room scaling uses scenario depth.`,
    `Class rankings weight Normal/Elite/Boss equally. Isolation sweeps are paired (same deck, seed, matchup). Deltas below 2 SE are marked noisy.`,
    `Play policy=${options.policy} is a skill floor: dump-hand, random wishes, no holds. greedy-damage is face damage only; greedy-effective-damage also scores DoT/status/block.`,
    `Fight pacing ${options.appliesFightPacing === false ? "off" : "on"} (hidden comeback × clock scaler; ALCHEMY_BALANCE_PACING=off measures raw kit).`,
    `Not simulated: map/shop/rewards, HP carryover, Labyrinth/Wildwood traits, multi-trinket synergies beyond the typical core pair.`,
    `Iron Bear Iron Hide picks one of armor, forge, or burn every other enemy turn.`,
  ];
}

export const TITLE_LOOKUPS = {
  enemy: Object.fromEntries(enemyBestiary.map((entry) => [entry.id, entry.title])),
  character: Object.fromEntries(Object.values(characters).map((entry) => [entry.id, entry.name])),
  boon: Object.fromEntries(trinketLibrary.map((entry) => [entry.id, entry.title])),
  card: Object.fromEntries(cardLibrary.map((entry) => [entry.id, entry.title])),
  companion: Object.fromEntries(Object.values(companionLibrary).map((entry) => [entry.id, entry.title])),
};

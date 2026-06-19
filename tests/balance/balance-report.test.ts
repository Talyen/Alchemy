import { describe, expect, it } from "vitest";
import {
  buildClassSimDeck,
  CLASS_SIM_AFFINITY_EXTRAS,
  WILDCARD_SIM_DECK_SIZE,
  simulateBatch,
  type BalanceBatchResult,
  type BalancePlayPolicy,
  type TalentPreset,
  ANOMALY_THRESHOLD_BY_PRESET,
  ANOMALY_METRICS,
  getAnomalyThreshold,
  type BattleAnomalies,
} from "@/lib/balance";
import { createSeededRng } from "@/lib/utils";
import {
  characters,
  enemyBestiary,
  trinketLibrary,
  cardLibrary,
  type BattleCard,
  type CharacterId,
  type DifficultyModifier,
} from "@/lib/game-data";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const shouldRunBalanceReport = process.env.ALCHEMY_BALANCE_SIM === "1";
const describeBalance = shouldRunBalanceReport ? describe : describe.skip;
const iterations = Number.parseInt(process.env.ALCHEMY_BALANCE_ITERATIONS ?? "100", 10);
const trinketIterations = Math.max(20, Math.floor(iterations / 2));
const cardIterations = Math.max(30, Math.floor(iterations / 3));
const policy = (process.env.ALCHEMY_BALANCE_POLICY ?? "random-playable") as BalancePlayPolicy;

const reportDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "reports");
const reportFile = join(reportDir, "balance-report.html");

const ADVENTURER_MODIFIERS: DifficultyModifier[] = [
  { kind: "enemy-health-multiplier", amount: 1.3 },
  { kind: "enemy-damage-multiplier", amount: 1.3 },
];
const LEGEND_MODIFIERS: DifficultyModifier[] = [
  { kind: "enemy-health-multiplier", amount: 1.6 },
  { kind: "enemy-damage-multiplier", amount: 1.6 },
];

const TIERS: { label: string; preset: TalentPreset; depthOffset: number; difficultyModifiers: DifficultyModifier[] }[] =
  [
    { label: "Early", preset: "early", depthOffset: 0, difficultyModifiers: [] },
    { label: "Mid", preset: "mid", depthOffset: 8, difficultyModifiers: ADVENTURER_MODIFIERS },
    { label: "Late", preset: "late", depthOffset: 16, difficultyModifiers: LEGEND_MODIFIERS },
  ];

// Lookup maps from internal ID to in-game display title.
const ENEMY_TITLES: Record<string, string> = Object.fromEntries(enemyBestiary.map((e) => [e.id, e.title]));
const CHARACTER_TITLES: Record<string, string> = Object.fromEntries(
  Object.values(characters).map((c) => [c.id, c.name]),
);
const BOON_TITLES: Record<string, string> = Object.fromEntries(trinketLibrary.map((t) => [t.id, t.title]));
const CARD_TITLES: Record<string, string> = Object.fromEntries(cardLibrary.map((c) => [c.id, c.title]));

function enemyTitle(id: string): string {
  return ENEMY_TITLES[id] ?? id;
}
function characterTitle(id: string): string {
  return CHARACTER_TITLES[id] ?? id;
}
function trinketTitle(id: string): string {
  return BOON_TITLES[id] ?? id;
}
function cardTitle(id: string): string {
  return CARD_TITLES[id] ?? id;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// --- Core scenario runner ---

type TieredResults = { tier: string; label: string; results: BalanceBatchResult[] }[];

const ALL_CARD_IDS = cardLibrary.map((c) => c.id);

function buildRandomDeck(seed: number): BattleCard[] {
  const rng = createSeededRng(seed);
  const shuffled = [...ALL_CARD_IDS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const ids = shuffled.slice(0, 10);
  return ids.map((id) => cardLibrary.find((c) => c.id === id)).filter(Boolean) as BattleCard[];
}

function runScenario(
  characterId: CharacterId,
  enemyId: string,
  depth: number,
  preset: TalentPreset,
  seed: number,
  difficultyModifiers: DifficultyModifier[],
  deck?: BattleCard[],
): BalanceBatchResult {
  return simulateBatch({
    characterId,
    enemyId,
    depth,
    deck,
    talentPreset: preset,
    difficultyModifiers,
    iterations,
    seed,
    maxTurns: 30,
    policy,
  });
}

function runCoreScenarios(): TieredResults {
  const characterIds = Object.keys(characters) as CharacterId[];
  const normalEnemies = enemyBestiary.filter((enemy) => enemy.enemyType === "normal");
  const eliteEnemies = enemyBestiary.filter((enemy) => enemy.enemyType === "elite");
  const allBossIds = enemyBestiary.filter((enemy) => enemy.enemyType === "boss").map((enemy) => enemy.id);

  return TIERS.map((tier) => {
    const o = tier.depthOffset;
    const results: BalanceBatchResult[] = [];
    let seed = 1000;

    for (const characterId of characterIds) {
      for (const enemy of normalEnemies) {
        for (const depth of [o, o + 3, o + 6]) {
          const deck = buildClassSimDeck(characterId, tier.preset, seed);
          results.push(runScenario(characterId, enemy.id, depth, tier.preset, seed, tier.difficultyModifiers, deck));
          seed += 1000;
        }
      }
      for (const enemy of eliteEnemies) {
        for (const depth of [o + 2, o + 5, o + 7]) {
          const deck = buildClassSimDeck(characterId, tier.preset, seed);
          results.push(runScenario(characterId, enemy.id, depth, tier.preset, seed, tier.difficultyModifiers, deck));
          seed += 1000;
        }
      }
      for (const bossId of allBossIds) {
        const deck = buildClassSimDeck(characterId, tier.preset, seed);
        results.push(runScenario(characterId, bossId, o + 7, tier.preset, seed, tier.difficultyModifiers, deck));
        seed += 1000;
      }
    }

    return { tier: tier.label, label: tier.label, results };
  });
}

// --- Enemy / class ranking per tier ---

function rankEnemies(results: BalanceBatchResult[]): { id: string; winRate: number }[] {
  const byEnemy: Record<string, { total: number; count: number }> = {};
  for (const result of results) {
    const enemyId = result.config.enemyId;
    if (!byEnemy[enemyId]) byEnemy[enemyId] = { total: 0, count: 0 };
    byEnemy[enemyId].total += result.winRate;
    byEnemy[enemyId].count += 1;
  }
  return Object.entries(byEnemy)
    .map(([id, { total, count }]) => ({ id, winRate: total / count }))
    .sort((a, b) => b.winRate - a.winRate);
}

function rankCharacters(results: BalanceBatchResult[]): { id: CharacterId; winRate: number }[] {
  const byChar: Record<CharacterId, { total: number; count: number }> = {} as never;
  for (const result of results) {
    const charId = result.config.characterId;
    if (!byChar[charId]) byChar[charId] = { total: 0, count: 0 };
    byChar[charId].total += result.winRate;
    byChar[charId].count += 1;
  }
  return (Object.entries(byChar) as [CharacterId, { total: number; count: number }][])
    .map(([id, { total, count }]) => ({ id, winRate: total / count }))
    .sort((a, b) => b.winRate - a.winRate);
}

// --- Anomaly detection ---

type AnomalySummary = {
  field: string;
  maxValue: number;
  battles: number;
  peakScenario: { character: string; enemy: string; tier: string; peakStat?: string } | null;
};

// A flat list of (field, label) pairs to check for anomalies in a BattleAnomalies record.
const ANOMALY_FIELDS = ANOMALY_METRICS;

function peakStatForMetric(key: keyof BattleAnomalies, anomalies: BattleAnomalies): string | undefined {
  if (key === "maxSingleHitDamageToEnemy") return anomalies.maxSingleHitDamageToEnemyStat || undefined;
  if (key === "maxSingleHitDamageToPlayer") return anomalies.maxSingleHitDamageToPlayerStat || undefined;
  return undefined;
}

function collectAnomalies(results: BalanceBatchResult[], tierLabel: string, threshold: number): AnomalySummary[] {
  const byField: Record<string, AnomalySummary> = {};

  for (const batch of results) {
    for (const sim of batch.results) {
      const a = sim.anomalies;
      for (const { key, label } of ANOMALY_FIELDS) {
        const value = a[key];
        if (typeof value !== "number" || value <= threshold) continue;
        if (!byField[key]) {
          byField[key] = { field: label, maxValue: 0, battles: 0, peakScenario: null };
        }
        const entry = byField[key];
        entry.battles++;
        if (value > entry.maxValue) {
          entry.maxValue = value;
          entry.peakScenario = {
            character: CHARACTER_TITLES[sim.characterId] ?? sim.characterId,
            enemy: ENEMY_TITLES[sim.enemyId] ?? sim.enemyId,
            tier: tierLabel,
            peakStat: peakStatForMetric(key, a),
          };
        }
      }
    }
  }

  return Object.values(byField).sort((a, b) => b.maxValue - a.maxValue);
}

function collectAllAnomalyMetrics(
  tieredResults: TieredResults,
): { field: string; early: number; mid: number; late: number; thresholds: number[] }[] {
  const perTier = TIERS.map((_tier, i) => {
    const byField: Record<string, number> = {};
    for (const batch of tieredResults[i].results) {
      for (const sim of batch.results) {
        const a = sim.anomalies;
        for (const { key } of ANOMALY_FIELDS) {
          byField[key] = Math.max(byField[key] ?? 0, a[key] as number);
        }
      }
    }
    return byField;
  });

  const thresholds = TIERS.map((tier) => getAnomalyThreshold(tier.preset));

  return ANOMALY_FIELDS.map(({ key, label }) => ({
    field: label,
    early: perTier[0][key] ?? 0,
    mid: perTier[1][key] ?? 0,
    late: perTier[2][key] ?? 0,
    thresholds,
  })).sort((a, b) => b.late - a.late);
}

// --- Boon sweep per tier ---

type TieredTrinkets = {
  tier: string;
  entries: { trinketId: string; delta: number; winRate: number; baseline: number }[];
}[];

function runTrinketSweep(): TieredTrinkets {
  const characterIds = Object.keys(characters) as CharacterId[];

  return TIERS.map((tier) => {
    const o = tier.depthOffset;
    const gauntlet = [
      { enemyId: "skeleton", depth: o + 1 },
      { enemyId: "goblin", depth: o + 3 },
      { enemyId: "mimic", depth: o + 5 },
      { enemyId: "iron-bear", depth: o + 7 },
    ];

    function averageWinRate(trinketIds: string[], seedOffset: number): number {
      const rates: number[] = [];
      let seed = 50_000 + seedOffset;
      for (const characterId of characterIds) {
        for (const scenario of gauntlet) {
          const deck = buildRandomDeck(seed);
          rates.push(
            simulateBatch({
              characterId,
              deck,
              enemyId: scenario.enemyId,
              depth: scenario.depth,
              talentPreset: tier.preset,
              difficultyModifiers: tier.difficultyModifiers,
              trinketIds,
              iterations: trinketIterations,
              seed,
              maxTurns: 30,
              policy,
            }).winRate,
          );
          seed += 1000;
        }
      }
      return rates.reduce((total, rate) => total + rate, 0) / rates.length;
    }

    const baseline = averageWinRate([], 0);
    const entries = trinketLibrary
      .map((boon, index) => {
        const winRate = averageWinRate([boon.id], (index + 1) * 100_000);
        return { trinketId: boon.id, delta: winRate - baseline, winRate, baseline };
      })
      .sort((a, b) => b.delta - a.delta);

    return { tier: tier.label, entries };
  });
}

// --- Card sweep per tier ---

type TieredCards = { tier: string; entries: { cardId: string; delta: number; winRate: number; baseline: number }[] }[];

function runCardSweep(): TieredCards {
  const characterIds = Object.keys(characters) as CharacterId[];
  const ALL_CARDS = cardLibrary.map((c) => c.id);
  const DECK_SIZE = 10;
  const randomDeckSeeds = Array.from({ length: cardIterations }, (_, i) => 200_000 + i);

  function buildRandomDeck(allCards: string[], size: number, seed: number): BattleCard[] {
    const rng = createSeededRng(seed);
    const shuffled = [...allCards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const ids = shuffled.slice(0, Math.min(size, allCards.length));
    return ids.map((id) => cardLibrary.find((c) => c.id === id)).filter(Boolean) as BattleCard[];
  }

  function buildFixedCardDeck(targetId: string, pool: string[], size: number, seed: number): BattleCard[] {
    const rng = createSeededRng(seed);
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const others = shuffled.slice(0, Math.min(size - 1, pool.length));
    const ids = [targetId, ...others];
    return ids.map((id) => cardLibrary.find((c) => c.id === id)).filter(Boolean) as BattleCard[];
  }

  return TIERS.map((tier) => {
    const baselineRates: number[] = [];
    for (let idx = 0; idx < randomDeckSeeds.length; idx++) {
      const charId = characterIds[idx % characterIds.length];
      const deck = buildRandomDeck(ALL_CARDS, DECK_SIZE, randomDeckSeeds[idx]);
      baselineRates.push(
        simulateBatch({
          characterId: charId,
          deck,
          enemyId: "skeleton",
          depth: tier.depthOffset + 2,
          talentPreset: tier.preset,
          difficultyModifiers: tier.difficultyModifiers,
          iterations: 20,
          seed: randomDeckSeeds[idx] + 100_000,
          maxTurns: 30,
          policy,
        }).winRate,
      );
    }
    const baseline = baselineRates.reduce((total, rate) => total + rate, 0) / baselineRates.length;

    const cardResults: { cardId: string; winRate: number }[] = [];
    for (const targetId of ALL_CARDS) {
      if (!targetId) continue;
      const rates: number[] = [];
      const remainingCards = ALL_CARDS.filter((id) => id !== targetId);
      for (let idx = 0; idx < randomDeckSeeds.length; idx++) {
        const charId = characterIds[idx % characterIds.length];
        const deck = buildFixedCardDeck(targetId, remainingCards, DECK_SIZE, randomDeckSeeds[idx]);
        rates.push(
          simulateBatch({
            characterId: charId,
            deck,
            enemyId: "skeleton",
            depth: tier.depthOffset + 2,
            talentPreset: tier.preset,
            difficultyModifiers: tier.difficultyModifiers,
            iterations: 20,
            seed: randomDeckSeeds[idx] + 300_000,
            maxTurns: 30,
            policy,
          }).winRate,
        );
      }
      cardResults.push({
        cardId: targetId,
        winRate: rates.reduce((total, rate) => total + rate, 0) / rates.length,
      });
    }

    const entries = cardResults
      .map((card) => ({ ...card, delta: card.winRate - baseline, baseline }))
      .sort((a, b) => b.delta - a.delta);

    return { tier: tier.label, entries };
  });
}

// --- HTML report generation ---

function writeHtmlReport(
  tieredEnemies: { tier: string; entries: { id: string; winRate: number }[] }[],
  tieredClasses: { tier: string; entries: { id: CharacterId; winRate: number }[] }[],
  tieredBoons: TieredTrinkets,
  tieredCards: TieredCards,
  anomalies: AnomalySummary[],
  allMetrics: { field: string; early: number; mid: number; late: number; thresholds: number[] }[],
) {
  const tierLabels = TIERS.map((t) => t.label);

  // Merge per-tier data into a single sorted array with columns per tier.
  function mergeEnemies() {
    const ids = [...new Set(tieredEnemies.flatMap((t) => t.entries.map((e) => e.id)))];
    return ids
      .map((id) => ({
        id,
        early: tieredEnemies[0].entries.find((e) => e.id === id)?.winRate ?? 0,
        mid: tieredEnemies[1].entries.find((e) => e.id === id)?.winRate ?? 0,
        late: tieredEnemies[2].entries.find((e) => e.id === id)?.winRate ?? 0,
      }))
      .sort((a, b) => a.late - b.late);
  }

  function mergeClasses() {
    const ids = [...new Set(tieredClasses.flatMap((t) => t.entries.map((e) => e.id as string)))];
    return ids
      .map((id) => ({
        id: id as CharacterId,
        early: tieredClasses[0].entries.find((e) => e.id === id)?.winRate ?? 0,
        mid: tieredClasses[1].entries.find((e) => e.id === id)?.winRate ?? 0,
        late: tieredClasses[2].entries.find((e) => e.id === id)?.winRate ?? 0,
      }))
      .sort((a, b) => a.late - b.late);
  }

  function mergeTrinkets() {
    return tieredBoons[0].entries
      .map((entry) => ({
        id: entry.trinketId,
        early: tieredBoons[0].entries.find((t) => t.trinketId === entry.trinketId)?.delta ?? 0,
        mid: tieredBoons[1].entries.find((t) => t.trinketId === entry.trinketId)?.delta ?? 0,
        late: tieredBoons[2].entries.find((t) => t.trinketId === entry.trinketId)?.delta ?? 0,
      }))
      .sort((a, b) => a.late - b.late);
  }

  function mergeCards() {
    return tieredCards[0].entries
      .map((entry) => ({
        id: entry.cardId,
        early: tieredCards[0].entries.find((c) => c.cardId === entry.cardId)?.delta ?? 0,
        mid: tieredCards[1].entries.find((c) => c.cardId === entry.cardId)?.delta ?? 0,
        late: tieredCards[2].entries.find((c) => c.cardId === entry.cardId)?.delta ?? 0,
      }))
      .sort((a, b) => a.late - b.late);
  }

  const mergedEnemies = mergeEnemies();
  const mergedClasses = mergeClasses();
  const mergedBoons = mergeTrinkets();
  const mergedCards = mergeCards();

  function winRateCell(value: number): string {
    return `<td>${percent(value)}</td>`;
  }

  function deltaCell(value: number): string {
    return `<td class="${value >= 0 ? "pos" : "neg"}">${percent(value)}</td>`;
  }

  function tableRows(
    items: { id: string; early: number; mid: number; late: number }[],
    cellFn: (v: number) => string,
    titleFn: (id: string) => string,
  ) {
    return items
      .map(
        (item) => `<tr><td>${titleFn(item.id)}</td>${cellFn(item.early)}${cellFn(item.mid)}${cellFn(item.late)}</tr>`,
      )
      .join("\n");
  }

  const tierHeader = tierLabels.map((l) => `<th>Player Win Rate (${l})</th>`).join("");
  const deltaHeader = tierLabels.map((l) => `<th>Player Win Rate Delta (${l})</th>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Balance Report</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #0f0f12; color: #d4d4d8; padding: 2rem; }
  h1 { color: #e4e4e7; border-bottom: 1px solid #27272a; padding-bottom: 0.5rem; }
  h2 { color: #a1a1aa; margin-top: 2rem; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; font-size: 0.875rem; }
  th { background: #18181b; color: #a1a1aa; text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #27272a; font-weight: 600; }
  td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #1f1f23; }
  tr:hover td { background: #1a1a1e; }
  .pos { color: #4ade80; }
  .neg { color: #f87171; }
  .meta { color: #71717a; font-size: 0.8rem; margin-bottom: 1rem; }
  .scroll { overflow-x: auto; }
</style>
</head>
<body>
<h1>Balance Report</h1>
<p class="meta">policy=${policy} | iterations=${iterations} | trinketIterations=${trinketIterations} | cardIterations=${cardIterations}</p>

<h2>Simulation Methodology</h2>
<div class="meta">
<p><strong>Core scenarios</strong> (Enemy Rankings, Class Rankings, Anomalies): all characters × normal/elite/boss enemies × tier depths. Each character uses its own deck:</p>
<ul>
<li><strong>Deck:</strong> class starting deck + random cards from that class's keyword affinity pool (<code>getCardKeywords</code> ∩ character keywords): Early +${CLASS_SIM_AFFINITY_EXTRAS.early}, Mid +${CLASS_SIM_AFFINITY_EXTRAS.mid}, Late +${CLASS_SIM_AFFINITY_EXTRAS.late}. Alchemist also gets 2 random Mixed Potions (shop-style pairs from the standard potion pool).</li>
<li><strong>Homestead companions:</strong> bond level 1 / 2 / 3 (Early / Mid / Late) for each companion summon card in the sim deck.</li>
<li><strong>Wildcard:</strong> no starting deck; random ${WILDCARD_SIM_DECK_SIZE.early} / ${WILDCARD_SIM_DECK_SIZE.mid} / ${WILDCARD_SIM_DECK_SIZE.late} cards from the full offerable pool (Early / Mid / Late).</li>
<li><strong>Talents:</strong> Early = defaults; Mid = 5 talents per affinity keyword + 2 per other; Late = up to 7 talents per affinity keyword + 5 per other keyword.</li>
<li><strong>Difficulty:</strong> Early none; Mid Adventurer (enemy HP/damage ×1.3); Late Legend (×1.6).</li>
</ul>
<p><strong>Class rankings</strong> — mean win rate across all core scenarios for that character (deck identity + talents).</p>
<p><strong>Boon sweep</strong> — all characters × gauntlet (Skeleton, Goblin, Mimic, Iron Bear) with random 10-card decks; delta vs no-boon baseline.</p>
<p><strong>Card sweep</strong> — target card + 9 random others vs Skeleton; delta vs random 10-card baseline.</p>
<p><strong>Anomalies</strong> — max metric per battle; thresholds Early ${ANOMALY_THRESHOLD_BY_PRESET.early} / Mid ${ANOMALY_THRESHOLD_BY_PRESET.mid} / Late ${ANOMALY_THRESHOLD_BY_PRESET.late}.</p>
<p><strong>Iron Bear</strong> — Iron Hide gains one of armor, forge, or burn damage each enemy turn (not all three); no special boss tuning in this report.</p>
</div>

<h2>Enemy Rankings</h2>
<p class="meta">Sorted by Late Game Player Win Rate ascending (hardest at top). Uses core scenario decks above.</p>
<div class="scroll"><table><thead><tr><th>Enemy</th>${tierHeader}</tr></thead><tbody>
${tableRows(mergedEnemies, winRateCell, enemyTitle)}
</tbody></table></div>

<h2>Class Rankings</h2>
<p class="meta">Sorted by Late Game Player Win Rate ascending. Uses core scenario class decks + talent presets.</p>
<div class="scroll"><table><thead><tr><th>Class</th>${tierHeader}</tr></thead><tbody>
${tableRows(mergedClasses, winRateCell, characterTitle)}
</tbody></table></div>

<h2>Boon Rankings</h2>
<p class="meta">Sorted by Late Game Player Win Rate Delta ascending (weakest at top). Delta vs a no-boon baseline.</p>
<div class="scroll"><table><thead><tr><th>Boon</th>${deltaHeader}</tr></thead><tbody>
${tableRows(mergedBoons, deltaCell, trinketTitle)}
</tbody></table></div>

<h2>Card Rankings</h2>
<p class="meta">Sorted by Late Game Player Win Rate Delta ascending (weakest at top). Delta vs a random-deck baseline.</p>
<div class="scroll"><table><thead><tr><th>Card</th>${deltaHeader}</tr></thead><tbody>
${tableRows(mergedCards, deltaCell, cardTitle)}
</tbody></table></div>

<h2>Anomalies</h2>
<p class="meta">Values exceeding tier thresholds during simulated battles (Early ${ANOMALY_THRESHOLD_BY_PRESET.early} / Mid ${ANOMALY_THRESHOLD_BY_PRESET.mid} / Late ${ANOMALY_THRESHOLD_BY_PRESET.late}).</p>
<div class="scroll"><table><thead><tr><th>Field</th><th>Max Value</th><th>Battles</th><th>Peak Scenario</th></tr></thead><tbody>
${
  anomalies.length === 0
    ? '<tr><td colspan="4">None detected</td></tr>'
    : anomalies
        .slice(0, 50)
        .map((a) => {
          const peak = a.peakScenario;
          const scenario = peak
            ? `${peak.character} vs ${peak.enemy} (${peak.tier})${peak.peakStat ? ` · ${peak.peakStat}` : ""}`
            : "";
          return `<tr><td>${a.field}</td><td class="neg">${a.maxValue}</td><td>${a.battles}</td><td>${scenario}</td></tr>`;
        })
        .join("\n")
}
</tbody></table></div>

<h2>All Anomaly Metrics</h2>
<p class="meta">Maximum observed values per field across all tiers. Values over each tier threshold highlighted in red.</p>
<div class="scroll"><table><thead><tr><th>Field</th>${TIERS.map((t) => `<th>${t.label}</th>`).join("")}</tr></thead><tbody>
${allMetrics.map((m) => `<tr><td>${m.field}</td>${[m.early, m.mid, m.late].map((v, i) => `<td class="${v > m.thresholds[i] ? "neg" : ""}">${v}</td>`).join("")}</tr>`).join("\n")}
</tbody></table></div>
</body>
</html>`;

  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportFile, html, "utf-8");
  console.info(`HTML report written to ${reportFile}`);
}

// --- Test body ---

describeBalance("balance report", () => {
  it("prints battle balance metrics", { timeout: 600000 }, () => {
    const tieredResults = runCoreScenarios();
    const tieredBoons = runTrinketSweep();
    const tieredCards = runCardSweep();

    const tieredEnemies = tieredResults.map((tier) => ({
      tier: tier.tier,
      entries: rankEnemies(tier.results),
    }));
    const tieredClasses = tieredResults.map((tier) => ({
      tier: tier.tier,
      entries: rankCharacters(tier.results),
    }));

    console.info(
      `Balance simulation policy=${policy} iterations=${iterations} trinketIterations=${trinketIterations} cardIterations=${cardIterations}`,
    );

    // Condensed console output: top/bottom 3 per tier
    for (const tier of tieredEnemies) {
      const bottom3 = tier.entries.slice(0, 3);
      const top3 = [...tier.entries].reverse().slice(0, 3);
      console.info(`Weakest enemies (${tier.tier})`);
      console.table(bottom3.map((e) => ({ enemy: enemyTitle(e.id), playerWinRate: percent(e.winRate) })));
      console.info(`Strongest enemies (${tier.tier})`);
      console.table(top3.map((e) => ({ enemy: enemyTitle(e.id), playerWinRate: percent(e.winRate) })));
    }

    for (const tier of tieredClasses) {
      console.info(`Class rankings (${tier.tier})`);
      console.table(tier.entries.map((c) => ({ class: characterTitle(c.id), playerWinRate: percent(c.winRate) })));
    }

    for (const tier of tieredBoons) {
      const top3 = tier.entries.slice(0, 3);
      const bottom3 = tier.entries.slice(-3).reverse();
      console.info(`Strongest boons (${tier.tier})`);
      console.table(top3.map((t) => ({ boon: trinketTitle(t.trinketId), playerWinRateDelta: percent(t.delta) })));
      console.info(`Weakest boons (${tier.tier})`);
      console.table(bottom3.map((t) => ({ boon: trinketTitle(t.trinketId), playerWinRateDelta: percent(t.delta) })));
    }

    for (const tier of tieredCards) {
      const top3 = tier.entries.slice(0, 3);
      const bottom3 = tier.entries.slice(-3).reverse();
      console.info(`Strongest cards (${tier.tier})`);
      console.table(top3.map((c) => ({ card: cardTitle(c.cardId), playerWinRateDelta: percent(c.delta) })));
      console.info(`Weakest cards (${tier.tier})`);
      console.table(bottom3.map((c) => ({ card: cardTitle(c.cardId), playerWinRateDelta: percent(c.delta) })));
    }

    // Anomaly detection
    const allAnomalies: AnomalySummary[] = [];
    for (const tier of tieredResults) {
      const tierConfig = TIERS.find((t) => t.label === tier.tier);
      const threshold = tierConfig ? getAnomalyThreshold(tierConfig.preset) : ANOMALY_THRESHOLD_BY_PRESET.early;
      const anomalies = collectAnomalies(tier.results, tier.tier, threshold);
      allAnomalies.push(...anomalies);
    }
    const topAnomalies = allAnomalies.sort((a, b) => b.maxValue - a.maxValue);
    if (topAnomalies.length > 0) {
      console.info("Anomalies detected (value > tier threshold):");
      console.table(
        topAnomalies.slice(0, 20).map((a) => ({
          field: a.field,
          maxValue: a.maxValue,
          battles: a.battles,
          peak: a.peakScenario
            ? `${a.peakScenario.character} vs ${a.peakScenario.enemy} (${a.peakScenario.tier})${a.peakScenario.peakStat ? ` · ${a.peakScenario.peakStat}` : ""}`
            : "",
        })),
      );
    } else {
      console.info("No anomalies detected (all values <= threshold).");
    }

    const allMetrics = collectAllAnomalyMetrics(tieredResults);
    writeHtmlReport(tieredEnemies, tieredClasses, tieredBoons, tieredCards, topAnomalies, allMetrics);

    expect(tieredResults.length).toBe(3);
  });
});

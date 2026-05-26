import { describe, expect, it } from "vitest";
import {
  simulateBatch,
  type BalanceBatchResult,
  type BalancePlayPolicy,
  type TalentPreset,
  type BattleAnomalies,
  ANOMALY_THRESHOLD,
  createSeededRandom,
} from "@/lib/balance";
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

const TIERS: { label: string; preset: TalentPreset; depthOffset: number; difficultyModifiers: DifficultyModifier[] }[] = [
  { label: "Early", preset: "early", depthOffset: 0, difficultyModifiers: [] },
  { label: "Mid", preset: "mid", depthOffset: 8, difficultyModifiers: ADVENTURER_MODIFIERS },
  { label: "Late", preset: "late", depthOffset: 16, difficultyModifiers: LEGEND_MODIFIERS },
];

// Lookup maps from internal ID to in-game display title.
const ENEMY_TITLES: Record<string, string> = Object.fromEntries(enemyBestiary.map((e) => [e.id, e.title]));
const CHARACTER_TITLES: Record<string, string> = Object.fromEntries(
  Object.values(characters).map((c) => [c.id, c.name]),
);
const TRINKET_TITLES: Record<string, string> = Object.fromEntries(trinketLibrary.map((t) => [t.id, t.title]));
const CARD_TITLES: Record<string, string> = Object.fromEntries(cardLibrary.map((c) => [c.id, c.title]));

function enemyTitle(id: string): string {
  return ENEMY_TITLES[id] ?? id;
}
function characterTitle(id: string): string {
  return CHARACTER_TITLES[id] ?? id;
}
function trinketTitle(id: string): string {
  return TRINKET_TITLES[id] ?? id;
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
  const rng = createSeededRandom(seed);
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
          const deck = buildRandomDeck(seed);
          results.push(runScenario(characterId, enemy.id, depth, tier.preset, seed, tier.difficultyModifiers, deck));
          seed += 1000;
        }
      }
      for (const enemy of eliteEnemies) {
        for (const depth of [o + 2, o + 5, o + 7]) {
          const deck = buildRandomDeck(seed);
          results.push(runScenario(characterId, enemy.id, depth, tier.preset, seed, tier.difficultyModifiers, deck));
          seed += 1000;
        }
      }
      for (const bossId of allBossIds) {
        const deck = buildRandomDeck(seed);
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
  scenarios: { character: string; enemy: string; tier: string }[];
};

// A flat list of (field, label) pairs to check for anomalies in a BattleAnomalies record.
const ANOMALY_FIELDS: { key: keyof BattleAnomalies; label: string }[] = [
  { key: "maxPlayerBlock", label: "Block on Player" },
  { key: "maxPlayerArmor", label: "Armor on Player" },
  { key: "maxPlayerBurn", label: "Burn on Player" },
  { key: "maxPlayerPoison", label: "Poison on Player" },
  { key: "maxPlayerBleed", label: "Bleed on Player" },
  { key: "maxPlayerFreeze", label: "Freeze on Player" },
  { key: "maxPlayerStun", label: "Stun on Player" },
  { key: "maxEnemyBurn", label: "Burn on Enemy" },
  { key: "maxEnemyPoison", label: "Poison on Enemy" },
  { key: "maxEnemyBleed", label: "Bleed on Enemy" },
  { key: "maxEnemyFreeze", label: "Freeze on Enemy" },
  { key: "maxEnemyStun", label: "Stun on Enemy" },
  { key: "maxEnemyArmor", label: "Armor on Enemy" },
  { key: "maxEnemyForge", label: "Forge on Enemy" },
  { key: "maxEnemyFreezeBonus", label: "FreezeBonus on Enemy" },
  { key: "maxEnemyBurnBonus", label: "BurnBonus on Enemy" },
  { key: "maxEnemyBlock", label: "Block on Enemy" },
  { key: "maxSingleHitDamageToEnemy", label: "Player→Enemy Dmg" },
  { key: "maxSingleHitDamageToPlayer", label: "Enemy→Player Dmg" },
  { key: "maxSingleHeal", label: "Player Heal" },
];

function collectAnomalies(results: BalanceBatchResult[], tierLabel: string): AnomalySummary[] {
  const byField: Record<string, AnomalySummary> = {};

  for (const batch of results) {
    for (const sim of batch.results) {
      const a = sim.anomalies;
      for (const { key, label } of ANOMALY_FIELDS) {
        const value = a[key];
        if (value <= ANOMALY_THRESHOLD) continue;
        if (!byField[key]) {
          byField[key] = { field: label, maxValue: 0, battles: 0, scenarios: [] };
        }
        const entry = byField[key];
        if (value > entry.maxValue) entry.maxValue = value;
        entry.battles++;
        if (entry.scenarios.length < 5) {
          entry.scenarios.push({
            character: CHARACTER_TITLES[sim.characterId] ?? sim.characterId,
            enemy: ENEMY_TITLES[sim.enemyId] ?? sim.enemyId,
            tier: tierLabel,
          });
        }
      }
    }
  }

  return Object.values(byField).sort((a, b) => b.maxValue - a.maxValue);
}

function collectAllAnomalyMetrics(tieredResults: TieredResults): { field: string; early: number; mid: number; late: number }[] {
  const perTier = TIERS.map((tier, i) => {
    const byField: Record<string, number> = {};
    for (const batch of tieredResults[i].results) {
      for (const sim of batch.results) {
        const a = sim.anomalies;
        for (const { key } of ANOMALY_FIELDS) {
          byField[key] = Math.max(byField[key] ?? 0, a[key]);
        }
      }
    }
    return byField;
  });

  return ANOMALY_FIELDS.map(({ key, label }) => ({
    field: label,
    early: perTier[0][key] ?? 0,
    mid: perTier[1][key] ?? 0,
    late: perTier[2][key] ?? 0,
  })).sort((a, b) => b.late - a.late);
}

// --- Trinket sweep per tier ---

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
      .map((trinket, index) => {
        const winRate = averageWinRate([trinket.id], (index + 1) * 100_000);
        return { trinketId: trinket.id, delta: winRate - baseline, winRate, baseline };
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
    const rng = createSeededRandom(seed);
    const shuffled = [...allCards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const ids = shuffled.slice(0, Math.min(size, allCards.length));
    return ids.map((id) => cardLibrary.find((c) => c.id === id)).filter(Boolean) as BattleCard[];
  }

  function buildFixedCardDeck(targetId: string, pool: string[], size: number, seed: number): BattleCard[] {
    const rng = createSeededRandom(seed);
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
  tieredTrinkets: TieredTrinkets,
  tieredCards: TieredCards,
  anomalies: AnomalySummary[],
  allMetrics: { field: string; early: number; mid: number; late: number }[],
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
    return tieredTrinkets[0].entries
      .map((entry) => ({
        id: entry.trinketId,
        early: tieredTrinkets[0].entries.find((t) => t.trinketId === entry.trinketId)?.delta ?? 0,
        mid: tieredTrinkets[1].entries.find((t) => t.trinketId === entry.trinketId)?.delta ?? 0,
        late: tieredTrinkets[2].entries.find((t) => t.trinketId === entry.trinketId)?.delta ?? 0,
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
  const mergedTrinkets = mergeTrinkets();
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

<h2>Enemy Rankings</h2>
<p class="meta">Sorted by Late Game Player Win Rate ascending (hardest at top).</p>
<div class="scroll"><table><thead><tr><th>Enemy</th>${tierHeader}</tr></thead><tbody>
${tableRows(mergedEnemies, winRateCell, enemyTitle)}
</tbody></table></div>

<h2>Class Rankings</h2>
<p class="meta">Sorted by Late Game Player Win Rate ascending.</p>
<div class="scroll"><table><thead><tr><th>Class</th>${tierHeader}</tr></thead><tbody>
${tableRows(mergedClasses, winRateCell, characterTitle)}
</tbody></table></div>

<h2>Trinket Rankings</h2>
<p class="meta">Sorted by Late Game Player Win Rate Delta ascending (weakest at top). Delta vs a no-trinket baseline.</p>
<div class="scroll"><table><thead><tr><th>Trinket</th>${deltaHeader}</tr></thead><tbody>
${tableRows(mergedTrinkets, deltaCell, trinketTitle)}
</tbody></table></div>

<h2>Card Rankings</h2>
<p class="meta">Sorted by Late Game Player Win Rate Delta ascending (weakest at top). Delta vs a random-deck baseline.</p>
<div class="scroll"><table><thead><tr><th>Card</th>${deltaHeader}</tr></thead><tbody>
${tableRows(mergedCards, deltaCell, cardTitle)}
</tbody></table></div>

<h2>Anomalies</h2>
<p class="meta">Values exceeding ${ANOMALY_THRESHOLD} during simulated battles. May indicate bugs (infinite scaling, missing decay, etc.).</p>
<div class="scroll"><table><thead><tr><th>Field</th><th>Max Value</th><th>Battles</th><th>Example Scenario</th></tr></thead><tbody>
${anomalies.length === 0 ? '<tr><td colspan="4">None detected</td></tr>' : anomalies.slice(0, 50).map((a) => `<tr><td>${a.field}</td><td class="neg">${a.maxValue}</td><td>${a.battles}</td><td>${a.scenarios[0] ? `${a.scenarios[0].character} vs ${a.scenarios[0].enemy} (${a.scenarios[0].tier})` : ""}</td></tr>`).join("\n")}
</tbody></table></div>

<h2>All Anomaly Metrics</h2>
<p class="meta">Maximum observed values per field across all tiers. Values over ${ANOMALY_THRESHOLD} highlighted in red.</p>
<div class="scroll"><table><thead><tr><th>Field</th>${TIERS.map((t) => `<th>${t.label}</th>`).join("")}</tr></thead><tbody>
${allMetrics.map((m) => `<tr><td>${m.field}</td>${[m.early, m.mid, m.late].map((v) => `<td class="${v > ANOMALY_THRESHOLD ? 'neg' : ''}">${v}</td>`).join("")}</tr>`).join("\n")}
</tbody></table></div>
</body>
</html>`;

  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportFile, html, "utf-8");
  console.info(`HTML report written to ${reportFile}`);
}

// --- Test body ---

describeBalance("balance report", () => {
  it("prints battle balance metrics", { timeout: 120000 }, () => {
    const tieredResults = runCoreScenarios();
    const tieredTrinkets = runTrinketSweep();
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

    for (const tier of tieredTrinkets) {
      const top3 = tier.entries.slice(0, 3);
      const bottom3 = tier.entries.slice(-3).reverse();
      console.info(`Strongest trinkets (${tier.tier})`);
      console.table(top3.map((t) => ({ trinket: trinketTitle(t.trinketId), playerWinRateDelta: percent(t.delta) })));
      console.info(`Weakest trinkets (${tier.tier})`);
      console.table(bottom3.map((t) => ({ trinket: trinketTitle(t.trinketId), playerWinRateDelta: percent(t.delta) })));
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
      const anomalies = collectAnomalies(tier.results, tier.tier);
      allAnomalies.push(...anomalies);
    }
    const topAnomalies = allAnomalies.sort((a, b) => b.maxValue - a.maxValue);
    if (topAnomalies.length > 0) {
      console.info("Anomalies detected (value > threshold):");
      console.table(
        topAnomalies.slice(0, 20).map((a) => ({
          field: a.field,
          maxValue: a.maxValue,
          battles: a.battles,
          example: a.scenarios[0]
            ? `${a.scenarios[0].character} vs ${a.scenarios[0].enemy} (${a.scenarios[0].tier})`
            : "",
        })),
      );
    } else {
      console.info("No anomalies detected (all values <= threshold).");
    }

    const allMetrics = collectAllAnomalyMetrics(tieredResults);
    writeHtmlReport(tieredEnemies, tieredClasses, tieredTrinkets, tieredCards, topAnomalies, allMetrics);

    expect(tieredResults.length).toBe(3);
  });
});

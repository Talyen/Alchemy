import { enemyById, isEnemyId } from "@/lib/game-data";
import { ANOMALY_THRESHOLD_BY_PRESET } from "./anomalies";
import { formatLengthBand, formatWinRateBand, isLengthOutsideBand, isWinRateOutsideTypeBand } from "./findings-types";
import {
  REPORT_TIERS,
  titleFor,
  type ReportTierRecord,
  type ReportEnemyType,
  type TitleLookupKind,
} from "./report-catalog";
import { escapeHtml, formatPercent, renderReportPage } from "./report-layout";
import { reportMethodologyLines } from "./report-methodology";
import type { BalanceReportModel, PairedTierRow } from "./report-model";
import type { ReportRunOptions } from "./report-options";
import type { PairedDelta, RateCell } from "./report-rankings";

const percent = formatPercent;

function rateCells(cell: RateCell, enemyType?: ReportEnemyType): string {
  const winTarget = enemyType ? `<div class="meta">Target ${formatWinRateBand(enemyType)}</div>` : "";
  const turnTarget = enemyType ? `<div class="meta">Target ${formatLengthBand(enemyType)}</div>` : "";
  const winClass = enemyType && isWinRateOutsideTypeBand(cell.winRate, enemyType) ? "neg" : "";
  const turnClass = enemyType && isLengthOutsideBand(cell.averageTurns, enemyType) ? "neg" : "";
  return `<td class="${winClass}">${percent(cell.winRate)}${winTarget}</td><td>${cell.wins} / ${cell.losses} / ${cell.timeouts}<div class="meta">n=${cell.n}</div></td><td>${percent(cell.timeoutRate)}</td><td class="${turnClass}">${cell.averageTurns.toFixed(1)}${turnTarget}</td><td>${cell.averageHealthRemaining.toFixed(0)}</td><td>${cell.averageEnemyAttacks.toFixed(1)}</td><td>${cell.averageEnemyAbilityUses.toFixed(1)}</td><td>${cell.averageEnemyAbilityActivations.toFixed(1)}</td><td>${percent(cell.winsBeforeEnemyAttackRate)}</td>`;
}

function tierRateCells(rates: ReportTierRecord<RateCell>, enemyType?: ReportEnemyType): string {
  return REPORT_TIERS.map(({ preset }) => rateCells(rates[preset], enemyType)).join("");
}

function deltaCell(delta: PairedDelta): string {
  const cls = delta.noisy ? "noisy" : delta.delta >= 0 ? "pos" : "neg";
  const mark = delta.noisy ? " (noisy)" : "";
  const turns =
    delta.n > 0 ? `<div class="meta">${delta.turnDelta >= 0 ? "+" : ""}${delta.turnDelta.toFixed(1)} turns</div>` : "";
  return `<td class="${cls}">${percent(delta.delta)}${mark}<div class="meta">SE ${percent(delta.se)} · n=${delta.n}</div>${turns}</td>`;
}

function pairedRows(rows: readonly PairedTierRow[], kind: TitleLookupKind): string {
  return rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(titleFor(kind, row.id))}</td>${REPORT_TIERS.map(({ preset }) => deltaCell(row.deltas[preset])).join("")}</tr>`,
    )
    .join("\n");
}

function pairedSection(
  title: string,
  explanation: string,
  rows: readonly PairedTierRow[],
  kind: "boon" | "card" | "talent" | "companion" | "gear",
): string {
  const heading = { boon: "Boon", card: "Card", talent: "Talent", companion: "Companion", gear: "Item" }[kind];
  return `<h2>${escapeHtml(title)}</h2>
${explanation ? `<p class="meta">${escapeHtml(explanation)}</p>` : ""}
<div class="scroll"><table><thead><tr><th>${heading}</th><th>Delta Early</th><th>Delta Mid</th><th>Delta Late</th></tr></thead><tbody>
${pairedRows(rows, kind)}
</tbody></table></div>`;
}

export function renderBalanceReportHtml(model: BalanceReportModel, options: ReportRunOptions): string {
  const methodology = reportMethodologyLines(options)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("\n");

  const enemyRows = model.enemies
    .map((row) => {
      const type = isEnemyId(row.id) ? enemyById[row.id].enemyType : undefined;
      return `<tr><td>${escapeHtml(titleFor("enemy", row.id))}</td>${tierRateCells(row.rates, type)}</tr>`;
    })
    .join("\n");

  const classRows = model.classes
    .map((row) => {
      const late = row.ratesByType.late;
      return `<tr><td>${escapeHtml(titleFor("character", row.id))}</td>${tierRateCells(row.rates)}<td>${percent(late.normal.winRate)}</td><td>${percent(late.elite.winRate)}</td><td>${percent(late.boss.winRate)}</td></tr>`;
    })
    .join("\n");

  const matchupRows = model.classMatchups
    .map((row) => {
      const cards = row.topCardsLate.map((entry) => `${titleFor("card", entry.cardId)} (${entry.count})`).join(", ");
      return `<tr><td>${escapeHtml(titleFor("character", row.characterId))}</td><td>${escapeHtml(titleFor("enemy", row.enemyId))}</td><td>${escapeHtml(row.enemyType)}</td>${tierRateCells(row.rates, row.enemyType)}<td>${escapeHtml(cards)}</td></tr>`;
    })
    .join("\n");

  const anomalyRows =
    model.anomalies.length === 0
      ? '<tr><td colspan="4">None detected</td></tr>'
      : model.anomalies
          .slice(0, 50)
          .map(
            (row) =>
              `<tr><td>${escapeHtml(row.field)}</td><td class="neg">${row.maxValue}</td><td>${row.battles}</td><td>${escapeHtml(row.peakScenario)}</td></tr>`,
          )
          .join("\n");

  const metricRows = model.anomalyMetrics
    .map((row) => {
      const cells = REPORT_TIERS.map(({ preset: tier }) => {
        const value = row.values[tier];
        return `<td class="${value > ANOMALY_THRESHOLD_BY_PRESET[tier] ? "neg" : ""}">${value}</td>`;
      }).join("");
      return `<tr><td>${escapeHtml(row.field)}</td>${cells}</tr>`;
    })
    .join("\n");

  const { meta } = model;
  const rateHeaderTier = (label: string) =>
    `<th>Win ${label}</th><th>Wins / Defeats / Timeouts ${label}</th><th>Timeout ${label}</th><th>Turns ${label}</th><th>HP ${label}</th><th>Enemy attacks ${label}</th><th>Ability uses ${label}</th><th>Trait activations ${label}</th><th>Wins before attack ${label}</th>`;

  const rateHeader = REPORT_TIERS.map(({ label }) => rateHeaderTier(label)).join("");

  return renderReportPage({
    title: "Balance Report",
    body: `<h1>Balance Report</h1>
<p class="meta"><a href="../balance-findings.html">Findings summary</a> (preferred). This page is the full matrix — do not use it as the default read.</p>
<p class="meta">mode=${escapeHtml(meta.samplingMode ?? "custom")} | policy=${escapeHtml(meta.policy)} | loadout=${escapeHtml(meta.loadoutMode)} | iterations=${meta.iterations} | pairedIterations=${meta.pairedIterations} | cardDeckSamples=${meta.cardDeckSamples} | deckSeeds=${meta.deckSeeds}</p>

<h2>Simulation Methodology</h2>
<div class="meta"><ul>
${methodology}
</ul>
<p>Anomaly thresholds Early ${ANOMALY_THRESHOLD_BY_PRESET.early} / Mid ${ANOMALY_THRESHOLD_BY_PRESET.mid} / Late ${ANOMALY_THRESHOLD_BY_PRESET.late}.</p>
</div>

<h2>Enemy Rankings</h2>
<p class="meta">Sorted by Late win rate ascending (hardest at top). Timeout and remaining HP distinguish stalls from true losses.</p>
<div class="scroll"><table><thead><tr><th>Enemy</th>${rateHeader}</tr></thead><tbody>
${enemyRows}
</tbody></table></div>

<h2>Class Rankings</h2>
<p class="meta">Overall rates weight Normal / Elite / Boss equally. Outcome counts retain actual battles and are not type-weighted. Late type split is raw win rate within that enemy type.</p>
<div class="scroll"><table><thead><tr><th>Class</th>${rateHeader}<th>Late Normal</th><th>Late Elite</th><th>Late Boss</th></tr></thead><tbody>
${classRows}
</tbody></table></div>

<h2>Class Matchups</h2>
<p class="meta">Per class vs each enemy. Late top cards are play counts from core scenarios.</p>
<div class="scroll"><table><thead><tr><th>Class</th><th>Enemy</th><th>Type</th>${rateHeader}<th>Late top cards</th></tr></thead><tbody>
${matchupRows}
</tbody></table></div>

${pairedSection("Boon Rankings", "Paired delta vs no-boon baseline (same deck/seed/matchup). Noisy = |delta| < 2 SE.", model.boons, "boon")}
${pairedSection("Card Rankings — isolated vs Skeleton", "Target card + 9 random others vs random 10-card baseline. Paired seeds.", model.cardsIsolatedSkeleton, "card")}
${pairedSection("Card Rankings — isolated vs Mimic", "", model.cardsIsolatedElite, "card")}
${pairedSection("Card Rankings — in-class decks", "Insert (or remove-then-compare) the card in a class-identity deck vs Skeleton.", model.cardsInClass, "card")}
${pairedSection("Talent ablation", "Affinity combat talents on vs off, class decks, gauntlet enemies, paired.", model.talents, "talent")}
${pairedSection("Companion ablation", "Summon card in vs out of class decks on the gauntlet.", model.companions, "companion")}

<h2>Item affix isolation</h2>
<p class="meta">One affix vs no gear, all heroes and deck seeds. Rounded midpoint roll: Basic early/mid, Astral late; unique affixes use their fixed value. These are sensitivity probes, including early access to unique effects.</p>
<table><thead><tr><th>Affix</th><th>Early Δ</th><th>Mid Δ</th><th>Late Δ</th></tr></thead><tbody>
${pairedRows(model.affixes, "affix")}
</tbody></table>
${pairedSection("Gear ablation", "Target base gear item equipped vs default gear baseline on the gauntlet.", model.gear, "gear")}

<h2>Anomalies</h2>
<div class="scroll"><table><thead><tr><th>Field</th><th>Max Value</th><th>Battles</th><th>Peak Scenario</th></tr></thead><tbody>
${anomalyRows}
</tbody></table></div>

<h2>All Anomaly Metrics</h2>
<div class="scroll"><table><thead><tr><th>Field</th><th>Early</th><th>Mid</th><th>Late</th></tr></thead><tbody>
${metricRows}
</tbody></table></div>`,
  });
}

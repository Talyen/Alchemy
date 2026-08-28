import { talentPool } from "@/lib/game-data";
import { ANOMALY_THRESHOLD_BY_PRESET } from "./anomalies";
import type { BalanceReportModel, PairedTierRow } from "./report-model";
import { reportMethodologyLines, TITLE_LOOKUPS, type ReportRunOptions } from "./report-run";
import type { PairedDelta, RateCell } from "./report-rankings";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function titleFor(kind: keyof typeof TITLE_LOOKUPS | "talent", id: string): string {
  if (kind === "talent") {
    return talentPool.find((talent) => talent.id === id)?.name ?? id;
  }
  return TITLE_LOOKUPS[kind][id] ?? id;
}

function rateCells(cell: RateCell): string {
  return `<td>${percent(cell.winRate)}</td><td>${percent(cell.timeoutRate)}</td><td>${cell.averageTurns.toFixed(1)}</td><td>${cell.averageHealthRemaining.toFixed(0)}</td>`;
}

function deltaCell(delta: PairedDelta): string {
  const cls = delta.noisy ? "noisy" : delta.delta >= 0 ? "pos" : "neg";
  const mark = delta.noisy ? " (noisy)" : "";
  return `<td class="${cls}">${percent(delta.delta)}${mark}<div class="meta">SE ${percent(delta.se)} · n=${delta.n}</div></td>`;
}

function pairedRows(rows: PairedTierRow[], kind: keyof typeof TITLE_LOOKUPS | "talent"): string {
  return rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(titleFor(kind, row.id))}</td>${deltaCell(row.early)}${deltaCell(row.mid)}${deltaCell(row.late)}</tr>`,
    )
    .join("\n");
}

export function renderBalanceReportHtml(model: BalanceReportModel, options: ReportRunOptions): string {
  const methodology = reportMethodologyLines(options)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("\n");

  const enemyRows = model.enemies
    .map(
      (row) =>
        `<tr><td>${escapeHtml(titleFor("enemy", row.id))}</td>${rateCells(row.early)}${rateCells(row.mid)}${rateCells(row.late)}</tr>`,
    )
    .join("\n");

  const classRows = model.classes
    .map((row) => {
      const lateN = row.lateByType.normal?.winRate ?? 0;
      const lateE = row.lateByType.elite?.winRate ?? 0;
      const lateB = row.lateByType.boss?.winRate ?? 0;
      return `<tr><td>${escapeHtml(titleFor("character", row.id))}</td>${rateCells(row.early)}${rateCells(row.mid)}${rateCells(row.late)}<td>${percent(lateN)}</td><td>${percent(lateE)}</td><td>${percent(lateB)}</td></tr>`;
    })
    .join("\n");

  const matchupRows = model.classMatchups
    .sort((a, b) => a.characterId.localeCompare(b.characterId) || a.late.winRate - b.late.winRate)
    .map((row) => {
      const cards = row.topCardsLate.map((entry) => `${titleFor("card", entry.cardId)} (${entry.count})`).join(", ");
      return `<tr><td>${escapeHtml(titleFor("character", row.characterId))}</td><td>${escapeHtml(titleFor("enemy", row.enemyId))}</td><td>${escapeHtml(row.enemyType)}</td>${rateCells(row.early)}${rateCells(row.mid)}${rateCells(row.late)}<td>${escapeHtml(cards)}</td></tr>`;
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
      const cells = [row.early, row.mid, row.late]
        .map((value, index) => `<td class="${value > row.thresholds[index]! ? "neg" : ""}">${value}</td>`)
        .join("");
      return `<tr><td>${escapeHtml(row.field)}</td>${cells}</tr>`;
    })
    .join("\n");

  const { meta } = model;
  const rateHeaderTier = (label: string) =>
    `<th>Win ${label}</th><th>Timeout ${label}</th><th>Turns ${label}</th><th>HP ${label}</th>`;

  return `<!DOCTYPE html>
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
  td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #1f1f23; vertical-align: top; }
  tr:hover td { background: #1a1a1e; }
  .pos { color: #4ade80; }
  .neg { color: #f87171; }
  .noisy { color: #71717a; }
  .meta { color: #71717a; font-size: 0.8rem; margin-bottom: 1rem; }
  .scroll { overflow-x: auto; }
  a { color: #93c5fd; }
</style>
</head>
<body>
<h1>Balance Report</h1>
<p class="meta"><a href="../balance-findings.html">Findings summary</a> (preferred). This page is the full matrix — do not use it as the default read.</p>
<p class="meta">policy=${escapeHtml(meta.policy)} | loadout=${escapeHtml(meta.loadoutMode)} | iterations=${meta.iterations} | trinketIterations=${meta.trinketIterations} | cardIterations=${meta.cardIterations} | deckSeeds=${meta.deckSeeds}</p>

<h2>Simulation Methodology</h2>
<div class="meta"><ul>
${methodology}
</ul>
<p>Anomaly thresholds Early ${ANOMALY_THRESHOLD_BY_PRESET.early} / Mid ${ANOMALY_THRESHOLD_BY_PRESET.mid} / Late ${ANOMALY_THRESHOLD_BY_PRESET.late}.</p>
</div>

<h2>Enemy Rankings</h2>
<p class="meta">Sorted by Late win rate ascending (hardest at top). Timeout and remaining HP distinguish stalls from true losses.</p>
<div class="scroll"><table><thead><tr><th>Enemy</th>${rateHeaderTier("Early")}${rateHeaderTier("Mid")}${rateHeaderTier("Late")}</tr></thead><tbody>
${enemyRows}
</tbody></table></div>

<h2>Class Rankings</h2>
<p class="meta">Overall columns weight Normal / Elite / Boss equally. Late type split is raw win rate within that enemy type.</p>
<div class="scroll"><table><thead><tr><th>Class</th>${rateHeaderTier("Early")}${rateHeaderTier("Mid")}${rateHeaderTier("Late")}<th>Late Normal</th><th>Late Elite</th><th>Late Boss</th></tr></thead><tbody>
${classRows}
</tbody></table></div>

<h2>Class Matchups</h2>
<p class="meta">Per class vs each enemy. Late top cards are play counts from core scenarios.</p>
<div class="scroll"><table><thead><tr><th>Class</th><th>Enemy</th><th>Type</th>${rateHeaderTier("Early")}${rateHeaderTier("Mid")}${rateHeaderTier("Late")}<th>Late top cards</th></tr></thead><tbody>
${matchupRows}
</tbody></table></div>

<h2>Boon Rankings</h2>
<p class="meta">Paired delta vs no-boon baseline (same deck/seed/matchup). Noisy = |delta| &lt; 2 SE.</p>
<div class="scroll"><table><thead><tr><th>Boon</th><th>Delta Early</th><th>Delta Mid</th><th>Delta Late</th></tr></thead><tbody>
${pairedRows(model.boons, "boon")}
</tbody></table></div>

<h2>Card Rankings — isolated vs Skeleton</h2>
<p class="meta">Target card + 9 random others vs random 10-card baseline. Paired seeds.</p>
<div class="scroll"><table><thead><tr><th>Card</th><th>Delta Early</th><th>Delta Mid</th><th>Delta Late</th></tr></thead><tbody>
${pairedRows(model.cardsIsolatedSkeleton, "card")}
</tbody></table></div>

<h2>Card Rankings — isolated vs Mimic</h2>
<div class="scroll"><table><thead><tr><th>Card</th><th>Delta Early</th><th>Delta Mid</th><th>Delta Late</th></tr></thead><tbody>
${pairedRows(model.cardsIsolatedElite, "card")}
</tbody></table></div>

<h2>Card Rankings — in-class decks</h2>
<p class="meta">Insert (or remove-then-compare) the card in a class-identity deck vs Skeleton.</p>
<div class="scroll"><table><thead><tr><th>Card</th><th>Delta Early</th><th>Delta Mid</th><th>Delta Late</th></tr></thead><tbody>
${pairedRows(model.cardsInClass, "card")}
</tbody></table></div>

<h2>Talent ablation</h2>
<p class="meta">Affinity combat talents on vs off, class decks, gauntlet enemies, paired.</p>
<div class="scroll"><table><thead><tr><th>Talent</th><th>Delta Early</th><th>Delta Mid</th><th>Delta Late</th></tr></thead><tbody>
${pairedRows(model.talents, "talent")}
</tbody></table></div>

<h2>Companion ablation</h2>
<p class="meta">Summon card in vs out of class decks on the gauntlet.</p>
<div class="scroll"><table><thead><tr><th>Companion</th><th>Delta Early</th><th>Delta Mid</th><th>Delta Late</th></tr></thead><tbody>
${pairedRows(model.companions, "companion")}
</tbody></table></div>

<h2>Anomalies</h2>
<div class="scroll"><table><thead><tr><th>Field</th><th>Max Value</th><th>Battles</th><th>Peak Scenario</th></tr></thead><tbody>
${anomalyRows}
</tbody></table></div>

<h2>All Anomaly Metrics</h2>
<div class="scroll"><table><thead><tr><th>Field</th><th>Early</th><th>Mid</th><th>Late</th></tr></thead><tbody>
${metricRows}
</tbody></table></div>
</body>
</html>`;
}

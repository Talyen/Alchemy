import {
  FINDING_BUCKET_LABELS,
  FINDING_BUCKET_ORDER,
  type BalanceFinding,
  type BalanceFindingsReport,
  type FindingBucket,
  type FindingMetric,
} from "./findings";
import {
  ANOMALY_FINDING_THRESHOLDS,
  EQUITY_SPREAD,
  FINDINGS_CAP,
  LENGTH_BAND_BY_TYPE,
  MATERIAL_TIMEOUT_RATE,
  WIN_RATE_BAND_BY_TYPE,
} from "./findings-bands";
import type { BalanceReportModel } from "./report-model";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function formatObserved(metric: FindingMetric, value: number): string {
  if (metric === "averageTurns") return value.toFixed(1);
  if (metric === "anomaly") return String(Math.round(value));
  return `${(value * 100).toFixed(1)}%`;
}

function severityClass(severity: BalanceFinding["severity"]): string {
  if (severity === "critical") return "neg";
  if (severity === "serious") return "warn";
  return "noisy";
}

function bucketSummary(findings: BalanceFindingsReport): string {
  return FINDING_BUCKET_ORDER.map((bucket) => {
    const shown = findings.shownByBucket[bucket];
    const omitted = findings.omittedByBucket[bucket];
    if (shown === 0 && omitted === 0) return "";
    return `<span class="chip">${escapeHtml(FINDING_BUCKET_LABELS[bucket])}: ${shown} shown${omitted > 0 ? `, ${omitted} omitted` : ""}</span>`;
  })
    .filter(Boolean)
    .join(" ");
}

function findingRow(finding: BalanceFinding): string {
  const hint = finding.causeHint ? `<div class="hint">${escapeHtml(finding.causeHint)}</div>` : "";
  const cluster =
    finding.clusterSize && finding.clusterSize > 1
      ? `<div class="hint">${finding.clusterSize} class matchups collapsed to the worst.</div>`
      : "";
  return `<tr>
<td class="${severityClass(finding.severity)}">${escapeHtml(finding.severity)}</td>
<td>${escapeHtml(finding.scope)}</td>
<td>${escapeHtml(finding.title)}</td>
<td>${escapeHtml(finding.tier)}</td>
<td>${escapeHtml(formatObserved(finding.metric, finding.observed))}</td>
<td>${escapeHtml(finding.band)}</td>
<td>${escapeHtml(finding.worstScenario)}${hint}${cluster}</td>
<td>${escapeHtml(finding.recommendation)}</td>
</tr>`;
}

function bucketSection(bucket: FindingBucket, rows: readonly BalanceFinding[]): string {
  if (rows.length === 0) return "";
  return `<h2>${escapeHtml(FINDING_BUCKET_LABELS[bucket])}</h2>
<div class="scroll"><table><thead><tr>
<th>Severity</th><th>Scope</th><th>Subject</th><th>Tier</th><th>Observed</th><th>Band</th><th>Scenario</th><th>What to discuss</th>
</tr></thead><tbody>
${rows.map(findingRow).join("\n")}
</tbody></table></div>`;
}

export function renderBalanceFindingsHtml(
  findings: BalanceFindingsReport,
  model: BalanceReportModel,
  fullMatrixHref = "balance-full/matrix.html",
): string {
  const { meta } = model;
  const byBucket = Object.fromEntries(FINDING_BUCKET_ORDER.map((bucket) => [bucket, [] as BalanceFinding[]])) as Record<
    FindingBucket,
    BalanceFinding[]
  >;
  for (const finding of findings.findings) {
    byBucket[finding.bucket].push(finding);
  }
  const sections = FINDING_BUCKET_ORDER.map((bucket) => bucketSection(bucket, byBucket[bucket])).join("\n");
  const empty = findings.findings.length === 0 ? '<p class="meta">No findings vs target bands.</p>' : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Balance Findings</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #0f0f12; color: #d4d4d8; padding: 2rem; max-width: 72rem; }
  h1 { color: #e4e4e7; border-bottom: 1px solid #27272a; padding-bottom: 0.5rem; }
  h2 { color: #a1a1aa; margin-top: 2rem; font-size: 1.05rem; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; font-size: 0.875rem; }
  th { background: #18181b; color: #a1a1aa; text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #27272a; font-weight: 600; }
  td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #1f1f23; vertical-align: top; }
  tr:hover td { background: #1a1a1e; }
  .pos { color: #4ade80; }
  .neg { color: #f87171; }
  .warn { color: #fbbf24; }
  .noisy { color: #71717a; }
  .meta { color: #71717a; font-size: 0.8rem; margin-bottom: 0.75rem; }
  .hint { color: #71717a; font-size: 0.8rem; margin-top: 0.25rem; }
  .chip { display: inline-block; background: #18181b; border: 1px solid #27272a; border-radius: 999px; padding: 0.15rem 0.6rem; margin: 0 0.35rem 0.35rem 0; font-size: 0.75rem; color: #a1a1aa; }
  a { color: #93c5fd; }
  .scroll { overflow-x: auto; }
</style>
</head>
<body>
<h1>Balance Findings</h1>
<p class="meta">policy=${escapeHtml(meta.policy)} | loadout=${escapeHtml(meta.loadoutMode)} | iterations=${meta.iterations} | ${findings.findings.length} of ${findings.totalBeforeCap} after grouping (cap ${FINDINGS_CAP}, omitted ${findings.omitted})</p>
<p class="meta">Matchups collapse to the worst class per enemy / tier / metric. The cap then round-robins issue types so stalls, 0/100, length, equity, and anomalies are not crowded out by one boss-WR cluster. Recommendations are discussion prompts — do not apply tunings until reviewed.</p>
<p class="meta">${bucketSummary(findings)}</p>
<p class="meta"><a href="${escapeHtml(fullMatrixHref)}">Open full matrix</a></p>

<h2>Target bands</h2>
<p class="meta">Never 0% or 100%. Mid/Late: Normal ${(WIN_RATE_BAND_BY_TYPE.normal.min * 100).toFixed(0)}–${(WIN_RATE_BAND_BY_TYPE.normal.max * 100).toFixed(1)}%, Elite ${(WIN_RATE_BAND_BY_TYPE.elite.min * 100).toFixed(0)}–${(WIN_RATE_BAND_BY_TYPE.elite.max * 100).toFixed(0)}%, Boss ≥${(WIN_RATE_BAND_BY_TYPE.boss.min * 100).toFixed(0)}% and &lt;100%. Length: Normal ${LENGTH_BAND_BY_TYPE.normal.min}–${LENGTH_BAND_BY_TYPE.normal.max} / Elite ${LENGTH_BAND_BY_TYPE.elite.min}–${LENGTH_BAND_BY_TYPE.elite.max} / Boss ${LENGTH_BAND_BY_TYPE.boss.min}–${LENGTH_BAND_BY_TYPE.boss.max} turns. Equity ${EQUITY_SPREAD * 100}pp. Timeouts ≥${(MATERIAL_TIMEOUT_RATE * 100).toFixed(0)}% are stalls. Anomalies Early ${ANOMALY_FINDING_THRESHOLDS.early} / Mid ${ANOMALY_FINDING_THRESHOLDS.mid} / Late ${ANOMALY_FINDING_THRESHOLDS.late}.</p>
${empty}
${sections}
</body>
</html>`;
}

export function formatFindingObserved(metric: FindingMetric, value: number): string {
  return formatObserved(metric, value);
}

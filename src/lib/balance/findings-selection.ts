import {
  FINDING_BUCKET_ORDER,
  type BalanceFinding,
  type BalanceFindingsReport,
  type FindingBucket,
  type FindingSeverity,
} from "./findings-types";

const SEVERITY_RANK: Record<FindingSeverity, number> = { critical: 0, serious: 1, watch: 2 };

function findingKey(finding: BalanceFinding): string {
  return `${finding.scope}:${finding.id}:${finding.tier}:${finding.metric}:${finding.bucket}`;
}

function scoreFinding(finding: BalanceFinding): number {
  const severity = (2 - SEVERITY_RANK[finding.severity]) * 10;
  switch (finding.metric) {
    case "winRate":
      return severity + Math.abs(finding.observed - 0.85);
    case "averageTurns":
      return severity + Math.abs(finding.observed - 6) / 10;
    case "timeoutRate":
      return severity + finding.observed;
    case "delta":
      return severity + Math.abs(finding.observed);
    case "anomaly":
      return severity + finding.observed / 1000;
    default:
      return severity;
  }
}

function compareFindings(a: BalanceFinding, b: BalanceFinding): number {
  return scoreFinding(b) - scoreFinding(a) || a.id.localeCompare(b.id);
}

export function selectBalanceFindings(candidates: readonly BalanceFinding[], cap: number): BalanceFindingsReport {
  const byKey = new Map<string, BalanceFinding>();
  for (const finding of candidates) {
    const key = findingKey(finding);
    const existing = byKey.get(key);
    if (!existing || SEVERITY_RANK[finding.severity] < SEVERITY_RANK[existing.severity]) byKey.set(key, finding);
  }
  const ranked = [...byKey.values()].sort(compareFindings);
  const collapsed = collapseMatchupClusters(ranked);
  const selected = selectDiverseFindings(collapsed, cap);
  const shownByBucket = emptyBucketCounts();
  const omittedByBucket = emptyBucketCounts();
  for (const finding of collapsed) {
    omittedByBucket[finding.bucket] += 1;
  }
  for (const finding of selected) {
    shownByBucket[finding.bucket] += 1;
    omittedByBucket[finding.bucket] -= 1;
  }
  return {
    findings: orderFindingsForDisplay(selected),
    cap,
    omitted: Math.max(0, collapsed.length - selected.length),
    totalBeforeCap: collapsed.length,
    shownByBucket,
    omittedByBucket,
  };
}

function emptyBucketCounts(): Record<FindingBucket, number> {
  return Object.fromEntries(FINDING_BUCKET_ORDER.map((bucket) => [bucket, 0])) as Record<FindingBucket, number>;
}

function matchupEnemyId(finding: BalanceFinding): string {
  const sep = finding.id.indexOf(":");
  return sep === -1 ? finding.id : finding.id.slice(sep + 1);
}

function collapseMatchupClusters(ranked: readonly BalanceFinding[]): BalanceFinding[] {
  const kept: BalanceFinding[] = [];
  const groups = new Map<string, { best: BalanceFinding; count: number }>();
  for (const finding of ranked) {
    if (finding.scope !== "matchup") {
      kept.push(finding);
      continue;
    }
    const key = `${matchupEnemyId(finding)}:${finding.tier}:${finding.metric}:${finding.bucket}`;
    const group = groups.get(key);
    // Ranked input puts the representative first, including the ID tie-break.
    if (group) group.count += 1;
    else groups.set(key, { best: finding, count: 1 });
  }
  for (const { best, count } of groups.values()) {
    if (count === 1) {
      kept.push(best);
      continue;
    }
    kept.push({
      ...best,
      clusterSize: count,
      worstScenario: `${best.worstScenario} · worst of ${count} classes`,
    });
  }
  return kept.sort(compareFindings);
}

function selectDiverseFindings(ranked: readonly BalanceFinding[], cap: number): BalanceFinding[] {
  const buckets = FINDING_BUCKET_ORDER.map((bucket) => ranked.filter((finding) => finding.bucket === bucket));
  const shown: BalanceFinding[] = [];
  for (let round = 0; shown.length < cap; round++) {
    const next = buckets.flatMap((bucket) => bucket[round] ?? []);
    if (next.length === 0) break;
    shown.push(...next.slice(0, cap - shown.length));
  }
  return shown;
}

function orderFindingsForDisplay(findings: readonly BalanceFinding[]): BalanceFinding[] {
  // Round-robin selection already preserves ranking within each bucket.
  return FINDING_BUCKET_ORDER.flatMap((bucket) => findings.filter((finding) => finding.bucket === bucket));
}

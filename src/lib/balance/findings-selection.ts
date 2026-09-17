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

function keepBetter(existing: BalanceFinding | undefined, next: BalanceFinding): BalanceFinding {
  if (!existing) return next;
  if (SEVERITY_RANK[next.severity] < SEVERITY_RANK[existing.severity]) return next;
  return existing;
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

const SCORE_CACHE = new WeakMap<BalanceFinding, number>();

function getScore(finding: BalanceFinding): number {
  let score = SCORE_CACHE.get(finding);
  if (score === undefined) {
    score = scoreFinding(finding);
    SCORE_CACHE.set(finding, score);
  }
  return score;
}

export function selectBalanceFindings(candidates: readonly BalanceFinding[], cap: number): BalanceFindingsReport {
  const byKey = new Map<string, BalanceFinding>();
  for (const finding of candidates) {
    const key = findingKey(finding);
    byKey.set(key, keepBetter(byKey.get(key), finding));
  }
  const ranked = [...byKey.values()].sort((a, b) => getScore(b) - getScore(a) || a.id.localeCompare(b.id));
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
  return {
    timeout: 0,
    floorCeiling: 0,
    typeWinRate: 0,
    length: 0,
    equity: 0,
    paired: 0,
    anomaly: 0,
  };
}

function matchupEnemyId(finding: BalanceFinding): string {
  const sep = finding.id.indexOf(":");
  return sep === -1 ? finding.id : finding.id.slice(sep + 1);
}

function collapseMatchupClusters(findings: readonly BalanceFinding[]): BalanceFinding[] {
  const kept: BalanceFinding[] = [];
  const groups = new Map<string, BalanceFinding[]>();
  for (const finding of findings) {
    if (finding.scope !== "matchup") {
      kept.push(finding);
      continue;
    }
    const key = `${matchupEnemyId(finding)}:${finding.tier}:${finding.metric}:${finding.bucket}`;
    const list = groups.get(key) ?? [];
    list.push(finding);
    groups.set(key, list);
  }
  for (const group of groups.values()) {
    const best = [...group].sort((a, b) => getScore(b) - getScore(a) || a.id.localeCompare(b.id))[0];
    if (!best) continue;
    if (group.length === 1) {
      kept.push(best);
      continue;
    }
    kept.push({
      ...best,
      clusterSize: group.length,
      worstScenario: `${best.worstScenario} · worst of ${group.length} classes`,
    });
  }
  return kept.sort((a, b) => getScore(b) - getScore(a) || a.id.localeCompare(b.id));
}

function selectDiverseFindings(ranked: readonly BalanceFinding[], cap: number): BalanceFinding[] {
  const queues = new Map<FindingBucket, BalanceFinding[]>();
  for (const bucket of FINDING_BUCKET_ORDER) queues.set(bucket, []);
  for (const finding of ranked) {
    queues.get(finding.bucket)?.push(finding);
  }
  const shown: BalanceFinding[] = [];
  const seen = new Set<string>();
  while (shown.length < cap) {
    let added = false;
    for (const bucket of FINDING_BUCKET_ORDER) {
      const queue = queues.get(bucket);
      const next = queue?.shift();
      if (!next) continue;
      const key = findingKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      shown.push(next);
      added = true;
      if (shown.length >= cap) break;
    }
    if (!added) break;
  }
  return shown;
}

function orderFindingsForDisplay(findings: readonly BalanceFinding[]): BalanceFinding[] {
  const bucketRank = Object.fromEntries(FINDING_BUCKET_ORDER.map((bucket, index) => [bucket, index])) as Record<
    FindingBucket,
    number
  >;
  return [...findings].sort(
    (a, b) => bucketRank[a.bucket] - bucketRank[b.bucket] || getScore(b) - getScore(a) || a.id.localeCompare(b.id),
  );
}

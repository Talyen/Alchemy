import fs from "node:fs";
import path from "node:path";
import { reportRetentionPlan } from "./report-retention.mjs";

const POLICY = "managed-runs-v1";

// Existing bundles predate this contract and may contain unique evidence.
// A producer writes the marker only after it has completed the entire copy.
export function pruneIntegratedRuns(root, { now = Date.now(), dryRun = false } = {}) {
  const reports = path.join(root, "reports");
  const bundles = path.join(reports, "integrations");
  for (const dir of [root, reports, bundles]) {
    const stat = fs.lstatSync(dir, { throwIfNoEntry: false });
    if (!stat?.isDirectory() || stat.isSymbolicLink()) return [];
    if (fs.existsSync(path.join(dir, ".retention-keep")) || fs.existsSync(path.join(dir, ".retention-owner.json")))
      return [];
  }
  const removed = [];
  for (const entry of fs.readdirSync(bundles, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || /trailer/iu.test(entry.name)) continue;
    const bundle = path.join(bundles, entry.name);
    try {
      const markerPath = path.join(bundle, "integration.json");
      const markerStat = fs.lstatSync(markerPath);
      if (!markerStat.isFile() || markerStat.isSymbolicLink() || markerStat.size > 256_000) continue;
      const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
      if (
        marker.retentionPolicy !== POLICY ||
        typeof marker.branch !== "string" ||
        !/^agent\/[a-z0-9-]+$/u.test(marker.branch) ||
        !/^[a-f0-9]{40,64}$/u.test(marker.commit ?? "") ||
        typeof marker.originalCheckout !== "string" ||
        /trailer/iu.test(marker.branch + marker.originalCheckout) ||
        !Array.isArray(marker.evidence) ||
        marker.evidence.some((entry) => typeof entry !== "string" || /trailer/iu.test(entry))
      )
        continue;
      const plan = reportRetentionPlan(bundle, { now });
      if (plan.incomplete || !plan.expiringCandidates.length) continue;
      const confirmation = reportRetentionPlan(bundle, { now });
      if (confirmation.incomplete) continue;
      for (const candidate of plan.expiringCandidates) {
        if (removed.length >= 64) return removed;
        if (!/^reports\/runs\/[a-z0-9-]+$/u.test(candidate.path) || /trailer/iu.test(candidate.path + candidate.family))
          continue;
        const verified = confirmation.expiringCandidates.find((item) => item.path === candidate.path);
        if (
          !verified ||
          verified.expireAfter !== candidate.expireAfter ||
          verified.metadataFingerprint !== candidate.metadataFingerprint
        )
          continue;
        const target = path.join(bundle, candidate.path);
        if (!dryRun) fs.rmSync(target, { recursive: true });
        removed.push({ path: path.relative(root, target), bytes: candidate.logicalBytes });
      }
    } catch {
      // Unknown, incomplete, linked or concurrently changed evidence remains.
    }
  }
  return removed;
}

export const INTEGRATION_RETENTION_POLICY = POLICY;

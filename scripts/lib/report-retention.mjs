import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

const day = 86_400_000;
const legacyToolPaths = [".cache/lyrics/venv", ".cache/font-tools", "reports/boss-lyrics/venv"];

function legacyToolEnvironments(rootDir) {
  return legacyToolPaths.flatMap((relative) => {
    let current = rootDir;
    try {
      for (const segment of relative.split("/")) {
        current = path.join(current, segment);
        const stat = fs.lstatSync(current, { throwIfNoEntry: false });
        if (!stat) return [];
        if (stat.isSymbolicLink()) return [{ path: relative, reason: "Linked path; ownership unknown" }];
        if (!stat.isDirectory()) return [{ path: relative, reason: "Unexpected path type; preserved" }];
      }
      return [{ path: relative, reason: "Legacy environment; ownership unknown" }];
    } catch {
      return [{ path: relative, reason: "Cannot inspect path; preserved" }];
    }
  });
}
// A review threshold is not permission to destroy unique diagnostics.
export function reportRetentionPlan(rootDir, { now = Date.now(), budget = 1024 ** 3, maxEntries = 50_000 } = {}) {
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(budget) ||
    budget <= 0 ||
    !Number.isSafeInteger(maxEntries) ||
    maxEntries < 1
  )
    throw new Error("Invalid evidence review age/size limits");
  const base = path.join(rootDir, "reports/runs");
  const plan = {
    schema: 1,
    kind: "alchemy-retention-review",
    generatedAt: new Date(now).toISOString(),
    budget,
    allocatedFileBytes: 0,
    protected: 0,
    candidates: [],
    expiringCandidates: [],
    legacyToolEnvironments: legacyToolEnvironments(rootDir),
    permanentDeletionApproved: false,
    note: "Legacy diagnostics require exact-batch approval; marked runs can expire by policy. APFS allocation is not unique physical space.",
  };
  const reportsRoot = fs.lstatSync(path.join(rootDir, "reports"), { throwIfNoEntry: false });
  if (!reportsRoot?.isDirectory() || reportsRoot.isSymbolicLink()) return plan;
  const ancestorPinned = [rootDir, path.join(rootDir, "reports"), base].some(
    (directory) =>
      fs.existsSync(path.join(directory, ".retention-keep")) ||
      fs.existsSync(path.join(directory, ".retention-owner.json")),
  );
  const root = fs.lstatSync(base, { throwIfNoEntry: false });
  if (!root?.isDirectory() || root.isSymbolicLink()) return plan;
  const records = [],
    references = new Set();
  let visited = 0;
  function inventory(directory) {
    const files = [],
      pending = [directory];
    let bytes = 0,
      allocated = 0,
      newest = 0,
      pinned = ancestorPinned;
    while (pending.length) {
      if (++visited > maxEntries)
        throw new Error("Routine-evidence review inventory limit reached; all evidence preserved");
      const file = pending.pop(),
        item = fs.lstatSync(file);
      if (item.isSymbolicLink()) throw new Error("Symlink evidence is caller-owned");
      if (path.basename(file) === ".retention-keep" || path.basename(file).endsWith(".retention-owner.json"))
        pinned = true;
      if (item.isDirectory()) for (const name of fs.readdirSync(file)) pending.push(path.join(file, name));
      else if (item.isFile()) {
        bytes += item.size;
        allocated += item.blocks * 512;
        newest = Math.max(newest, item.mtimeMs);
        files.push([path.relative(directory, file), item.ino, item.size, item.mtimeMs]);
      } else throw new Error("Unexpected evidence file type; preserved");
    }
    files.sort((a, b) => a[0].localeCompare(b[0]));
    return {
      logicalBytes: bytes,
      allocatedBytes: allocated,
      newest,
      pinned,
      metadataFingerprint: createHash("sha256").update(JSON.stringify(files)).digest("hex"),
    };
  }
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      plan.protected++;
      plan.incomplete = "Unknown run ownership or references; evidence preserved";
      continue;
    }
    const directory = path.join(base, entry.name),
      pointer = path.join(directory, "run.json");
    try {
      const file = fs.lstatSync(pointer);
      if (!file.isFile() || file.isSymbolicLink() || file.size > 256_000) throw new Error("Unknown run receipt");
      const receipt = JSON.parse(fs.readFileSync(pointer, "utf8"));
      if (
        !["passed", "failed"].includes(receipt.status) ||
        typeof receipt.command !== "string" ||
        receipt.runId !== entry.name
      )
        throw new Error("Unknown run ownership/status");
      const info = inventory(directory);
      plan.allocatedFileBytes += info.allocatedBytes;
      records.push({
        path: path.relative(rootDir, directory),
        id: entry.name,
        family: receipt.command,
        status: receipt.status,
        expiring: receipt.retention === "expiring-v1",
        finished: Date.parse(receipt.generatedAt),
        ...info,
      });
      for (const artifact of receipt.artifacts ?? []) {
        const match = /^reports\/runs\/([^/]+)(?:\/|$)/u.exec(artifact.path ?? "");
        if (match) references.add(match[1]);
      }
    } catch (error) {
      plan.protected++;
      plan.incomplete = "Unknown run ownership or references; evidence preserved";
      if (visited > maxEntries) {
        plan.incomplete = error.message;
        break;
      }
    }
  }
  const latest = new Map();
  const currentPath = path.join(rootDir, "reports/current-run.json");
  if (fs.existsSync(currentPath)) {
    try {
      const pointer = fs.lstatSync(currentPath);
      if (!pointer.isFile() || pointer.isSymbolicLink() || pointer.size > 256_000)
        throw new Error("Unknown current run");
      const current = JSON.parse(fs.readFileSync(currentPath, "utf8"));
      if (typeof current.runId !== "string") throw new Error("Invalid current run");
      references.add(current.runId);
      for (const artifact of current.artifacts ?? []) {
        const match = /^reports\/runs\/([^/]+)(?:\/|$)/u.exec(artifact.path ?? "");
        if (match) references.add(match[1]);
      }
    } catch {
      plan.incomplete = "Current run pointer cannot be read; evidence preserved";
    }
  }
  for (const record of records) {
    const key = JSON.stringify([record.family, record.status]);
    if (!latest.has(key) || latest.get(key).newest < record.newest) latest.set(key, record);
  }
  let considered = plan.allocatedFileBytes;
  for (const record of records.sort((a, b) => a.newest - b.newest)) {
    if (
      !Number.isFinite(record.finished) ||
      record.pinned ||
      references.has(record.id) ||
      latest.get(JSON.stringify([record.family, record.status])) === record
    ) {
      plan.protected++;
      continue;
    }
    const age = now - Math.max(record.newest, record.finished);
    if (age < (record.status === "passed" ? day : 3 * day) && !(age >= day && considered > budget)) continue;
    const candidate = {
      path: record.path,
      logicalBytes: record.logicalBytes,
      allocatedFileBytes: record.allocatedBytes,
      metadataFingerprint: record.metadataFingerprint,
      status: record.status,
      family: record.family,
      purpose: "Historical command diagnostics",
      recovery: record.expiring
        ? "Not verified restorable; expires by policy"
        : "Not verified restorable; explicit approval required",
      action: record.expiring ? "expire by policy" : "review-only",
      ...(record.expiring
        ? { expireAfter: Math.max(record.newest, record.finished) + (record.status === "passed" ? 30 : 90) * day }
        : {}),
    };
    if (record.expiring && candidate.expireAfter <= now && plan.expiringCandidates.length < 64)
      plan.expiringCandidates.push(candidate);
    if (plan.candidates.length < 64) plan.candidates.push(candidate);
    else plan.moreCandidates = true;
    considered -= record.allocatedBytes;
  }
  plan.overBudget = plan.allocatedFileBytes > budget;
  return plan;
}

export function writeRetentionReview(rootDir, options = {}) {
  const plan = reportRetentionPlan(rootDir, options);
  const reports = path.join(rootDir, "reports");
  if (plan.legacyToolEnvironments.length && !fs.lstatSync(reports, { throwIfNoEntry: false })) fs.mkdirSync(reports);
  const item = fs.lstatSync(reports, { throwIfNoEntry: false });
  if (!item?.isDirectory() || item.isSymbolicLink()) return plan;
  const target = path.join(reports, "retention-review.json"),
    current = fs.lstatSync(target, { throwIfNoEntry: false });
  if (current) {
    if (!current.isFile() || current.isSymbolicLink()) throw new Error("Retention review destination is caller-owned");
    const previous = JSON.parse(fs.readFileSync(target, "utf8"));
    if (previous.kind !== plan.kind) throw new Error("Unknown retention review destination; preserved");
  }
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  let owned = false;
  try {
    fs.writeFileSync(temporary, JSON.stringify(plan, null, 2) + "\n", { flag: "wx" });
    owned = true;
    fs.renameSync(temporary, target);
  } finally {
    if (owned) fs.rmSync(temporary, { force: true });
  }
  return plan;
}

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Only isolated outputs of participating, failed local packaging attempts are
// candidates. Fixed-path successes and unknown pre-existing output remain.
const TARGETS = new Set(["dist", "dist-demo", "release-desktop", "release-desktop-demo"]);
const RECEIPTS = ".cache/build-retention";
const DAY = 86_400_000;

function receiptDir(root) {
  const cache = path.join(root, ".cache");
  const stats = fs.lstatSync(cache, { throwIfNoEntry: false });
  if (stats && (!stats.isDirectory() || stats.isSymbolicLink())) throw new Error("Unsafe build retention cache");
  const dir = path.join(root, RECEIPTS);
  const existing = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (existing && (!existing.isDirectory() || existing.isSymbolicLink()))
    throw new Error("Unsafe build retention receipts");
  return dir;
}
function save(root, receipt) {
  const dir = receiptDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${receipt.id}.json`);
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(receipt) + "\n", { flag: "wx" });
  fs.renameSync(temp, file);
}
function snapshot(target) {
  const entries = [];
  const visit = (file, relative) => {
    const s = fs.lstatSync(file);
    if (s.isSymbolicLink() || (!s.isDirectory() && !s.isFile()) || path.basename(file) === ".keep")
      throw new Error("Protected output");
    entries.push([relative, s.dev, s.ino, s.mode, s.size, s.mtimeMs, s.ctimeMs]);
    if (s.isDirectory())
      for (const name of fs.readdirSync(file).sort()) visit(path.join(file, name), path.join(relative, name));
  };
  visit(target, ".");
  return entries;
}
export function beginBuildAttempt(root, { kind, target, eligible = false, now = Date.now() }) {
  if (!TARGETS.has(target) || !["build", "package"].includes(kind)) throw new Error("Unknown build retention target");
  const attempt = {
    version: 1,
    id: crypto.randomUUID(),
    kind,
    target,
    started: now,
    state: "running",
    eligible: eligible && kind === "package" && !fs.lstatSync(path.join(root, target), { throwIfNoEntry: false }),
  };
  if (attempt.eligible) attempt.staging = path.join(RECEIPTS, "attempts", attempt.id, "output");
  save(root, attempt);
  if (attempt.staging) {
    const attempts = path.join(root, RECEIPTS, "attempts");
    const stats = fs.lstatSync(attempts, { throwIfNoEntry: false });
    if (stats && (!stats.isDirectory() || stats.isSymbolicLink())) throw new Error("Unsafe build attempts directory");
    fs.mkdirSync(attempts, { recursive: true });
    fs.mkdirSync(path.dirname(path.join(root, attempt.staging)), { mode: 0o700 });
  }
  return attempt;
}
export function finishBuildAttempt(root, attempt, success, now = Date.now()) {
  const receipt = { ...attempt, finished: now, state: success ? "success" : "failed" };
  if (!success && receipt.eligible) {
    try {
      receipt.snapshot = snapshot(path.join(root, receipt.staging));
    } catch {
      receipt.eligible = false;
    }
  }
  save(root, receipt);
}
export function promotePackageAttempt(root, attempt) {
  if (!/^[a-f0-9-]{36}$/u.test(attempt.id)) throw new Error("Invalid build attempt identity");
  const expected = path.join(RECEIPTS, "attempts", attempt.id, "output");
  if (attempt.kind !== "package" || !TARGETS.has(attempt.target) || attempt.staging !== expected)
    throw new Error("Invalid package staging path");
  receiptDir(root);
  const source = path.join(root, expected);
  for (const dir of [path.join(root, RECEIPTS, "attempts"), path.dirname(source), source]) {
    const stats = fs.lstatSync(dir);
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error("Unsafe package staging path");
  }
  const destination = path.join(root, attempt.target);
  fs.mkdirSync(destination);
  try {
    fs.renameSync(source, destination);
  } catch (error) {
    try {
      fs.rmdirSync(destination);
    } catch {
      /* Preserve a nonempty or unavailable destination. */
    }
    throw error;
  }
}
export function protectPackageAttempts(root, target) {
  if (!TARGETS.has(target)) throw new Error("Unknown package target");
  save(root, {
    version: 1,
    id: crypto.randomUUID(),
    kind: "package",
    target,
    state: "distributed",
    finished: Date.now(),
  });
}
function readReceipts(root) {
  const dir = receiptDir(root);
  if (!fs.existsSync(dir)) return [];
  const result = [];
  for (const name of fs.readdirSync(dir)) {
    if (!/^[a-f0-9-]{36}\.json$/u.test(name)) continue;
    try {
      const file = path.join(dir, name);
      const s = fs.lstatSync(file);
      if (!s.isFile() || s.isSymbolicLink()) return null;
      const value = JSON.parse(fs.readFileSync(file, "utf8"));
      if (value.version !== 1 || `${value.id}.json` !== name || !TARGETS.has(value.target)) return null;
      result.push(value);
    } catch {
      return null;
    }
  }
  return result;
}
export function pruneFailedBuilds(root, { dryRun = false, now = Date.now() } = {}) {
  const receipts = readReceipts(root);
  const removed = [];
  if (!receipts) return removed;
  for (const item of receipts) {
    if (
      item.kind !== "package" ||
      item.state !== "failed" ||
      item.eligible !== true ||
      !Array.isArray(item.snapshot) ||
      !Number.isFinite(item.started) ||
      !Number.isFinite(item.finished) ||
      item.finished > now - DAY
    )
      continue;
    if (
      receipts.some(
        (other) =>
          other.id !== item.id &&
          other.target === item.target &&
          (other.state === "running" ||
            (["distributed", "success"].includes(other.state) && other.finished >= item.started)),
      )
    )
      continue;
    const expectedStaging = path.join(RECEIPTS, "attempts", item.id, "output");
    if (item.staging !== expectedStaging) continue;
    const target = path.join(root, expectedStaging);
    const attempts = path.join(root, RECEIPTS, "attempts");
    const parent = path.dirname(target);
    if (
      [attempts, parent].some((dir) => {
        const stats = fs.lstatSync(dir, { throwIfNoEntry: false });
        return !stats?.isDirectory() || stats.isSymbolicLink();
      })
    )
      continue;
    try {
      if (JSON.stringify(snapshot(target)) !== JSON.stringify(item.snapshot)) continue;
      const bytes = item.snapshot.reduce(
        (sum, entry) => sum + (entry[2] && (entry[3] & 0o170000) === 0o100000 ? entry[4] : 0),
        0,
      );
      if (!dryRun) {
        fs.rmSync(target, { recursive: true });
        save(root, { ...item, state: "removed", eligible: false });
      }
      removed.push({ path: expectedStaging, bytes });
    } catch {
      /* Missing, changed, linked or unreadable output stays protected. */
    }
  }
  return removed;
}

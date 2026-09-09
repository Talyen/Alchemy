import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const REUSABLE_COMMANDS = new Set(["related", "unit-changed", "unit-save", "unit-desktop", "unit-performance"]);
// Only fast deterministic unit selections reuse receipts: docs-check,
// assets-check, and report-balance are excluded because they are slow,
// environment-sensitive, or produce artifacts the receipt cannot vouch for.
const MAX_AGE_MS = 60 * 60 * 1000;
const VOLATILE_ENV =
  /^(?:ALCHEMY_RUN_ID|ALCHEMY_VERIFY_FRESH|npm_lifecycle_event|npm_lifecycle_script|npm_command|npm_package_json|INIT_CWD|SHLVL|_)$/u;

function fileIdentity(filename, hash, rootDir) {
  try {
    const stat = fs.lstatSync(filename, { bigint: true });
    hash.update(
      `${path.relative(rootDir, filename)}\0${stat.mode}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}:${stat.ino}\0`,
    );
    if (stat.isSymbolicLink()) {
      const target = fs.realpathSync(filename);
      const dependencies = `${path.join(rootDir, "node_modules")}${path.sep}`;
      if (
        !filename.startsWith(dependencies) ||
        !target.startsWith(dependencies) ||
        /node_modules[/\\]\.(?:cache|vite)/u.test(target)
      )
        throw new Error("Linked input outside installed dependencies");
      hash.update(fs.readlinkSync(filename));
    }
    return stat;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    hash.update(`${path.relative(rootDir, filename)}\0missing\0`);
    return null;
  }
}

export function captureVerificationInputs(rootDir, env = process.env) {
  try {
    const result = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.status !== 0 || !fs.existsSync(path.join(rootDir, "node_modules/.package-lock.json"))) return null;
    const hash = crypto.createHash("sha256");
    hash.update(JSON.stringify([1, rootDir, process.execPath, process.version, process.platform, process.arch]));
    const environment = Object.entries(env)
      .filter(([key]) => !VOLATILE_ENV.test(key))
      .sort(([a], [b]) => a.localeCompare(b));
    hash.update(JSON.stringify(environment));
    const files = new Set(result.stdout.split("\0").filter(Boolean));
    for (const name of fs.readdirSync(rootDir)) if (name === ".npmrc" || name.startsWith(".env")) files.add(name);
    for (const file of [...files].sort()) fileIdentity(path.join(rootDir, file), hash, rootDir);
    const walk = (directory) => {
      for (const name of fs.readdirSync(directory).sort()) {
        if (directory === path.join(rootDir, "node_modules") && [".cache", ".vite", ".vite-temp"].includes(name))
          continue;
        const filename = path.join(directory, name);
        const stat = fileIdentity(filename, hash, rootDir);
        if (stat?.isDirectory()) walk(filename);
      }
    };
    walk(path.join(rootDir, "node_modules"));
    return hash.digest("hex");
  } catch {
    return null;
  }
}

function receiptPath(rootDir, command) {
  // Sort args so identical file sets in different git-status order share a key.
  const key = crypto
    .createHash("sha256")
    .update(JSON.stringify([command.key, command.command, [...command.args].sort()]))
    .digest("hex");
  return path.join(rootDir, "reports/verification-cache", `${key}.json`);
}

export function createVerificationCache(rootDir, commands, options = {}) {
  const env = options.env ?? process.env;
  const capture = options.capture ?? (() => captureVerificationInputs(rootDir, env));
  const enabled = !env.CI && !env.VITEST;
  const minimumDuration = options.minimumDurationMs ?? 5_000;
  const now = options.now ?? Date.now;
  const readReceipt = (command) => {
    try {
      return JSON.parse(fs.readFileSync(receiptPath(rootDir, command), "utf8"));
    } catch {
      return null;
    }
  };
  const candidate = (command) => enabled && REUSABLE_COMMANDS.has(command.key);
  const worthScanning = commands.some(
    (command) =>
      candidate(command) && (minimumDuration === 0 || (readReceipt(command)?.durationMs ?? 0) >= minimumDuration),
  );
  const started = now();
  const before = worthScanning ? capture() : null;
  const scanMs = now() - started;
  const eligible = (command) => Boolean(before && candidate(command));
  return {
    read(command) {
      if (!eligible(command) || env.ALCHEMY_VERIFY_FRESH === "1") return null;
      const receipt = readReceipt(command);
      if (!receipt) return null;
      const age = now() - receipt.completedAt;
      return receipt.version === 1 &&
        receipt.inputs === before &&
        receipt.status === "passed" &&
        receipt.durationMs >= Math.max(minimumDuration, scanMs * 2) &&
        typeof receipt.runId === "string" &&
        Number.isFinite(age) &&
        age >= 0 &&
        age < MAX_AGE_MS
        ? receipt
        : null;
    },
    finish(outcomes, runId) {
      if (!enabled) return true;
      const stable = !before || capture() === before;
      for (const outcome of outcomes) {
        if (!candidate(outcome.command)) continue;
        const filename = receiptPath(rootDir, outcome.command);
        try {
          if (!stable || !outcome.passed) {
            fs.rmSync(filename, { force: true });
            continue;
          }
          if (outcome.reused) continue;
          fs.mkdirSync(path.dirname(filename), { recursive: true });
          const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
          fs.writeFileSync(
            temporary,
            JSON.stringify({
              version: 1,
              inputs: before,
              status: "passed",
              completedAt: now(),
              runId,
              durationMs: outcome.result?.elapsedMs ?? 0,
            }),
          );
          fs.renameSync(temporary, filename);
        } catch {}
      }
      return stable;
    },
  };
}

#!/usr/bin/env node
/** Strong handoff gate: changed-path verification + full static + Vitest + verified build + preview + prepush canary + docs final + exposure check. */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensureRunId } from "./lib/current-run.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function parseHandoffArgs(argv) {
  const paths = [];
  const flags = new Set();
  for (const arg of argv) {
    if (arg === "--") continue;
    if (arg === "--diff") flags.add("diff");
    else if (arg.startsWith("--")) flags.add(arg.slice(2));
    else paths.push(arg);
  }
  if (paths.length > 0 && flags.has("diff")) throw new Error("Choose explicit paths or --diff, not both.");
  return { paths, flags };
}

const GIT_OUTPUT_MAX_BUFFER = 64 * 1024 * 1024;

function gitOutput(args) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: GIT_OUTPUT_MAX_BUFFER,
  });
  return result.status === 0 ? result.stdout : "";
}

function hashFileContent(absolutePath) {
  try {
    const stat = fs.lstatSync(absolutePath);
    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(absolutePath);
      return `symlink:${target}`;
    }
    if (stat.isDirectory()) return `dir:${stat.mode.toString(8)}`;
    if (stat.isFile()) {
      const bytes = fs.readFileSync(absolutePath);
      return `file:${crypto.createHash("sha256").update(bytes).digest("hex")}:${stat.mode.toString(8)}`;
    }
    return `other:${stat.mode.toString(8)}`;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return "missing";
    return `error:${String(error)}`;
  }
}

function collectDirtyPaths() {
  const status = spawnSync("git", ["status", "--porcelain", "--untracked-files=all", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const raw = status.status === 0 ? (status.stdout ?? "") : "";
  if (!raw) return { raw, paths: [] };
  const tokens = raw.split("\0").filter(Boolean);
  const paths = [];
  for (const token of tokens) {
    if (token.length >= 3 && (token[0] !== " " || token[1] !== " ") && token[2] === " ") {
      const filePath = token.slice(3);
      if (filePath) paths.push(filePath);
      continue;
    }
    if (token.length >= 2 && token[1] === " ") {
      continue;
    }
    paths.push(token);
  }
  const unique = [...new Set(paths)].sort();
  return { raw, paths: unique };
}

export function captureSourceDigest() {
  const head = gitOutput(["rev-parse", "HEAD"]).trim() || "no-head";
  const stagedTree = gitOutput(["write-tree"]).trim() || gitOutput(["ls-files", "--stage"]).trim() || "no-index";
  const { raw, paths } = collectDirtyPaths();
  const stagedStatus = spawnSync("git", ["diff", "--cached", "--name-only", "-z"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const stagedRaw = stagedStatus.status === 0 ? (stagedStatus.stdout ?? "") : "";
  const stagedPaths = stagedRaw ? stagedRaw.split("\0").filter(Boolean).sort() : [];
  const fileHashes = [];
  for (const relativePath of paths) {
    const absolutePath = path.join(ROOT, relativePath);
    fileHashes.push(`${relativePath}\0${hashFileContent(absolutePath)}`);
  }
  const stagedHashes = [];
  for (const relativePath of stagedPaths) {
    const content = gitOutput(["show", `:${relativePath}`]);
    const hash = content ? crypto.createHash("sha256").update(content).digest("hex") : "missing-staged";
    stagedHashes.push(`${relativePath}\0staged:${hash}`);
  }
  const payload = `${head}\0${stagedTree}\0${raw}\0${stagedRaw}\0${fileHashes.join("\0")}\0${stagedHashes.join("\0")}`;
  const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
  return { head, hash, raw: payload };
}

function runStep(label, command, args, env) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
}

async function runParallelSteps(steps, env, runner) {
  const { spawn } = await import("node:child_process");
  const promises = steps.map(
    (step) =>
      new Promise((resolve) => {
        if (runner !== runStep) {
          Promise.resolve(runner(step.label, step.command, step.args, env))
            .then((code) => resolve({ label: step.label, code: typeof code === "number" ? code : code ? 0 : 1 }))
            .catch(() => resolve({ label: step.label, code: 1 }));
          return;
        }
        const child = spawn(step.command, step.args, {
          cwd: ROOT,
          env,
          stdio: "inherit",
          shell: process.platform === "win32",
        });
        child.on("close", (code) => resolve({ label: step.label, code: code ?? 1 }));
        child.on("error", () => resolve({ label: step.label, code: 1 }));
      }),
  );
  const results = await Promise.all(promises);
  for (const r of results) if (r.code !== 0) return r;
  return { code: 0 };
}

export async function runHandoff(argv = process.argv.slice(2), options = {}) {
  const runner = options.runner ?? runStep;
  const digestBeforeFn = options.captureDigest ?? captureSourceDigest;
  const { paths, flags } = parseHandoffArgs(argv);
  // Determine verification input: --diff or explicit paths or default to --diff
  const hasDiff = flags.has("diff");
  const hasPaths = paths.length > 0;
  const verifyArgs = hasPaths ? [...paths] : hasDiff ? ["--diff"] : ["--diff"];

  const runId = ensureRunId("handoff");
  const digestBefore = digestBeforeFn();
  console.log(`Handoff run: ${runId} (source ${digestBefore.hash})`);

  const env = { ...process.env, ALCHEMY_RUN_ID: runId };

  const firstStep = {
    label: "changed-path verification",
    command: "node",
    args: ["scripts/verify-changed.mjs", ...verifyArgs, "--strict-routes"],
  };
  const parallelSteps = [
    { label: "static checks (lint:ci)", command: "npm", args: ["run", "lint:ci"] },
    { label: "unit tests (vitest)", command: "npm", args: ["test"] },
  ];
  const remainingSteps = [
    { label: "verified build", command: "npm", args: ["run", "build:verified"] },
    { label: "preview smoke", command: "npm", args: ["run", "smoke:preview"] },
    { label: "prepush canary", command: "npm", args: ["run", "test:e2e:prepush"] },
    { label: "docs final", command: "npm", args: ["run", "docs:check:final"] },
    { label: "exposure check", command: "npm", args: ["run", "context:hotspots", "--", "--run-id", runId, "--check"] },
  ];

  console.log(`\n== ${firstStep.label} ==`);
  {
    const code = runner(firstStep.label, firstStep.command, firstStep.args, env);
    const resolved = code instanceof Promise ? await code : code;
    if (resolved !== 0) {
      console.error(`✗ handoff failed at ${firstStep.label} (exit ${resolved}, run ${runId})`);
      return 1;
    }
  }

  console.log(`\n== parallel: ${parallelSteps.map((s) => s.label).join(" + ")} ==`);
  {
    const result = await runParallelSteps(parallelSteps, env, runner);
    if (result.code !== 0) {
      console.error(`✗ handoff failed at ${result.label} (exit ${result.code}, run ${runId})`);
      return 1;
    }
  }

  for (const step of remainingSteps) {
    console.log(`\n== ${step.label} ==`);
    const code = runner(step.label, step.command, step.args, env);
    const resolved = code instanceof Promise ? await code : code;
    if (resolved !== 0) {
      console.error(`✗ handoff failed at ${step.label} (exit ${resolved}, run ${runId})`);
      return 1;
    }
  }

  const digestAfter = digestBeforeFn();
  if (digestAfter.hash !== digestBefore.hash) {
    console.error(
      `✗ handoff stale: source inputs changed during verification (before ${digestBefore.hash}, after ${digestAfter.hash}). Re-run npm run check:handoff -- --diff`,
    );
    return 1;
  }

  console.log(`\n✓ handoff passed (run ${runId}, source ${digestBefore.hash})`);
  return 0;
}

if (isMainModule(import.meta.url)) {
  runHandoff()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}

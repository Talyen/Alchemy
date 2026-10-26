#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep this entry point self-contained: the original workspace can lag main.
const currentFile = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(currentFile), "..");

function resolveDevCheckout(checkout) {
  const git = (...args) => execFileSync("git", args, { cwd: checkout, encoding: "utf8", stdio: "pipe" }).trim();
  const common = git("rev-parse", "--path-format=absolute", "--git-common-dir");
  const primary = path.dirname(common);
  // Task previews must continue to serve their own unintegrated changes.
  if (fs.realpathSync(checkout) !== fs.realpathSync(primary)) return checkout;
  const records = git("worktree", "list", "--porcelain", "-z").split("\0\0");
  const main = records.find((record) => record.split("\0").includes("branch refs/heads/main"));
  if (!main) throw new Error("No checkout owns main. Restore the main checkout, or use npm run dev:local explicitly.");
  return main
    .split("\0")
    .find((field) => field.startsWith("worktree "))
    .slice("worktree ".length);
}

function run(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: "inherit" });
  const interrupt = () => child.kill("SIGINT");
  const terminate = () => child.kill("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", terminate);
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}

function main() {
  const [phase, ...args] = process.argv.slice(2);
  if (phase !== "prepare" && phase !== "serve") throw new Error("Expected prepare or serve.");
  const target = resolveDevCheckout(root);
  if (fs.realpathSync(target) !== fs.realpathSync(root)) {
    const launcher = path.join(target, "scripts/dev.mjs");
    if (!fs.existsSync(launcher))
      throw new Error("The main checkout is missing scripts/dev.mjs; refusing a stale preview.");
    run(process.execPath, [launcher, phase, ...args], target);
    return;
  }
  if (phase === "prepare") {
    if (!process.env.npm_execpath) throw new Error("Run this launcher through npm run dev.");
    run(process.execPath, [process.env.npm_execpath, "run", "predev:local"], target);
  } else {
    const revision = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: target, encoding: "utf8" }).trim();
    console.log(`Serving ${target} (${revision})`);
    run(process.execPath, [path.join(target, "node_modules/vite/bin/vite.js"), ...args], target);
  }
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(currentFile)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

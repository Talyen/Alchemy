#!/usr/bin/env node
import fs from "node:fs";
import { devNull } from "node:os";
import path from "node:path";
import { runGit, toRepoRelative } from "./lib/repository-paths.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const GENERATED =
  /(?:^Raw Assets\/|^src\/assets\/optimized\/|^public\/(?:sounds|Music)\/|\.generated\.|(?:^|\/)\.asset-hashes\.json$|^src\/lib\/game-data\/gear-art\.ts$|(?:^|\/)package-lock\.json$)/u;

function git(root, args, accepted = [0]) {
  const result = runGit(root, ["--no-pager", ...args]);
  if (result.error || !accepted.includes(result.status))
    throw new Error(result.error?.message ?? result.stderr.trim() ?? "Git diff failed");
  return result.stdout;
}

function inventory(root) {
  const fields = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]).split("\0");
  const entries = [];
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index];
    if (!field) continue;
    const status = field.slice(0, 2);
    const file = field.slice(3);
    const from = /[RC]/u.test(status) ? fields[++index] : undefined;
    entries.push({ status, file, from });
  }
  return entries;
}

/** Complete status is retained even when path selection or output limits hide patches. */
export function reviewDiff(root = ROOT, { paths = [], full = false, budget = 12_000 } = {}) {
  const selected = paths.map((file) => toRepoRelative(root, file));
  const entries = inventory(root);
  const patches = [];
  for (const entry of entries) {
    const names = [entry.file, entry.from].filter(Boolean);
    if (
      selected.length &&
      !names.some((file) => selected.some((p) => p === "." || file === p || file.startsWith(`${p}/`)))
    )
      continue;
    const label = `${entry.status} ${JSON.stringify(entry.file)}${entry.from ? ` <- ${JSON.stringify(entry.from)}` : ""}`;
    if (!full && names.some((file) => GENERATED.test(file))) {
      patches.push(`${label}: generated/media patch omitted; use --full with this path.`);
      continue;
    }
    const options = ["--no-ext-diff", "--no-textconv", "--no-color"];
    let patch;
    if (entry.status === "??") {
      // Git handles binaries and symlinks without following a link into unrelated data.
      patch = git(root, ["diff", "--no-index", ...options, "--", devNull, entry.file], [0, 1]);
    } else {
      // Keep both layers: a staged change can be reversed in the working tree.
      patch = [
        git(root, ["diff", "--cached", ...options, "--", ...names]),
        git(root, ["diff", ...options, "--", ...names]),
      ]
        .filter(Boolean)
        .join("\n");
    }
    patches.push(`${label}\n${patch || "No textual patch (inspect status/submodule state)."}`);
  }
  const directory = path.join(root, "reports", "agent-diff");
  fs.mkdirSync(directory, { recursive: true });
  const report = path.join(fs.mkdtempSync(path.join(directory, "review-")), "diff.txt");
  const status = entries.map(
    ({ status, file, from }) => `${status} ${JSON.stringify(file)}${from ? ` <- ${JSON.stringify(from)}` : ""}`,
  );
  const blocks = ["Complete working-tree inventory:", ...status, "", "Selected patches:", ...patches];
  fs.writeFileSync(report, blocks.join("\n") + "\n");
  const footer = `\nComplete inventory and selected patches: ${report}\nExpand: npm run review:diff -- --full <path> (or read the report).`;
  const lines = [`${entries.length} changed paths; ${patches.length} selected patches/summaries.`];
  let omitted = 0;
  for (const block of blocks) {
    if (Buffer.byteLength([...lines, block, footer].join("\n")) <= budget - 160) lines.push(block);
    else omitted++;
  }
  if (omitted)
    lines.push(`${omitted} blocks omitted from terminal output; read the report before treating review as complete.`);
  return { text: lines.join("\n") + footer, report };
}

export function main(argv = process.argv.slice(2), root = ROOT) {
  try {
    if (argv.includes("--help")) {
      console.log(
        "Usage: npm run review:diff -- [--full] [paths...]\nComplete status plus bounded authored patches; full selected patches are retained in reports/agent-diff.",
      );
      return 0;
    }
    if (argv.some((arg) => arg.startsWith("--") && arg !== "--full")) throw new Error("Unknown diff option");
    console.log(
      reviewDiff(root, { full: argv.includes("--full"), paths: argv.filter((arg) => arg !== "--full") }).text,
    );
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}
if (isMainModule(import.meta.url)) process.exitCode = main();

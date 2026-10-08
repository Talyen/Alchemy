#!/usr/bin/env node
import fs from "node:fs";
import { devNull } from "node:os";
import path from "node:path";
import { runGit, toRepoRelative } from "./lib/repository-paths.mjs";
import { defineScript } from "./lib/script-run.mjs";
import { INLINE_ARGS_BYTES } from "./lib/verification/selection-budgets.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const GENERATED =
  /(?:^Raw Assets\/|^src\/assets\/optimized\/|^public\/(?:sounds|Music)\/|\.generated\.|(?:^|\/)\.asset-hashes\.json$|^src\/lib\/game-data\/gear-art\.ts$|(?:^|\/)package-lock\.json$)/u;

function git(root, args, accepted = [0]) {
  // Status may refresh index metadata; a review must not take optional write locks.
  const result = runGit(root, ["--no-optional-locks", "--literal-pathspecs", "--no-pager", ...args]);
  if (result.error || !accepted.includes(result.status))
    throw new Error(result.error?.message || result.stderr.trim() || "Git diff failed");
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

/** Match small ordinary files without staging or scanning large unrelated untracked artifacts. */
function exactUnstagedMoves(root, entries) {
  const deleted = entries.filter((entry) => entry.status === " D" && !GENERATED.test(entry.file));
  const added = entries.filter((entry) => {
    if (entry.status !== "??" || GENERATED.test(entry.file)) return false;
    const stats = fs.lstatSync(path.join(root, entry.file), { throwIfNoEntry: false });
    return stats?.isFile() && stats.size <= 256_000;
  });
  const moves = new Map();
  if (!deleted.length || !added.length) return moves;
  if (Buffer.byteLength(JSON.stringify([...deleted, ...added].map((entry) => entry.file))) > INLINE_ARGS_BYTES)
    return moves;
  const sources = new Map();
  for (const record of git(root, ["ls-files", "--stage", "-z", "--", ...deleted.map((entry) => entry.file)]).split(
    "\0",
  )) {
    const match = /^(100644|100755) ([a-f0-9]+) 0\t([\s\S]+)$/u.exec(record);
    if (!match) continue;
    const key = `${match[1]}:${match[2]}`;
    const names = sources.get(key) ?? [];
    names.push(match[3]);
    sources.set(key, names);
  }
  // No -w: hashing reads files without adding objects or changing the index.
  const hashes = git(root, ["hash-object", "--no-filters", "--", ...added.map((entry) => entry.file)])
    .trim()
    .split(/\r?\n/u);
  if (hashes.length !== added.length) throw new Error("Could not identify untracked move contents");
  for (const [index, entry] of added.entries()) {
    const mode = fs.lstatSync(path.join(root, entry.file)).mode & 0o100 ? "100755" : "100644";
    const from = sources.get(`${mode}:${hashes[index]}`)?.shift();
    if (from) moves.set(entry.file, from);
  }
  return moves;
}

/** Complete status is retained even when path selection or output limits hide patches. */
export function reviewDiff(root = ROOT, { paths = [], full = false, statusOnly = false, budget = null } = {}) {
  budget ??= statusOnly ? 4_000 : 12_000;
  const selected = paths.map((file) => toRepoRelative(root, file));
  const entries = inventory(root);
  const moves = full || statusOnly ? new Map() : exactUnstagedMoves(root, entries);
  const destinations = new Map([...moves].map(([file, from]) => [from, file]));
  const isSelected = ({ file, from }) =>
    !selected.length ||
    [file, from, moves.get(file), destinations.get(file)]
      .filter(Boolean)
      .some((name) => selected.some((p) => p === "." || name === p || name.startsWith(`${p}/`)));
  const patches = [];
  for (const original of entries) {
    if (destinations.has(original.file)) continue;
    const entry = { ...original, from: original.from ?? moves.get(original.file) };
    const names = [entry.file, entry.from].filter(Boolean);
    if (!isSelected(entry)) continue;
    const label = `${entry.status} ${JSON.stringify(entry.file)}${entry.from ? ` <- ${JSON.stringify(entry.from)}` : ""}`;
    if (statusOnly) {
      if (selected.length) patches.push(label);
      continue;
    }
    if (moves.has(entry.file)) {
      patches.push(
        `${label}\nExact unstaged move; contents and executable mode unchanged. Use --full to inspect contents.`,
      );
      continue;
    }
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
  const selectedHeading = statusOnly ? "Selected status:" : "Selected patches:";
  const blocks = ["Complete working-tree inventory:", ...status, "", selectedHeading, ...patches];
  fs.writeFileSync(report, blocks.join("\n") + "\n");
  const directories = new Map();
  for (const entry of entries) {
    const directory = entry.file.includes("/") ? `${entry.file.split("/")[0]}/` : "(root)";
    const counts = directories.get(directory) ?? { selected: 0, other: 0 };
    counts[isSelected(entry) ? "selected" : "other"]++;
    directories.set(directory, counts);
  }
  const summary = [...directories]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([directory, counts]) => `${directory}: ${counts.selected} selected, ${counts.other} other changed paths`);
  const footer = `\nComplete inventory and ${statusOnly ? "selected status" : "selected patches"}: ${report}\n${statusOnly ? "Review: npm run review:diff -- <task-owned paths>" : "Expand: npm run review:diff -- --full <path> (or read the report)."}`;
  const lines = [
    statusOnly && !selected.length
      ? `${entries.length} changed paths; grouped below. Name task-owned paths to show individual status.`
      : `${entries.length} changed paths; ${patches.length} selected ${statusOnly ? "status entries" : "patches/summaries"}.`,
  ];
  let omitted = 0;
  for (const block of [selectedHeading, ...patches, "", "Working-tree summary:", ...summary]) {
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
        "Usage: npm run review:diff -- [--full] [--status] [paths...]\nStatus bounds task paths and retains complete inventory. Reports live in reports/agent-diff.",
      );
      return 0;
    }
    const options = { paths: [], full: false, statusOnly: false };
    let positional = false;
    for (let index = 0; index < argv.length; index++) {
      const arg = argv[index];
      if (!positional && arg === "--") positional = true;
      else if (!positional && arg === "--full") options.full = true;
      else if (!positional && arg === "--status") options.statusOnly = true;
      else if (!positional && arg.startsWith("--")) throw new Error("Unknown diff option");
      else options.paths.push(arg);
    }
    console.log(reviewDiff(root, options).text);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}
defineScript(import.meta.url, () => main(), { artifacts: true });

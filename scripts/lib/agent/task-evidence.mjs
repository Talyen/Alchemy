import fs from "node:fs";
import path from "node:path";
import { captureSourceDigest } from "../../check.mjs";
import { resolveSelectedPaths } from "../verification/changed-paths.mjs";
import { runGit } from "../repository-paths.mjs";

export function taskCheckIsCurrent(receipt, { main, digest, selected }) {
  return (
    receipt.selection === "task" &&
    ["passed", "failed"].includes(receipt.status) &&
    receipt.mainHead === main &&
    receipt.sourceHead === digest.head &&
    receipt.sourceDigest === digest.hash &&
    Array.isArray(receipt.selectedPaths) &&
    JSON.stringify([...receipt.selectedPaths].sort()) === JSON.stringify([...selected].sort())
  );
}

// A receipt is evidence only for its original selection and source identity.
export function latestTaskCheck(checkout) {
  const runs = path.join(checkout, "reports/runs");
  if (!fs.existsSync(runs)) return null;
  const files = fs.readdirSync(runs, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const file = path.join(runs, entry.name, "check/coverage.json");
    const stat = fs.statSync(file, { throwIfNoEntry: false });
    return stat?.isFile() ? [{ file, time: stat.mtimeMs }] : [];
  });
  files.sort((a, b) => b.time - a.time || b.file.localeCompare(a.file));
  if (!files.length) return null;
  const file = files[0].file;
  try {
    const receipt = JSON.parse(fs.readFileSync(file, "utf8"));
    const currentMain = runGit(checkout, ["rev-parse", "main"]);
    const selected = resolveSelectedPaths(checkout, { flags: new Set(["task"]), paths: [] });
    const digest = captureSourceDigest({ rootDir: checkout, paths: selected });
    const current =
      currentMain.status === 0 && taskCheckIsCurrent(receipt, { main: currentMain.stdout.trim(), digest, selected });
    return { file, receipt, current };
  } catch (error) {
    return { file, error: error.message, current: false };
  }
}

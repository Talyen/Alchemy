import fs from "node:fs";
import path from "node:path";
import { parseCLI } from "vitest/node";

const FOCUSED_OPTIONS = new Set([
  "--",
  "color",
  "run",
  "t",
  "testNamePattern",
  "reporter",
  "bail",
  "retry",
  "testTimeout",
  "hookTimeout",
  "maxWorkers",
  "silent",
  "passWithNoTests",
  "fileParallelism",
]);

/** Use Vitest's parser so option values never become accidental file selectors. */
export function unitSelection(args, rootDir) {
  const { filter: selectors, options } = parseCLI(["vitest", ...args]);
  for (const arg of selectors) {
    if (rootDir && /[\\/]/u.test(arg)) {
      const stat = fs.statSync(path.resolve(rootDir, options.root ?? ".", arg), { throwIfNoEntry: false });
      if (!stat?.isFile() && !stat?.isDirectory()) throw new Error(`Unit test path does not exist: ${arg}`);
    }
  }
  return {
    selectors,
    focused:
      args[0] === "run" &&
      Object.keys(options).every((key) => FOCUSED_OPTIONS.has(key)) &&
      selectors.length >= 1 &&
      selectors.length <= 2 &&
      selectors.every((arg) => /[\\/]/u.test(arg) && /\.test\.tsx?$/u.test(arg)),
  };
}

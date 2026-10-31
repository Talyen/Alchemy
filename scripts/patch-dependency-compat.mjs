#!/usr/bin/env node
// Temporary compatibility fixes for dependencies that still consume pre-v11
// minimatch APIs. Keep these version and source guards until upstream updates.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const targets = {
  glob: {
    "7.2.3": [
      ["glob.js", "var rawGlob = pn._glob", "var rawGlob = pn.pattern"],
      ["glob.js", "m = !e.match(pn)", "m = !pn.test(e)"],
      ["glob.js", "m = e.match(pn)", "m = pn.test(e)"],
      ["sync.js", "var rawGlob = pn._glob", "var rawGlob = pn.pattern"],
      ["sync.js", "m = !e.match(pn)", "m = !pn.test(e)"],
      ["sync.js", "m = e.match(pn)", "m = pn.test(e)"],
    ],
    "14.0.3": [],
  },
  "@electron/asar": {
    "3.4.1": [
      ["lib/asar.js", '__importDefault(require("minimatch"))', '__importDefault(require("minimatch").minimatch)'],
    ],
    "4.3.1": [],
  },
  "dir-compare": {
    "4.2.0": [
      [
        "build/src/FilterHandler/defaultFilterHandler.js",
        '__importDefault(require("minimatch"))',
        '__importDefault(require("minimatch").minimatch)',
      ],
    ],
  },
  dotgitignore: {
    "2.1.0": [
      [
        "lib/dotignore.js",
        "return minimatch.makeRe(line)",
        "var matcher = new minimatch.Minimatch(line)\n    return matcher.comment || matcher.empty ? null : matcher",
      ],
      ["lib/dotignore.js", "matcher.test(filename)", "matcher.match(filename)"],
      ["lib/dotignore.js", "matcher.test(part)", "matcher.match(part)"],
    ],
  },
};

for (const [location, entry] of Object.entries(lock.packages)) {
  const name = Object.keys(targets).find((candidate) => location.endsWith(`node_modules/${candidate}`));
  if (!name) continue;
  const directory = path.join(root, location);
  if (!fs.existsSync(directory)) continue; // Optional or omitted dependencies.
  const version = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8")).version;
  const patches = targets[name][version];
  if (version !== entry.version || !patches) throw new Error(`Unsupported ${name} at ${location}: ${version}`);
  const requireFromPackage = createRequire(path.join(directory, "package.json"));
  const minimatchVersion = JSON.parse(
    fs.readFileSync(requireFromPackage.resolve("minimatch/package.json"), "utf8"),
  ).version;
  if (minimatchVersion !== "11.0.3") throw new Error(`Unsupported minimatch ${minimatchVersion} at ${location}`);
  for (const [file, before, after] of patches) {
    const filename = path.join(directory, file);
    const content = fs.readFileSync(filename, "utf8");
    if (content.includes(after) && !content.includes(before)) continue;
    if (content.split(before).length !== 2 || content.includes(after)) {
      throw new Error(`Cannot safely patch ${location}/${file}: expected source changed`);
    }
    fs.writeFileSync(filename, content.replace(before, after));
  }
}

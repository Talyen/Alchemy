import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const LOCAL_CLIS = {
  vitest: "vitest/vitest.mjs",
  playwright: "@playwright/test/cli.js",
  eslint: "eslint/bin/eslint.js",
  depcruise: "dependency-cruiser/bin/dependency-cruise.mjs",
  "commit-and-tag-version": "commit-and-tag-version/bin/cli.js",
};

function npmCli() {
  if (process.env.npm_execpath?.endsWith("npm-cli.js")) return process.env.npm_execpath;
  // Direct `node scripts/...` calls have no npm lifecycle environment. Resolve
  // the installed npm launcher, including Windows' adjacent node_modules layout.
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    for (const name of ["npm", "npm.cmd"]) {
      const launcher = path.join(directory, name);
      if (!fs.existsSync(launcher)) continue;
      const resolved = fs.realpathSync(launcher);
      if (resolved.endsWith("npm-cli.js")) return resolved;
      const adjacent = path.join(path.dirname(resolved), "node_modules/npm/bin/npm-cli.js");
      if (fs.existsSync(adjacent)) return adjacent;
    }
  }
  throw new Error("Cannot locate npm-cli.js. Install npm or run this command through npm run.");
}

/** Resolve our Node tools without a shell interpreting spaces, quotes or pipes. */
export function commandInvocation(command, args = []) {
  if (command === "node") return [process.execPath, args];
  if (command === "npm" || command === "npm.cmd") return [process.execPath, [npmCli(), ...args]];
  if (command === "npx" || command === "npx.cmd") {
    const [tool, ...forwarded] = args;
    const relative = Object.hasOwn(LOCAL_CLIS, tool) ? LOCAL_CLIS[tool] : null;
    if (!relative) throw new Error(`Unsupported local CLI: ${tool}`);
    const cli = path.join(ROOT, "node_modules", relative);
    if (!fs.existsSync(cli)) throw new Error(`Missing local CLI: ${cli} (run npm ci)`);
    return [process.execPath, [cli, ...forwarded]];
  }
  return [command, args];
}

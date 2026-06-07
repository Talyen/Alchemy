import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default async function globalSetup(): Promise<void> {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  const env = { ...process.env };
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;

  execFileSync("node", ["scripts/ensure-electron.mjs"], {
    cwd: projectRoot,
    stdio: "inherit",
    env,
  });
}

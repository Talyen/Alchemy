#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function electronEnv() {
  const env = { ...process.env };
  delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;
  return env;
}

function verifyElectronBinary() {
  require("electron");
}

try {
  verifyElectronBinary();
} catch {
  execFileSync("node", ["node_modules/electron/install.js"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: electronEnv(),
  });
  verifyElectronBinary();
}

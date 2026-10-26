import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { runStreamCommand } from "./lib/run-command.mjs";
import { REPO_ROOT } from "./lib/repository-paths.mjs";
import { parseKnownFlags } from "./lib/cli-args.mjs";
import { defineScript, UsageError } from "./lib/script-run.mjs";

const revision = "fa6c6af2a40dc3923f88d41c2912aa041dfffc6f";
const sourceSha256 = "1bc93d10e7e510735826c5dc36271f8e1b030343bb561bf5e081a9569e99d5da";
const patches = ["overlay.patch", "availability.patch"];
const targets = {
  "win32-x64": {
    folder: "win64",
    binary: "steamworksjs.win32-x64-msvc.node",
    library: "steamworksjs.dll",
    redistributables: ["steam_api64.dll", "steam_api64.lib"],
  },
  "linux-x64": {
    folder: "linux64",
    binary: "steamworksjs.linux-x64-gnu.node",
    library: "libsteamworksjs.so",
    redistributables: ["libsteam_api.so"],
  },
  "darwin-arm64": {
    folder: "osx",
    binary: "steamworksjs.darwin-arm64.node",
    library: "libsteamworksjs.dylib",
    redistributables: ["libsteam_api.dylib"],
  },
  "darwin-x64": {
    folder: "osx",
    binary: "steamworksjs.darwin-x64.node",
    library: "libsteamworksjs.dylib",
    redistributables: ["libsteam_api.dylib"],
  },
};
function run(command, args, cwd, env = process.env) {
  const result = runStreamCommand(command, args, { cwd, env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

export async function ensureSteamworks() {
  const target = targets[`${process.platform}-${process.arch}`];
  if (!target) throw new Error("Steamworks native build requires Windows/Linux x64 or macOS x64/arm64.");
  const dependency = path.dirname(createRequire(import.meta.url).resolve("steamworks.js/package.json"));
  if (JSON.parse(await readFile(path.join(dependency, "package.json"), "utf8")).version !== "0.4.0") {
    throw new Error("Review the Steamworks native patches before changing the dependency version.");
  }
  const patchFiles = patches.map((name) => path.join(REPO_ROOT, "scripts/steamworks", name));
  const key = sha256(
    Buffer.concat([
      Buffer.from(revision),
      await readFile(new URL(import.meta.url)),
      ...(await Promise.all(patchFiles.map((file) => readFile(file)))),
    ]),
  );
  const binary = path.join(dependency, "dist", target.folder, target.binary);
  const receipt = `${binary}.alchemy.json`;
  try {
    const recorded = JSON.parse(await readFile(receipt, "utf8"));
    if (recorded.key === key && recorded.binarySha256 === sha256(await readFile(binary))) return;
  } catch {
    /* A stock or changed binary must be rebuilt. */
  }
  // Never replace a dependency shared with another checkout's native session.
  const localModules = path.join(REPO_ROOT, "node_modules");
  const { realpath } = await import("node:fs/promises");
  if ((await realpath(localModules)) !== localModules) {
    throw new Error(
      "Native patching needs task-local node_modules. Replace only this checkout's dependency symlink and run npm ci first.",
    );
  }
  const work = path.join(tmpdir(), "alchemy-steamworks-native", sha256(REPO_ROOT).slice(0, 16));
  const source = path.join(work, "source");
  await mkdir(work, { recursive: true });
  const response = await fetch(`https://api.github.com/repos/ceifa/steamworks.js/tarball/${revision}`);
  if (!response.ok) throw new Error(`Steamworks source download failed (${response.status})`);
  const archive = Buffer.from(await response.arrayBuffer());
  if (sha256(archive) !== sourceSha256)
    throw new Error("Steamworks source archive checksum differs from the reviewed revision.");
  const archivePath = path.join(work, "source.tar.gz");
  await writeFile(archivePath, archive);
  await rm(source, { recursive: true, force: true });
  await mkdir(source);
  run("tar", ["-xzf", archivePath, "--strip-components=1", "-C", source], work);
  for (const patch of patchFiles) run("git", ["apply", "--no-index", "--unsafe-paths", patch], source);
  const callbackSource = await readFile(path.join(source, "src/api/callback.rs"), "utf8");
  const nativeSource = await readFile(path.join(source, "src/lib.rs"), "utf8");
  if (
    !callbackSource.includes("SteamCallback::GameOverlayActivated") ||
    !nativeSource.includes("pub fn is_overlay_enabled")
  ) {
    throw new Error("Steamworks native patches did not apply; refusing to compile a stock binding.");
  }
  run("cargo", ["build", "--locked", "--release"], source, {
    ...process.env,
    RUSTUP_TOOLCHAIN: "1.90.0",
    CARGO_TARGET_DIR: path.join(work, "target"),
    STEAM_SDK_LOCATION: path.join(source, "sdk"),
  });
  const output = path.dirname(binary);
  await mkdir(output, { recursive: true });
  await copyFile(path.join(work, "target/release", target.library), binary);
  for (const file of target.redistributables) {
    await copyFile(path.join(source, "sdk/redistributable_bin", target.folder, file), path.join(output, file));
  }
  for (const file of ["index.js", "index.d.ts", "client.d.ts", "callbacks.d.ts"]) {
    await copyFile(path.join(source, file), path.join(dependency, file));
  }
  // Loading exports requires no Steam client, login, or access to a player profile.
  run(
    process.execPath,
    [
      "-e",
      `const s=require(${JSON.stringify(dependency)});if(s.SteamCallback.GameOverlayActivated===undefined||typeof s.isOverlayEnabled!=='function')process.exit(1)`,
    ],
    REPO_ROOT,
  );
  await writeFile(receipt, JSON.stringify({ key, revision, binarySha256: sha256(await readFile(binary)) }));
  console.log(`Steamworks overlay native capabilities built for ${process.platform}-${process.arch}.`);
}

defineScript(import.meta.url, async () => {
  const { flags, values, rest } = parseKnownFlags(process.argv.slice(2), {
    target: { takesValue: true },
    help: { short: "h" },
  });
  if (rest.length) throw new UsageError(`Unexpected native build arguments: ${rest.join(", ")}`);
  if (flags.has("help")) {
    console.log(
      "Usage: node scripts/ensure-steamworks.mjs [--target <platform-arch>]\nBuild and qualify the pinned native Steamworks overlay patches for this host. Requires Rust/Cargo and a native linker.",
    );
    return;
  }
  const target = values.get("target")?.at(-1);
  if (target && target !== `${process.platform}-${process.arch}`) {
    throw new Error(
      `Native Steamworks target ${target} must be built on a matching host; current host is ${process.platform}-${process.arch}.`,
    );
  }
  await ensureSteamworks();
});

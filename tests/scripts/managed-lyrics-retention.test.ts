import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { expect, it } from "vitest";
import { pruneTransientArtifacts } from "../../scripts/prune-transient-artifacts.mjs";
import { holdManagedToolLock } from "../../scripts/lib/managed-tool-lock.mjs";

it("retains an active tool even after its launcher dies, then expires only the managed environment", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-managed-lyrics-"));
  const helper = path.join(process.cwd(), "scripts/lyrics-trial/managed-env.py");
  const tools = path.join(root, "scripts/lyrics-trial");
  const env = path.join(root, ".cache/alchemy-lyrics-venv");
  fs.mkdirSync(path.join(env, "bin"), { recursive: true });
  fs.mkdirSync(tools, { recursive: true });
  fs.writeFileSync(path.join(tools, "requirements.txt"), "fixture");
  fs.writeFileSync(path.join(tools, "assess.py"), "fixture");
  fs.writeFileSync(path.join(env, "bin/python"), "#!/bin/sh\necho ready\nsleep 2\n", { mode: 0o755 });
  fs.writeFileSync(
    path.join(env, ".alchemy-managed.json"),
    JSON.stringify({
      kind: "alchemy-managed-lyrics-v1",
      requirements: createHash("sha256").update("fixture").digest("hex"),
      last_used: Date.now() / 1000 - 31 * 86400,
    }),
  );
  const legacy = path.join(root, ".cache/lyrics/venv");
  fs.mkdirSync(legacy, { recursive: true });
  fs.writeFileSync(path.join(legacy, "keep"), "legacy environment");
  const child = spawn("python3", [helper, "--root", root, "assess.py"], { stdio: ["ignore", "pipe", "pipe"] });
  try {
    const [output] = await once(child.stdout, "data");
    expect(String(output)).toContain("ready");
    await expect(holdManagedToolLock(helper, root)).rejects.toThrow();
    expect((await pruneTransientArtifacts({ rootDir: root })).removed).toEqual([]);
    const exited = once(child, "exit");
    child.kill("SIGKILL");
    await exited;
    expect((await pruneTransientArtifacts({ rootDir: root })).removed).toEqual([]);
    await new Promise((resolve) => {
      setTimeout(resolve, 2300);
    });
    expect((await pruneTransientArtifacts({ rootDir: root })).removed.map((item) => item.path)).toContain(
      ".cache/alchemy-lyrics-venv",
    );
    expect(fs.readFileSync(path.join(legacy, "keep"), "utf8")).toBe("legacy environment");
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it("preserves an unrecognized environment and ignores a linked cache", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-unmanaged-lyrics-"));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-external-lyrics-"));
  try {
    const cache = path.join(root, ".cache");
    const env = path.join(cache, "alchemy-lyrics-venv");
    fs.mkdirSync(env, { recursive: true });
    fs.writeFileSync(path.join(env, ".alchemy-managed.json"), "unknown");
    fs.writeFileSync(path.join(cache, "alchemy-lyrics.lock"), "");
    expect((await pruneTransientArtifacts({ rootDir: root })).removed).toEqual([]);
    expect(fs.existsSync(env)).toBe(true);
    fs.rmSync(cache, { recursive: true });
    fs.symlinkSync(external, cache, "dir");
    fs.writeFileSync(path.join(external, "keep"), "external");
    expect((await pruneTransientArtifacts({ rootDir: root })).removed).toEqual([]);
    expect(fs.readFileSync(path.join(external, "keep"), "utf8")).toBe("external");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(external, { recursive: true, force: true });
  }
});

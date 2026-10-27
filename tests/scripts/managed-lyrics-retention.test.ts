import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
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

it.skipIf(process.platform === "win32")(
  "keeps a font environment locked after both launcher and tool supervisor exit",
  async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-managed-fonts-"));
    const helper = path.join(process.cwd(), "scripts/lyrics-trial/managed-env.py");
    const env = path.join(root, ".cache/alchemy-fonts-venv");
    fs.mkdirSync(path.join(env, "bin"), { recursive: true });
    fs.writeFileSync(path.join(env, "bin/python"), "#!/bin/sh\necho ready\nsleep 2\n", { mode: 0o755 });
    fs.writeFileSync(
      path.join(env, ".alchemy-managed.json"),
      JSON.stringify({
        kind: "alchemy-managed-fonts-v1",
        version: "4.60.1",
        last_used: Date.now() / 1000 - 31 * 86400,
      }),
    );
    const code = `const { spawn } = require('node:child_process');
    const child = spawn(process.env.ALCHEMY_FONT_PYTHON, [], {
      stdio: ['ignore', 'pipe', 'inherit', Number(process.env.ALCHEMY_FONT_LOCK_FD)]
    });
    child.stdout.on('data', data => process.stdout.write(process.pid + ' ' + data));`;
    const manager = spawn(
      "python3",
      [helper, "--root", root, "--environment", "fonts", "--font-version", "4.60.1", process.execPath, "-e", code],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    try {
      const [output] = await once(manager.stdout, "data");
      const match = /^(\d+) ready/u.exec(String(output));
      expect(match).not.toBeNull();
      const supervisor = Number(match![1]);
      await expect(holdManagedToolLock(helper, root)).rejects.toThrow();
      const exited = once(manager, "exit");
      manager.kill("SIGKILL");
      process.kill(supervisor, "SIGKILL");
      await exited;
      expect((await pruneTransientArtifacts({ rootDir: root })).removed).toEqual([]);
      await new Promise((resolve) => {
        setTimeout(resolve, 2300);
      });
      expect((await pruneTransientArtifacts({ rootDir: root })).removed.map((item) => item.path)).toContain(
        ".cache/alchemy-fonts-venv",
      );
    } finally {
      if (manager.exitCode === null && manager.signalCode === null) manager.kill("SIGKILL");
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);

it.skipIf(process.platform === "win32")(
  "honors an explicitly supplied font Python without creating a managed environment",
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-font-override-"));
    try {
      const python = path.join(root, "python");
      fs.writeFileSync(python, '#!/bin/sh\ntouch "$ALCHEMY_TEST_FONT_MARKER"\necho wrong-version\n', { mode: 0o755 });
      const result = spawnSync(process.execPath, [path.join(process.cwd(), "scripts/localization/subset-fonts.mjs")], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          ALCHEMY_FONT_PYTHON: python,
          ALCHEMY_FONT_LOCK_FD: "",
          ALCHEMY_TEST_FONT_MARKER: path.join(root, "called"),
        },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Font regeneration requires fonttools==4.60.1");
      expect(fs.existsSync(path.join(root, "called"))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);

it.skipIf(process.platform === "win32")(
  "automatically dispatches the normal font command through the managed environment",
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-font-dispatch-"));
    try {
      for (const relative of [
        "scripts/localization/subset-fonts.mjs",
        "scripts/localization/font.mjs",
        "scripts/lyrics-trial/managed-env.py",
        "src/lib/localization/catalog-format.mjs",
        "src/lib/localization/locales/languages.json",
        "src/lib/localization/locales/runtime.json",
      ]) {
        const target = path.join(root, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(process.cwd(), relative), target);
      }
      const envDir = path.join(root, ".cache/alchemy-fonts-venv");
      fs.mkdirSync(path.join(envDir, "bin"), { recursive: true });
      fs.writeFileSync(
        path.join(envDir, "bin/python"),
        '#!/bin/sh\n[ -e /dev/fd/3 ] || exit 42\ntouch "$ALCHEMY_TEST_FONT_MARKER"\necho wrong-version\n',
        { mode: 0o755 },
      );
      const marker = path.join(envDir, ".alchemy-managed.json");
      fs.writeFileSync(marker, JSON.stringify({ kind: "alchemy-managed-fonts-v1", version: "4.60.1", last_used: 1 }));
      const childEnv = { ...process.env, ALCHEMY_TEST_FONT_MARKER: path.join(root, "called") };
      delete childEnv.ALCHEMY_FONT_PYTHON;
      delete childEnv.ALCHEMY_FONT_LOCK_FD;
      const result = spawnSync(process.execPath, [path.join(root, "scripts/localization/subset-fonts.mjs")], {
        cwd: root,
        encoding: "utf8",
        env: childEnv,
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Font regeneration requires fonttools==4.60.1");
      expect(fs.existsSync(path.join(root, "called"))).toBe(true);
      expect(JSON.parse(fs.readFileSync(marker, "utf8")).last_used).toBeGreaterThan(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  },
);

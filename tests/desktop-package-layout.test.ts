import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

interface PackContext {
  appOutDir: string;
  electronPlatformName?: string;
  packager: {
    appInfo: { productFilename: string };
    executableName?: string;
    platform: { nodeName: string };
  };
}

interface PackageLayout {
  executablePath: (
    appDirectory: string,
    target: string,
    names?: { productFilename?: string; linuxExecutableName?: string },
  ) => string;
  executablePathForPackContext: (context: PackContext) => string;
  resolveUnpackedDirectory: (outputRoot: string, options?: { target?: string }) => string;
}

interface AfterPackModule {
  installBrowserProcessSnapshots: (appOutDir: string) => Promise<void>;
  resolvePackagedExecutable: (context: PackContext) => string;
}

const layout = require("../desktop/package-layout.cjs") as PackageLayout;
const afterPack = require("../desktop/after-pack.cjs") as AfterPackModule;
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "alchemy-desktop-layout-"));
  temporaryDirectories.push(directory);
  return directory;
}

function packContext(platform: string, executableName?: string): PackContext {
  return {
    appOutDir: "/package",
    electronPlatformName: platform,
    packager: {
      appInfo: { productFilename: "Alchemy" },
      executableName,
      platform: { nodeName: platform },
    },
  };
}

describe("desktop package layout", () => {
  it("resolves platform executables from the electron-builder context", () => {
    expect(afterPack.resolvePackagedExecutable(packContext("win32"))).toBe(path.join("/package", "Alchemy.exe"));
    expect(afterPack.resolvePackagedExecutable(packContext("darwin"))).toBe(
      path.join("/package", "Alchemy.app", "Contents", "MacOS", "Alchemy"),
    );
    expect(afterPack.resolvePackagedExecutable(packContext("linux", "alchemy"))).toBe(path.join("/package", "alchemy"));
    expect(afterPack.resolvePackagedExecutable(packContext("linux", "alchemy-preview"))).toBe(
      path.join("/package", "alchemy-preview"),
    );
  });

  it("rejects incomplete or unsupported packaging contexts", () => {
    expect(() => afterPack.resolvePackagedExecutable(packContext("linux"))).toThrow(/executableName/u);
    expect(() => afterPack.resolvePackagedExecutable(packContext("freebsd"))).toThrow(/Unsupported Electron platform/u);
    expect(() => layout.executablePath("/package", "freebsd")).toThrow(/Unsupported desktop target/u);
  });

  it("selects the requested unpacked directory including architecture-qualified names", async () => {
    const root = await temporaryDirectory();
    await mkdir(path.join(root, "mac-arm64-unpacked"));
    await mkdir(path.join(root, "win-unpacked"));

    expect(layout.resolveUnpackedDirectory(root, { target: "mac" })).toBe(path.join(root, "mac-arm64-unpacked"));
    expect(layout.resolveUnpackedDirectory(root, { target: "win" })).toBe(path.join(root, "win-unpacked"));
    expect(() => layout.resolveUnpackedDirectory(root)).toThrow(/Multiple unpacked/u);
  });

  it("installs a browser-process snapshot beside every default snapshot", async () => {
    const root = await temporaryDirectory();
    const nested = path.join(root, "framework", "resources");
    await mkdir(nested, { recursive: true });
    await writeFile(path.join(root, "v8_context_snapshot.bin"), "root-snapshot");
    await writeFile(path.join(nested, "v8_context_snapshot.arm64.bin"), "nested-snapshot");

    await afterPack.installBrowserProcessSnapshots(root);

    await expect(readFile(path.join(root, "browser_v8_context_snapshot.bin"), "utf8")).resolves.toBe("root-snapshot");
    await expect(readFile(path.join(nested, "browser_v8_context_snapshot.bin"), "utf8")).resolves.toBe(
      "nested-snapshot",
    );
  });
});
